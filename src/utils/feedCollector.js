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

// Helper function to get feed content (RSS or Atom)
async function getFeedXML(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch feed: ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();
  console.log("Raw feed sample:", text.slice(0, 500));

  // Simple XML parsing to get the entries
  const entries = [];
  const isRSS = text.includes("<rss");

  // Match either RSS items or Atom entries
  const itemRegex = isRSS ? /<item>(.*?)<\/item>/gs : /<entry>(.*?)<\/entry>/gs;
  const matches = text.matchAll(itemRegex);

  for (const match of matches) {
    const entry = parseEntry(match[1], isRSS);
    console.log("Parsed feed entry:", {
      title: entry.title,
      published: entry.published,
    });
    entries.push(entry);
  }

  return { entries };
}

/**
 * Fetches and processes feed content
 * @param {Feed} feed - The feed to process
 * @returns {Promise<Array<Object>>} - The processed entries
 */
export async function getFeedContent(feed) {
  try {
    console.log("Fetching feed:", feed.url);

    const feedData = await getFeedXML(feed.url);
    const entries = feedData.entries || [];
    console.log("Found entries:", entries.length);

    if (entries.length === 0) {
      console.warn("No entries found in feed:", feed.url);
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
    return [];
  }
}
