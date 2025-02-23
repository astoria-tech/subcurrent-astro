/**
 * @typedef {Object} Feed
 * @property {string} url - The feed URL
 * @property {string} authorName - The author's name
 */

/**
 * @typedef {Object} FeedEntry
 * @property {string} title - The entry title
 * @property {string} link - The entry URL
 * @property {string} published - The publication date
 * @property {string} description - The entry description/content
 */

import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";
const execAsync = promisify(exec);

// Helper function to create a safe filename
function createSafeFilename(url, title) {
  const urlHash = Buffer.from(url).toString("base64url").slice(0, 8);
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  return `${safeTitle}-${urlHash}.json`;
}

// Helper function to parse and validate dates
function parseDate(dateStr) {
  if (!dateStr) {
    console.warn("No date provided, using current time");
    return new Date().toISOString();
  }

  console.log("Raw date string:", dateStr);

  // Parse the date
  const date = new Date(dateStr);
  const now = new Date();

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.error("Invalid date:", dateStr);
    return now.toISOString();
  }

  // Ensure the date is not in the future
  if (date > now) {
    console.warn("Future date detected, using current time:", {
      date: date.toISOString(),
      now: now.toISOString(),
    });
    return now.toISOString();
  }

  return date.toISOString();
}

// Helper function to clean XML content
function cleanXMLContent(str) {
  if (!str) return "";

  // Remove CDATA
  str = str.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");
  // Remove HTML tags
  str = str.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  str = str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return str.trim();
}

// Helper function to extract content using regex
function extractContent(entry, pattern) {
  const match = entry.match(pattern);
  return match ? cleanXMLContent(match[1]) : "";
}

// Helper function to parse an XML entry
function parseEntry(entry, isRSS) {
  try {
    // Extract title
    const title = extractContent(entry, /<title[^>]*>(.*?)<\/title>/s);

    // Extract link
    let link = "";
    if (isRSS) {
      link = extractContent(entry, /<link>(.*?)<\/link>/);
    } else {
      const linkMatch = entry.match(/<link[^>]*href="([^"]*)"[^>]*>/);
      link = linkMatch?.[1] || "";
    }

    // Extract publication date
    let published = "";
    const datePatterns = [
      /<(?:pubDate|published|updated|date)>(.*?)<\/(?:pubDate|published|updated|date)>/,
      /<(?:pubDate|published|updated|date)[^>]*>(.*?)<\/(?:pubDate|published|updated|date)>/,
    ];

    for (const pattern of datePatterns) {
      const match = entry.match(pattern);
      if (match) {
        published = match[1];
        break;
      }
    }

    // Extract description
    const description = extractContent(
      entry,
      /<(?:description|content|summary|media:description)[^>]*>(.*?)<\/(?:description|content|summary|media:description)>/s
    );

    return { title, link, published, description };
  } catch (error) {
    console.error("Error parsing entry:", error);
    return {
      title: "",
      link: "",
      published: "",
      description: "",
    };
  }
}

// Helper function to check if a URL is from Substack
function isSubstackURL(url) {
  return url.includes("substack.com");
}

