/**
 * Feed interface definition
 */
export interface Feed {
  url: string;
  authorName: string;
}

/**
 * FeedEntry interface definition
 */
export interface FeedEntry {
  title: string;
  link: string;
  published: string;
  description: string;
  imageUrl?: string;
}

/**
 * ProcessedEntry interface for the final output
 */
export interface ProcessedEntry {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  author: string;
  feedSource: string;
  lastFetched: string;
  imageUrl?: string;
}

import fs from 'node:fs/promises';
import path from 'node:path';

// Module-level session tracking for Substack domain spacing
const processedSubstackDomains = new Set<string>();

// Rate limiting interfaces
interface RateLimitHeaders {
  remaining?: number;
  reset?: number;
  retryAfter?: number;
}

// Helper function to extract Substack domain from URL
function extractSubstackDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// Helper function to parse rate limit headers
function parseRateLimitHeaders(headers: Headers): RateLimitHeaders {
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');
  const retryAfter = headers.get('retry-after');

  return {
    remaining: remaining ? parseInt(remaining, 10) : undefined,
    reset: reset ? parseInt(reset, 10) : undefined,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
  };
}

// Helper function to log rate limit status
function logRateLimitStatus(url: string, rateLimits: RateLimitHeaders): void {
  if (
    rateLimits.remaining !== undefined ||
    rateLimits.reset !== undefined ||
    rateLimits.retryAfter !== undefined
  ) {
    console.log(`Rate limit status for ${url}:`, {
      remaining: rateLimits.remaining,
      reset: rateLimits.reset ? new Date(rateLimits.reset * 1000).toISOString() : undefined,
      retryAfter: rateLimits.retryAfter,
    });
  }
}

// Helper function to calculate delay based on rate limits
function calculateRateLimitDelay(rateLimits: RateLimitHeaders): number {
  // If retry-after is specified, use it
  if (rateLimits.retryAfter) {
    return rateLimits.retryAfter * 1000; // Convert to milliseconds
  }

  // If remaining requests are low, add extra delay
  if (rateLimits.remaining !== undefined && rateLimits.remaining < 10) {
    const extraDelay = (10 - rateLimits.remaining) * 30000; // 30 seconds per missing request
    console.log(
      `Low rate limit remaining (${rateLimits.remaining}), adding ${extraDelay / 1000}s extra delay`
    );
    return extraDelay;
  }

  return 0;
}

// Helper function for exponential backoff
function calculateExponentialBackoff(attempt: number, baseDelay: number = 30000): number {
  return Math.min(Math.pow(2, attempt) * baseDelay, 300000); // Cap at 5 minutes
}

// Helper function to create a safe filename
function createSafeFilename(url: string, title: string): string {
  const urlHash = Buffer.from(url).toString('base64url').slice(0, 8);
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
  return `${safeTitle}-${urlHash}.json`;
}

// Helper function to parse and validate dates
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

// Helper function to clean XML content
function cleanXMLContent(str: string): string {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Helper function to generate meaningful titles from description content for microblog entries
function generateTitleFromDescription(description: string): string {
  if (!description) return '';

  // Strip HTML tags and decode common entities
  const cleanText = description
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Replace HTML entities with spaces
    .replace(/\s+/g, ' ') // Collapse multiple whitespace
    .trim();

  if (!cleanText) return '';

  // Take first 50-60 characters and add ellipsis if truncated
  const maxLength = 55;
  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  // Find a good place to break (at word boundary)
  const truncated = cleanText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // If we have a reasonable word break point (within 70% of max length), use it
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  } else {
    return truncated + '...';
  }
}

// Helper function to extract content using regex
function extractContent(entry: string, pattern: RegExp): string {
  const match = entry.match(pattern);
  return match ? cleanXMLContent(match[1]) : '';
}

