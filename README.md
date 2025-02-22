# Subcurrent

A content aggregator for the Astoria Tech community, built with Astro.

## Features

- Aggregates content from multiple sources (RSS, Atom, and YouTube feeds)
- Automatically handles different feed formats
- Prevents future-dated posts
- Clean, modern UI with dark mode
- Mobile-friendly design

## Feed System

The feed system is designed to aggregate content from various sources into a unified stream. It supports:

- RSS feeds
- Atom feeds
- YouTube channel feeds

### How it Works

1. **Feed Configuration**: Feeds are configured in `src/data/feeds.ts`:

   ```typescript
   export const feeds = [
     {
       url: "https://example.com/feed.xml",
       authorName: "Author Name",
     },
   ];
   ```

2. **Feed Processing**:

   - Feeds are fetched and processed using `src/utils/feedCollector.js`
   - Each feed entry is stored as a JSON file in `src/content/feeds/`
   - The system handles various date formats and ensures dates are valid
   - Future-dated posts are automatically adjusted to the current time
   - Content is cleaned of HTML tags and CDATA sections

3. **Content Management**:
   - Each feed entry becomes a content file in Astro's content collection
   - Entries are automatically sorted by date
   - Duplicate entries are prevented using unique filenames

### Refreshing Feeds

To refresh the feeds:

```bash
npm run refresh
```

This will:

1. Clean the existing feed cache
2. Fetch fresh content from all feeds
3. Process and store the new entries

### Adding a New Feed

To add a new feed:

1. Edit `src/data/feeds.ts`
2. Add a new entry with:
   - `url`: The feed URL
   - `authorName`: The author's name
3. Run `npm run refresh` to fetch the new content

### Feed Entry Schema

Each feed entry contains:

```typescript
{
  title: string; // The entry title
  link: string; // URL to the original content
  pubDate: string; // ISO 8601 date string
  snippet: string; // Description or excerpt
  author: string; // Author's name
  feedSource: string; // Original feed URL
  lastFetched: string; // When the entry was last updated
}
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run refresh` - Refresh all feeds
- `npm run clean` - Clear feed cache

## Future Features

### Feed Management

- [ ] Web interface for managing feeds
- [ ] Feed health monitoring (detect dead feeds)
- [ ] Feed categories and tags
- [ ] Feed autodiscovery from URLs

### User Experience

- [ ] Search functionality
- [ ] Filter by author/source
- [ ] Read/unread tracking
- [ ] Favorite/bookmark system
- [ ] Share buttons

### Integrations

- [ ] Mastodon feed support
- [ ] GitHub activity feeds
- [ ] Twitter/X integration
- [ ] LinkedIn posts

### Performance

- [ ] Incremental feed updates
- [ ] Feed content caching
- [ ] Rate limiting for feed fetches

### Developer Experience

- [ ] Feed validation tools
- [ ] Better error reporting
- [ ] Testing utilities

### Deployment

- [ ] Periodic content fetching
- [ ] Automated backups
