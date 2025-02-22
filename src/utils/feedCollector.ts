import type { Feed } from "../data/feeds";
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import fs from "node:fs/promises";
import path from "node:path";

type FeedEntry = CollectionEntry<"feeds">;

// Helper function to create a safe filename
function createSafeFilename(url: string, title: string): string {
  const urlHash = Buffer.from(url).toString("base64url").slice(0, 8);
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  return `${safeTitle}-${urlHash}.json`;
}

// Helper function to parse and validate dates
function parseDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();

  console.log("Raw date string:", dateStr);

  // Parse the date
  const date = new Date(dateStr);
  const now = new Date();

  console.log("Date parsing:", {
    input: dateStr,
    parsed: date.toISOString(),
    now: now.toISOString(),
  });

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.error("Invalid date:", dateStr);
    return now.toISOString();
  }

  // Ensure the date is not in the future
  if (date > now) {
    console.log("Future date detected:", {
      date: date.toISOString(),
      now: now.toISOString(),
    });
    return now.toISOString();
  }

  return date.toISOString();
}

// Helper function to get feed content (RSS or Atom)
async function getFeedXML(url: string): Promise<any> {
  const response = await fetch(url);
  const text = await response.text();

  console.log("Raw feed sample:", text.slice(0, 500));

  // Simple XML parsing to get the entries
  const entries: any[] = [];
  const isRSS = text.includes("<rss");

  // Match either RSS items or Atom entries
  const itemRegex = isRSS ? /<item>(.*?)<\/item>/gs : /<entry>(.*?)<\/entry>/gs;
  const matches = text.matchAll(itemRegex);

  for (const match of matches) {
    const entry = match[1];
    const title = entry.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || "";
    const link = isRSS
      ? entry.match(/<link>(.*?)<\/link>/)?.[1]
      : entry.match(/<link.*?href="(.*?)".*?>/)?.[1] || "";
    const published =
      entry.match(
        /<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>/
      )?.[1] || "";
    const description =
      entry.match(
        /<description>(.*?)<\/description>|<content.*?>(.*?)<\/content>|<media:description>(.*?)<\/media:description>/
      )?.[1] || "";

    console.log("Parsed feed entry:", {
      title,
      published,
    });

    entries.push({
      title,
      link,
      published,
      description,
    });
  }

  return { entries };
}

export async function getFeedContent(feed: Feed) {
  try {
    console.log("Fetching feed:", feed.url);

    // Try to get existing entries
    const existingEntries = await getCollection("feeds", (entry: FeedEntry) => {
      return entry.data.feedSource === feed.url;
    });

    console.log("Existing entries:", existingEntries.length);

    // Check if we need to update (older than 6 hours)
    const needsUpdate =
      !existingEntries.length ||
      existingEntries.some((entry) => {
        const lastFetched = new Date(entry.data.lastFetched);
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        return lastFetched < sixHoursAgo;
      });

    console.log("Need update:", needsUpdate);

    if (needsUpdate) {
      console.log("Fetching new content for:", feed.url);
      const feedData = await getFeedXML(feed.url);
      const entries = feedData.entries || [];
      console.log("Found entries:", entries.length);

      const feedsDir = path.join(process.cwd(), "src/content/feeds");

      // Ensure the feeds directory exists
      await fs.mkdir(feedsDir, { recursive: true });

      // Process each entry
      const processedEntries = [];
      for (const entry of entries) {
        const entryData = {
          title: entry.title || "Untitled",
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

      // Clean up old entries for this feed
      const files = await fs.readdir(feedsDir);
      console.log("Total files in directory:", files.length);

      for (const file of files) {
        const filePath = path.join(feedsDir, file);
        try {
          const content = JSON.parse(await fs.readFile(filePath, "utf-8"));
          if (
            content.feedSource === feed.url &&
            !processedEntries.find((e) => e.link === content.link)
          ) {
            console.log("Removing old entry:", file);
            await fs.unlink(filePath);
          }
        } catch (err) {
          console.error(`Error processing file ${file}:`, err);
        }
      }

      return processedEntries;
    }

    return existingEntries.map((entry) => entry.data);
  } catch (error) {
    console.error(`Error fetching ${feed.url}:`, error);
    return [];
  }
}

// Helper function to get description from YouTube feed items
function getYouTubeDescription(entry: any): string {
  return (
    entry["media:group"]?.["media:description"]?.[0] ||
    entry.description ||
    "No description available."
  );
}
