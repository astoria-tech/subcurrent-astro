import { defineCollection, z } from 'astro:content';

// Define the schema for our feed entries
const feedsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    link: z.string().url(),
    pubDate: z.string().datetime(),
    snippet: z.string(),
    author: z.string(),
    feedSource: z.string(), // to track which feed this came from
    lastFetched: z.string().datetime(),
    imageUrl: z.string().optional(), // URL to the feed item's image
  }),
});

// Export the collections object
export const collections = {
  feeds: feedsCollection,
};