// Helper function to parse an XML entry
function parseEntry(entry: string, isRSS: boolean): FeedEntry {
  try {
    const title = extractContent(entry, /<title[^>]*>(.*?)<\/title>/s);
    const link = isRSS
      ? extractContent(entry, /<link>(.*?)<\/link>/)
      : entry.match(/<link[^>]*href="([^"]*)"[^>]*>/)?.[1] || '';
    const published =
      entry.match(
        /<(?:pubDate|published|updated|date)[^>]*>(.*?)<\/(?:pubDate|published|updated|date)>/
      )?.[1] || '';
    const description = extractContent(
      entry,
      /<(?:description|content|summary)[^>]*>(.*?)<\/(?:description|content|summary)>/s
    );

    // Extract image URL using various patterns
    let imageUrl = '';

    // Try media:content tag
    const mediaContentMatch = entry.match(/<media:content[^>]+url="([^"]+)"[^>]*>/);
    if (mediaContentMatch && !imageUrl) {
      imageUrl = mediaContentMatch[1];
    }

    // Try media:thumbnail
    const mediaThumbnailMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"[^>]*>/);
    if (mediaThumbnailMatch && !imageUrl) {
      imageUrl = mediaThumbnailMatch[1];
    }

    // Try enclosure (podcasts and some blogs)
    const enclosureMatch = entry.match(
      /<enclosure[^>]+url="([^"]+)"[^>]+type="image\/[^"]+"[^>]*>/
    );
    if (enclosureMatch && !imageUrl) {
      imageUrl = enclosureMatch[1];
    }

    // Try image tag directly
    const imageTagMatch = entry.match(/<image><url>(.*?)<\/url><\/image>/);
    if (imageTagMatch && !imageUrl) {
      imageUrl = imageTagMatch[1];
    }

    // Try itunes:image
    const itunesImageMatch = entry.match(/<itunes:image[^>]+href="([^"]+)"[^>]*>/);
    if (itunesImageMatch && !imageUrl) {
      imageUrl = itunesImageMatch[1];
    }

    // Try extracting from description only if we can't find it elsewhere
    if (!imageUrl && description) {
      const imgMatch = description.match(/<img[^>]+src="([^">]+)"/i);
      if (imgMatch && imgMatch[1]) {
        imageUrl = imgMatch[1];
      }
    }

    return { title, link, published, description, imageUrl };
  } catch (error) {
    console.error('Error parsing entry:', error);
    return { title: '', link: '', published: '', description: '', imageUrl: '' };
  }
}

