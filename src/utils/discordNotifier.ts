import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(rootDir, ".env") });

// Define the URL to the RSS feed generated by your site
const RSS_FEED_URL =
  process.env.RSS_FEED_URL ||
  "https://astoria-tech.github.io/subcurrent-astro/rss.xml";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MAX_NOTIFICATIONS = 5; // Maximum number of notifications to send per run

// Path to store the record of posts we've already sent to Discord
const SENT_POSTS_FILE = path.join(__dirname, "../../.discord-sent-posts.json");

// Log environment variable status for troubleshooting
if (!DISCORD_WEBHOOK_URL) {
  console.warn(
    "DISCORD_WEBHOOK_URL not found in environment variables. " +
      "When running locally, make sure you have a .env file with DISCORD_WEBHOOK_URL set."
  );
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  author?: string;
}

interface PostsTracker {
  sentPosts: string[];
  latestTimestamp: string;
}

// Helper function to properly decode HTML entities and clean content
function sanitizeContent(html: string): string {
  if (!html) return "";

  // First decode HTML entities
  const decoded = html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'");

  // Then strip all HTML tags
  const stripped = decoded.replace(/<[^>]*>/g, "");

  // Trim excess whitespace
  return stripped.replace(/\s+/g, " ").trim();
}

async function loadPostsTracker(): Promise<PostsTracker> {
  try {
    const data = await fs.readFile(SENT_POSTS_FILE, "utf-8");
    const tracker = JSON.parse(data) as PostsTracker;
    return {
      sentPosts: Array.isArray(tracker.sentPosts) ? tracker.sentPosts : [],
      latestTimestamp: tracker.latestTimestamp || "1970-01-01T00:00:00.000Z",
    };
  } catch (error) {
    // File doesn't exist or is invalid, start with empty tracker
    return {
      sentPosts: [],
      latestTimestamp: "1970-01-01T00:00:00.000Z",
    };
  }
}

async function savePostsTracker(tracker: PostsTracker): Promise<void> {
  await fs.writeFile(
    SENT_POSTS_FILE,
    JSON.stringify(tracker, null, 2),
    "utf-8"
  );
}

async function fetchRss(): Promise<RssItem[]> {
  console.log(`Fetching RSS feed from ${RSS_FEED_URL}`);
  const response = await fetch(RSS_FEED_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch RSS feed: ${response.status} ${response.statusText}`
    );
  }

  // Simple XML parsing
  const content = await response.text();
  const items: RssItem[] = [];

  // Extract items from RSS feed
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const itemContent = match[1];

    // Extract fields for each item
    const title = itemContent.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const link = itemContent.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
    const author = itemContent.match(/<author>(.*?)<\/author>/)?.[1] || "";
    const description =
      itemContent.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";

    items.push({
      title: title.trim(),
      link: link.trim(),
      pubDate: pubDate.trim(),
      author: author.trim(),
      description: description.trim(),
    });
  }

  return items;
}

async function sendToDiscord(item: RssItem): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.error(
      "Discord webhook URL not provided. Set DISCORD_WEBHOOK_URL environment variable."
    );
    return;
  }

  try {
    // Clean up the title and description for better presentation
    const cleanTitle = sanitizeContent(item.title);
    const cleanDescription = item.description
      ? sanitizeContent(item.description)
      : "";

    // Create a rich embed for Discord
    const payload = {
      embeds: [
        {
          title: cleanTitle,
          url: item.link,
          description: cleanDescription
            ? cleanDescription.length > 200
              ? cleanDescription.substring(0, 200) + "..."
              : cleanDescription
            : "Read more at the link",
          color: 0x3498db, // Blue color
          timestamp: new Date(item.pubDate).toISOString(),
          footer: {
            text: `Posted by ${item.author || "Subcurrent"}`,
          },
        },
      ],
    };

    console.log(`Sending notification for "${cleanTitle}"`);

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Discord API error: ${response.status} ${response.statusText}`
      );
    }

    // Add a small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(
      `Failed to send Discord notification for ${item.title}:`,
      error
    );
  }
}

async function notifyNewItems(): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.error(
      "Discord webhook URL not provided. Set DISCORD_WEBHOOK_URL environment variable."
    );
    return;
  }

  try {
    // Load the tracker of posts we've already sent
    const tracker = await loadPostsTracker();
    const sentPostsSet = new Set(tracker.sentPosts);
    const latestTimestamp = new Date(tracker.latestTimestamp);

    console.log(
      `Last notification timestamp: ${latestTimestamp.toISOString()}`
    );

    // Fetch current RSS items
    const items = await fetchRss();

    // Sort by publication date (newest first)
    items.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    // Find items we haven't sent yet AND are newer than our latest post
    const newItems = items.filter((item) => {
      const itemDate = new Date(item.pubDate);
      return !sentPostsSet.has(item.link) && itemDate > latestTimestamp;
    });

    console.log(`Found ${newItems.length} new items to notify about`);

    // Send notifications for new items (up to the maximum limit)
    const itemsToSend = newItems.slice(0, MAX_NOTIFICATIONS);
    let newLatestTimestamp = latestTimestamp;

    for (const item of itemsToSend) {
      await sendToDiscord(item);
      sentPostsSet.add(item.link);

      // Update latest timestamp if this item is newer
      const itemDate = new Date(item.pubDate);
      if (itemDate > newLatestTimestamp) {
        newLatestTimestamp = itemDate;
      }
    }

    // Save the updated tracker with new latest timestamp
    const updatedTracker: PostsTracker = {
      sentPosts: Array.from(sentPostsSet),
      latestTimestamp: newLatestTimestamp.toISOString(),
    };
    await savePostsTracker(updatedTracker);

    console.log(
      `Successfully sent ${itemsToSend.length} notifications to Discord`
    );
    if (itemsToSend.length > 0) {
      console.log(
        `Updated latest timestamp to: ${newLatestTimestamp.toISOString()}`
      );
    }
  } catch (error) {
    console.error("Error in Discord notification process:", error);
  }
}

// Only run if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  notifyNewItems().catch((error) => {
    console.error("Fatal error in Discord notifier:", error);
    process.exit(1);
  });
}

export { notifyNewItems };
