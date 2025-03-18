import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { sanitizeHtml } from '../utils/sanitizeHtml';

// Helper to clean image URLs as done in the main page
function fixImageUrls(htmlContent) {
  if (!htmlContent) return '';

  // Use the same replacements as in the main page
  return htmlContent
    .replace(/<img[^>]*src="([^"]*?)&quot;\/(.*?)"[^>]*>/g, '<img src="$1$2">')
    .replace(/<img[^>]*src="&quot;([^"]*?)(\/|)"[^>]*>/g, '<img src="$1">')
    .replace(/<img[^>]*src="([^"]*?)&quot;(\/|)"[^>]*>/g, '<img src="$1">')
    .replace(/src="([^"]*)&quot;/g, 'src="$1')
    .replace(/src="&quot;/g, 'src="')
    .replace(/src="([^"]+?)\/"/g, (match, url) => {
      if (url.match(/\.(com|org|net|io|app|dev|co|me|blog)\//)) {
        return match;
      }
      return `src="${url}"`;
    });
}

export async function GET(context) {
  const entries = await getCollection('feeds');
  const feedItems = entries
    .map((entry) => ({
      ...entry.data,
      // Clean up the snippet for RSS content
      content: entry.data.snippet ? fixImageUrls(sanitizeHtml(entry.data.snippet)) : '',
    }))
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return rss({
    title: 'Subcurrent | Astoria Tech Meetup',
    description: 'A content aggregator for the Astoria Tech Meetup community',
    site: context.site,
    items: feedItems.map((item) => ({
      title: item.title,
      pubDate: new Date(item.pubDate),
      description: item.content,
      link: item.link,
      author: item.author,
    })),
    customData: `<language>en-us</language>`,
    stylesheet: '/subcurrent-astro/rss/styles.xsl', // Updated to include base path
  });
}
