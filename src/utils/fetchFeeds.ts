import { feeds } from "../data/feeds.js";
import { getFeedContent } from "./feedCollector.js";

async function main() {
  console.log("Starting feed fetch...");

  try {
    const results = await Promise.all(
      feeds.map(async (feed) => {
        console.log(`\nFetching feed: ${feed.url}`);
        const entries = await getFeedContent(feed);
        return {
          feed,
          count: entries.length,
        };
      })
    );

    console.log("\nFeed fetch summary:");
    for (const result of results) {
      console.log(`${result.feed.authorName}: ${result.count} entries`);
    }
  } catch (error) {
    console.error("Error fetching feeds:", error);
    process.exit(1);
  }
}

main();
