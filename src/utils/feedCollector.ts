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
}

import fs from 'node:fs/promises';
import path from 'node:path';

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

    return { title, link, published, description };
  } catch (error) {
    console.error('Error parsing entry:', error);
    return { title: '', link: '', published: '', description: '' };
  }
}

// Helper function to get feed content (RSS or Atom)
async function getFeedXML(url: string): Promise<string> {
  console.log(`Fetching feed: ${url}`);

  const headers = {
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml',
    'User-Agent': 'Subcurrent Feed Reader (https://github.com/astoria-tech/subcurrent-astro)',
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  if (!text.includes('<rss') && !text.includes('<feed')) {
    throw new Error('Response is not a valid RSS/Atom feed');
  }

  return text;
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
      if (!entry.title) continue;

      const entryData: ProcessedEntry = {
        title: entry.title,
        link: entry.link || '',
        pubDate: parseDate(entry.published),
        snippet: preprocessHtmlSnippet(entry.description) || '',
        author: feed.authorName,
        feedSource: feed.url,
        lastFetched: new Date().toISOString(),
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
