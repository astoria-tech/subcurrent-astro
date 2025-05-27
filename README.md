# Subcurrent

A content aggregator for the Astoria Tech community, built with Astro.

## Features

### Content Processing

- Aggregates content from multiple sources (RSS, Atom, and YouTube feeds)
- Automatically handles different feed formats
- Advanced HTML sanitization and content security with DOMPurify
- Intelligent image extraction from multiple RSS formats (media:content, media:thumbnail, enclosure)
- Prevents future-dated posts
- Unified RSS export for all aggregated content

### User Interface

- Clean, modern UI with dark mode
- Mobile-friendly design

### Discord Integration

- Automated Discord notifications with rich embeds and rate limiting
- Rich embeds with content previews
- Author attribution and source links
- Image thumbnails when available
- Rate limiting (max 5 notifications per run)
- Duplicate prevention using post tracking
- Manual triggering via `npm run notify-discord`

## Technology Stack

- **Framework**: Astro 5.3.0
- **Frontend**: React 19.0.0, TypeScript 5.8.2
- **Styling**: Tailwind CSS 3.4.1
- **Content Processing**: fast-xml-parser 5.2.0, isomorphic-dompurify 2.22.0
- **RSS Generation**: @astrojs/rss 4.0.11
- **Code Quality**: ESLint, Prettier, Knip
- **Icons**: Lucide React 0.479.0

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
       url: 'https://example.com/feed.xml',
       authorName: 'Author Name',
     },
   ];
   ```

   **Current Feed Sources:**

   - Ash Ryan Arnwine (ashryan.io)
   - Nicolas F. R. A. Prado (nfraprado.net)
   - Jawaun (jtbx.substack.com)
   - The Underlying (theunderlying.substack.com)
   - meremortaldev YouTube channel

2. **Feed Processing**:

   - Feeds are fetched and processed using `src/utils/feedCollector.ts`
   - Each feed entry is stored as a JSON file in `src/content/feeds/`
   - Advanced HTML sanitization using DOMPurify for content security
   - Intelligent image extraction from multiple RSS formats:
     - `media:content` and `media:thumbnail` elements
     - `enclosure` attributes for media files
     - HTML content parsing for embedded images
   - The system handles various date formats and ensures dates are valid
   - Future-dated posts are automatically adjusted to the current time
   - Content preprocessing including CDATA handling and HTML cleaning

3. **Content Management**:

   - Each feed entry becomes a content file in Astro's content collection
   - Entries are automatically sorted by date
   - Duplicate entries are prevented using unique filenames
   - Unified RSS export available at `/rss.xml` for all aggregated content

4. **Discord Integration**:
   - Automated Discord notifications for new feed entries
   - Rich embeds with titles, descriptions, authors, and images
   - Rate limiting and duplicate prevention
   - Configurable via `DISCORD_WEBHOOK_URL` environment variable
   - Manual triggering available via `npm run notify-discord`

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
  imageUrl?: string; // Optional image URL extracted from feed content
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
- `npm run fetch` - Fetch feeds without clearing cache
- `npm run clean` - Clear feed cache
- `npm run notify-discord` - Send Discord notifications for new content
- `npm run lint` - Run ESLint code quality checks
- `npm run knip` - Find unused files and dependencies

## Architecture

### Data Flow Pipeline

1. **Feed Collection**: `fetchFeeds.ts` orchestrates the collection process
2. **Feed Processing**: `feedCollector.ts` handles individual feed parsing and content extraction
3. **Content Security**: `sanitizeHtml.ts` ensures safe HTML content using DOMPurify
4. **Storage**: Processed entries are stored as JSON files in `src/content/feeds/`
5. **Site Generation**: Astro builds the static site with all aggregated content
6. **RSS Export**: Unified RSS feed is generated at `/rss.xml`
7. **Discord Notifications**: `discordNotifier.ts` sends notifications for new content

## Discord Notifications

The Discord integration automatically notifies your server when new content is aggregated:

### Setup

1. Create a Discord webhook in your server
2. Set the `DISCORD_WEBHOOK_URL` environment variable
3. New content will automatically trigger notifications

For detailed setup instructions, see [`docs/DISCORD_NOTIFICATIONS.md`](docs/DISCORD_NOTIFICATIONS.md).

## SEO Strategy

Subcurrent implements comprehensive SEO optimization with a dual focus: making the Astoria Tech community discoverable while driving traffic back to original authors. Our community-first, additive approach to content aggregation ensures that authors receive proper attribution and traffic benefits.

### SEO Strategy Overview

The SEO implementation balances two key objectives:

- **Community Visibility**: Making Subcurrent discoverable to help grow the Astoria Tech community
- **Author Support**: Driving traffic back to original content creators through proper attribution and links

This community-first approach ensures that content aggregation is additive rather than competitive, supporting authors while building community awareness.

### Implemented SEO Features

#### Social Media Integration

- **Open Graph Tags**: Rich social media previews with titles, descriptions, and images
- **Twitter Cards**: Optimized Twitter/X sharing with proper card formatting
- Enhanced social sharing across all major platforms

#### Structured Data

- **JSON-LD Schemas**: Comprehensive structured data implementation
  - **Organization Schema**: Defines Subcurrent as a tech community organization
  - **CollectionPage Schema**: Marks the main page as a curated content collection
  - **BlogPosting Schema**: Individual entries with proper author attribution
- **Author Attribution**: Ensures proper author crediting in search engine results
- **Geographic Targeting**: NYC/Astoria location data for local tech community discovery

#### Technical SEO

- **robots.txt**: Search engine crawl guidance and sitemap location
- **Automated Sitemap**: Dynamic sitemap generation for all content
- **Canonical URLs**: Prevents duplicate content issues
- **Meta Tag Optimization**: Enhanced descriptions targeting NYC/Astoria tech keywords

### SEO Files

Key SEO implementation files:

- [`public/robots.txt`](public/robots.txt:1) - Search engine crawl guidance and sitemap reference
- Automated sitemap generation enabled in [`astro.config.mjs`](astro.config.mjs:1)
- Structured data implementation in [`src/pages/index.astro`](src/pages/index.astro:1) and [`src/layouts/Layout.astro`](src/layouts/Layout.astro:1)
- Social media meta tags across all page templates

### SEO Goals

The SEO strategy directly supports Subcurrent's community mission:

- **Community Growth**: Improved discoverability helps new members find the Astoria Tech community
- **Author Traffic**: Structured data and attribution drive search traffic to original content creators
- **Local Focus**: Geographic targeting connects NYC-area developers and tech professionals
- **Content Quality**: Proper schema markup improves content presentation in search results

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
