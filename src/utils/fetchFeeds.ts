import { feeds } from "../data/feeds.js";
import { getFeedContent } from "./feedCollector.ts";

async function main() {
  console.log("Starting feed fetch...");

  const results = [];

  // Process feeds sequentially to avoid overwhelming servers
  for (const feed of feeds) {
    try {
      console.log(`\nProcessing feed: ${feed.url}`);
      const entries = await getFeedContent(feed);
      results.push({ feed, count: entries.length });
    } catch (error) {
      console.error(`Failed to process feed ${feed.url}:`, error);
      results.push({ feed, count: 0 });
    }
  }

  console.log("\nFeed fetch summary:");
  for (const result of results) {
    console.log(`${result.feed.authorName}: ${result.count} entries`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