// Helper function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to fetch Substack feeds using curl
async function fetchWithCurl(url) {
  try {
    console.log(`[curl] Starting curl request for ${url}`);
    console.log("[curl] Using filtered grep to handle large responses");

    // Add grep to filter out just the essential XML parts and limit the content size
    const cmd = `curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" \
      -H "Accept: application/rss+xml, application/xml, text/xml, application/atom+xml" \
      -H "Accept-Language: en-US,en;q=0.9" \
      -H "Cache-Control: no-cache" \
      -H "Pragma: no-cache" \
      -H "Sec-Fetch-Dest: document" \
      -H "Sec-Fetch-Mode: navigate" \
      -H "Sec-Fetch-Site: none" \
      -H "Sec-Fetch-User: ?1" \
      --connect-timeout 20 \
      --max-time 30 \
      --retry 3 \
      --retry-delay 5 \
      --retry-max-time 60 \
      -v \
      "${url}" 2>&1 | tee >(grep "^*" >&2) | grep -E "(<item>|</item>|<title>|</title>|<link>|</link>|<pubDate>|</pubDate>|<description>|</description>)"`;

    console.log("[curl] Executing curl command with grep filtering");
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024,
    }); // 10MB buffer

    if (stderr) {
      console.log("[curl] Curl debug output:", stderr);
    }

    console.log(`[curl] Received ${stdout.length} bytes of filtered content`);

    // Count matched tags to verify content
    const tagCounts = {
      items: (stdout.match(/<item>/g) || []).length,
      titles: (stdout.match(/<title>/g) || []).length,
      links: (stdout.match(/<link>/g) || []).length,
      dates: (stdout.match(/<pubDate>/g) || []).length,
    };
    console.log("[curl] Found tags:", tagCounts);

    // Reconstruct minimal valid XML
    const result = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>${stdout}</channel></rss>`;
    console.log("[curl] Successfully reconstructed XML document");

    return result;
  } catch (error) {
    console.error("[curl] Curl command failed:", error);
    console.error("[curl] Full error details:", {
      message: error.message,
      code: error.code,
      stdout: error.stdout?.slice(0, 500),
      stderr: error.stderr?.slice(0, 500),
    });
    throw new Error(`Curl failed: ${error.message}`);
  }
}

// Helper function to get feed content (RSS or Atom)
async function getFeedXML(url, retries = 3) {
  const isSubstack = isSubstackURL(url);
  console.log(
    `\n[feed] Processing ${isSubstack ? "Substack" : "standard"} feed: ${url}`
  );
  console.log(`[feed] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[feed] Platform: ${process.platform}`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `\n[feed] Attempt ${attempt}/${retries} for ${url}${
          isSubstack ? " [Substack]" : ""
        }`
      );

      let text;
      if (isSubstack) {
        console.log("[feed] Using curl strategy for Substack");
        text = await fetchWithCurl(url);
      } else {
        console.log("[feed] Using fetch strategy for standard feed");
        // Base headers
        const headers = {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept:
            "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9, */*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          DNT: "1",
        };

        const response = await fetch(url, { headers });
        console.log(`Response status: ${response.status}`);
        console.log(
          "Response headers:",
          Object.fromEntries(response.headers.entries())
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch feed: ${response.status} ${response.statusText}`
          );
        }

        text = await response.text();
      }

      // Log more details for Substack feeds
      if (isSubstack) {
        console.log("[feed] Substack response sample:", text.slice(0, 1000));
        console.log("[feed] Response length:", text.length);
        console.log("[feed] Contains XML declaration:", text.includes("<?xml"));
        console.log("[feed] Contains RSS root:", text.includes("<rss"));
        console.log("[feed] Contains items:", text.includes("<item>"));
      }

      if (text.includes("captcha") || text.includes("challenge-form")) {
        console.warn("[feed] Challenge/captcha detected in response");
        throw new Error("Challenge form detected");
      }

      console.log(`[feed] Received content length: ${text.length} bytes`);
      if (text.length < 100) {
        console.warn("[feed] Response too short:", text);
        throw new Error("Response too short, likely invalid");
      }

      // Validate it's actually XML/RSS/Atom
      if (
        !text.includes("<?xml") &&
        !text.includes("<rss") &&
        !text.includes("<feed")
      ) {
        console.warn(
          "[feed] Invalid feed format. Response starts with:",
          text.slice(0, 200)
        );
        throw new Error("Response is not valid XML/RSS/Atom");
      }

      console.log("[feed] Raw feed sample:", text.slice(0, 500));

      // Simple XML parsing to get the entries
      const entries = [];
      const isRSS = text.includes("<rss");
      console.log(`[feed] Detected format: ${isRSS ? "RSS" : "Atom"}`);

      // Match either RSS items or Atom entries
      const itemRegex = isRSS
        ? /<item>(.*?)<\/item>/gs
        : /<entry>(.*?)<\/entry>/gs;
      const matches = text.matchAll(itemRegex);

      for (const match of matches) {
        const entry = parseEntry(match[1], isRSS);
        console.log("[feed] Parsed entry:", {
          title: entry.title,
          published: entry.published,
          hasLink: !!entry.link,
          descriptionLength: entry.description?.length || 0,
        });
        entries.push(entry);
      }

      console.log(`[feed] Successfully parsed ${entries.length} entries`);
      return { entries };
    } catch (error) {
      console.error(
        `[feed] Attempt ${attempt}/${retries} failed:`,
        error.message
      );
      console.error("[feed] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      if (attempt === retries) {
        console.error("[feed] All retry attempts failed");
        return { entries: [] };
      }

      // Exponential backoff
      const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`[feed] Waiting ${backoff}ms before retry...`);
      await delay(backoff);
    }
  }

  return { entries: [] };
}

/**
 * Fetches and processes feed content
 * @param {Feed} feed - The feed to process
 * @returns {Promise<Array<Object>>} - The processed entries
 */
export async function getFeedContent(feed) {
  try {
    console.log("Fetching feed:", feed.url);
    const isSubstack = isSubstackURL(feed.url);

    if (isSubstack) {
      console.log("Processing Substack feed with extra care");
    }

    const feedData = await getFeedXML(feed.url);
    const entries = feedData.entries || [];
    console.log(
      `Found ${entries.length} entries${isSubstack ? " from Substack" : ""}`
    );

    if (entries.length === 0) {
      console.warn(`No entries found in feed: ${feed.url}`);
      if (isSubstack) {
        console.warn(
          "This is a Substack feed - might need manual investigation"
        );
      }
      return [];
    }

    const feedsDir = path.join(process.cwd(), "src/content/feeds");
    await fs.mkdir(feedsDir, { recursive: true });

    // Process each entry
    const processedEntries = [];
    for (const entry of entries) {
      if (!entry.title) {
        console.warn("Skipping entry with no title");
        continue;
      }

      const entryData = {
        title: entry.title,
        link: entry.link || "",
        pubDate: parseDate(entry.published),
        snippet: entry.description || "",
        author: feed.authorName,
        feedSource: feed.url,
        lastFetched: new Date().toISOString(),
      };

      // Create a unique filename for this entry
      const filename = createSafeFilename(
        entry.link || feed.url,
        entryData.title
      );
      const filePath = path.join(feedsDir, filename);

      console.log("Writing entry:", {
        title: entryData.title,
        file: filename,
      });

      // Write the entry to a JSON file
      await fs.writeFile(filePath, JSON.stringify(entryData, null, 2));
      processedEntries.push(entryData);
    }

    return processedEntries;
  } catch (error) {
    console.error(`Error processing feed ${feed.url}:`, error);
    if (isSubstackURL(feed.url)) {
      console.error("Substack feed failed - this might need special handling");
      console.error("Full error:", error.stack);
    }
    return [];
  }
}