// Helper function to get feed content (RSS or Atom) with comprehensive rate limiting
async function getFeedXML(url: string): Promise<string> {
  console.log(`Fetching feed: ${url}`);

  // Realistic browser User-Agents for spoofing
  const browserUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  ];

  const isSubstackFeed = url.includes('substack.com');

  // Build headers - use browser spoofing for Substack feeds
  const headers: Record<string, string> = {
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml',
  };

  if (isSubstackFeed) {
    // Enhanced browser-like headers for Substack
    const randomUserAgent = browserUserAgents[Math.floor(Math.random() * browserUserAgents.length)];
    headers['User-Agent'] = randomUserAgent;
    headers['Accept-Language'] = 'en-US,en;q=0.9';
    headers['Accept-Encoding'] = 'gzip, deflate, br';
    headers['DNT'] = '1';
    headers['Connection'] = 'keep-alive';
    headers['Upgrade-Insecure-Requests'] = '1';
    headers['Referer'] = 'https://www.google.com/';
    console.log(`Using browser spoofing for Substack feed: ${url}`);
  } else {
    // Use original User-Agent for non-Substack feeds
    headers['User-Agent'] =
      'Subcurrent Feed Reader (https://github.com/astoria-tech/subcurrent-astro)';
  }

  // Enhanced rate limiting for Substack feeds
  if (isSubstackFeed) {
    const domain = extractSubstackDomain(url);

    // Inter-feed spacing: Add 2-5 minute delay between different Substack domains
    if (processedSubstackDomains.has(domain)) {
      console.log(
        `Same Substack domain (${domain}) processed recently - no inter-feed delay needed`
      );
    } else {
      // First time processing this domain in the session or different domain
      if (processedSubstackDomains.size > 0) {
        const interFeedDelayMs = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000; // 5-15 seconds
        console.log(
          `Inter-feed spacing: Adding ${Math.round(interFeedDelayMs / 1000)}s delay between different Substack domains`
        );
        await new Promise((resolve) => setTimeout(resolve, interFeedDelayMs));
      }
      processedSubstackDomains.add(domain);
    }

    // Standard individual feed delay (existing behavior)
    const delayMs = 11000; // Fixed 11 seconds for consistent testing
    console.log(
      `Applying ${Math.round(delayMs / 1000)}s individual delay for Substack feed rate limiting`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // Implement retry logic with exponential backoff for rate limit errors
  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, { headers });

      // Parse and log rate limit headers
      if (isSubstackFeed) {
        const rateLimits = parseRateLimitHeaders(response.headers);
        logRateLimitStatus(url, rateLimits);

        // Check for rate limit delays needed
        const rateLimitDelay = calculateRateLimitDelay(rateLimits);
        if (rateLimitDelay > 0) {
          console.log(`Rate limit headers suggest ${rateLimitDelay / 1000}s delay - applying now`);
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
        }
      }

      // Handle HTTP 429 (Too Many Requests) with exponential backoff
      if (response.status === 429) {
        if (attempt >= maxRetries) {
          const errorDetails = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            url: url,
            maxRetriesExceeded: true,
          };
          console.error(`Rate limit exceeded and max retries reached - Details:`, errorDetails);
          throw new Error(
            `Rate limit exceeded (429) and max retries (${maxRetries}) reached for URL: ${url}`
          );
        }

        const backoffDelay = calculateExponentialBackoff(attempt);
        console.log(
          `HTTP 429 received (attempt ${attempt + 1}/${maxRetries + 1}). Applying exponential backoff: ${backoffDelay / 1000}s`
        );

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        attempt++;
        continue; // Retry the request
      }

      // Handle other non-success status codes
      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          url: url,
        };
        console.error(`Failed to fetch feed - Details:`, errorDetails);
        throw new Error(
          `Failed to fetch feed: ${response.status} ${response.statusText} for URL: ${url}`
        );
      }

      // Success - process the response
      const text = await response.text();
      if (!text.includes('<rss') && !text.includes('<feed')) {
        console.error(
          `Invalid feed format received from ${url}. Response preview:`,
          text.substring(0, 200)
        );
        throw new Error(`Response is not a valid RSS/Atom feed for URL: ${url}`);
      }

      console.log(`Successfully fetched ${isSubstackFeed ? 'Substack' : 'regular'} feed: ${url}`);
      return text;
    } catch (error) {
      // Only retry on fetch errors if this is a rate-limiting related issue
      if (
        attempt < maxRetries &&
        isSubstackFeed &&
        (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch')))
      ) {
        const backoffDelay = calculateExponentialBackoff(attempt);
        console.log(
          `Fetch error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying after ${backoffDelay / 1000}s backoff`
        );

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        attempt++;
        continue;
      }

      // Log the error and rethrow
      console.error(`Error fetching feed ${url}:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        isSubstackFeed,
        headers: headers,
        attempt: attempt + 1,
      });
      throw error;
    }
  }

  // This should never be reached due to the throw statements above
  throw new Error(`Unexpected error: max retries exceeded for ${url}`);
}

/**
 * Preprocesses HTML snippets to fix common issues before storage
 * @param html - The HTML content to preprocess
 * @returns The preprocessed HTML content
 */
function preprocessHtmlSnippet(html: string): string {
  if (!html) return '';

  // Clean up quotes in URLs and other common issues
  return (
    html
      // Remove excessive newlines and spaces
      .replace(/\s+/g, ' ')
      // Fix URLs in img tags - handle various quote styles
      .replace(/<img[^>]*src=\\?("|')(.*?)\\?("|')[^>]*>/gi, (match, q1, url) => {
        // Clean the URL by removing any trailing quotes or entities
        const cleanUrl = url
          .replace(/&quot;/g, '')
          .replace(/\\"/g, '')
          .replace(/["']+$/g, '')
          .replace(/\/["']+/g, '/');
        return `<img src="${cleanUrl}">`;
      })
      // Fix URLs in a tags
      .replace(/<a[^>]*href=\\?("|')(.*?)\\?("|')[^>]*>/gi, (match, q1, url) => {
        // Extract other attributes like class, title, etc.
        const attrs = match.match(/\s(\w+)=\\?("|')(.*?)\\?("|')/g) || [];
        const cleanAttrs = attrs
          .filter((attr) => !attr.startsWith(' href='))
          .map((attr) => attr.replace(/=\\?("|')(.*?)\\?("|')/g, '="$2"'))
          .join('');

        // Clean the URL
        const cleanUrl = url
          .replace(/&quot;/g, '')
          .replace(/\\"/g, '')
          .replace(/["']+$/g, '')
          .replace(/\/["']+/g, '/');

        return `<a href="${cleanUrl}"${cleanAttrs}>`;
      })
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Truncate if too long (prevents excessively long snippets)
      .substring(0, 2000)
  );
}

/**
 * Fetches and processes feed content
 * @param feed - The feed to process
 * @returns The processed entries
 */
export async function getFeedContent(feed: Feed): Promise<ProcessedEntry[]> {
  try {
    const text = await getFeedXML(feed.url);
    const isRSS = text.includes('<rss');

    // Match either RSS items or Atom entries
    const itemRegex = isRSS ? /<item>(.*?)<\/item>/gs : /<entry>(.*?)<\/entry>/gs;
    const matches = text.matchAll(itemRegex);
    const entries: ProcessedEntry[] = [];

    for (const match of matches) {
      const entry = parseEntry(match[1], isRSS);

      // Generate fallback title for microblog entries with empty titles
      const finalTitle =
        entry.title || generateTitleFromDescription(entry.description) || 'Untitled Post';

      // Only skip entries that have both empty title AND empty description
      if (!entry.title && !entry.description) continue;

      const entryData: ProcessedEntry = {
        title: finalTitle,
        link: entry.link || '',
        pubDate: parseDate(entry.published),
        snippet: preprocessHtmlSnippet(entry.description) || '',
        author: feed.authorName,
        feedSource: feed.url,
        lastFetched: new Date().toISOString(),
        imageUrl: entry.imageUrl || '',
      };

      entries.push(entryData);
    }

    console.log(`Found ${entries.length} entries in ${feed.url}`);

    // Save entries to files
    const feedsDir = path.join(process.cwd(), 'src/content/feeds');
    await fs.mkdir(feedsDir, { recursive: true });

    for (const entry of entries) {
      const filename = createSafeFilename(entry.link || feed.url, entry.title);
      const filePath = path.join(feedsDir, filename);
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
    }

    return entries;
  } catch (error) {
    console.error(`Error processing feed ${feed.url}:`, error);
    return [];
  }
}
