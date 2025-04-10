import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks and strip styling
 *
 * @param htmlContent - The HTML content to sanitize
 * @returns Sanitized HTML that's safe to render and stripped of styling
 */
export function sanitizeHtml(htmlContent: string): string {
  // For empty content, return an empty string to avoid errors
  if (!htmlContent) return '';

  // Pre-clean HTML content before passing to DOMPurify
  const preprocessed = htmlContent
    // Remove any inline style attributes
    .replace(/\s+style=(['"]).*?\1/gi, '')
    // Remove any class attributes that might contain styling
    .replace(/\s+class=(['"]).*?\1/gi, '')
    // Fix quoted URLs in img tags - extract URL carefully
    .replace(/<img[^>]*src=[\\]?["']([^"']*)[\\]?["'][^>]*>/gi, (match, url) => {
      // Clean URL - remove quotes and fix trailing slashes
      const cleanUrl = url
        .replace(/&quot;/g, '')
        .replace(/\\["']/g, '')
        .replace(/["']/g, '')
        .replace(/\/$/, ''); // Remove trailing slash if present
      return `<img src="${cleanUrl}">`;
    })
    // Fix quoted URLs in a tags
    .replace(/<a[^>]*href=[\\]?["']([^"']*)[\\]?["'][^>]*>/gi, (match, url) => {
      const tagStart = match.slice(0, match.indexOf('href='));
      const tagEnd = match.slice(match.indexOf(url) + url.length + 1);
      return `${tagStart}href="${url.replace(/["']/g, '')}"${tagEnd}`;
    })
    // Preserve common entities that should render properly
    .replace(/&amp;([a-z]+);/gi, '&$1;') // Keep standard named entities
    // General cleanup of escaped quotes
    .replace(/&quot;/g, '"')
    .replace(/\\"/g, '"')
    .replace(/src="([^"]*)""/g, 'src="$1"')
    .replace(/href="([^"]*)""/g, 'href="$1"');

  // Configure DOMPurify options with focus on security
  const config = {
    ALLOWED_TAGS: [
      'b',
      'br',
      'code',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'i',
      'img',
      'li',
      'ol',
      'p',
      'pre',
      'span',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style', 'class'],
    USE_PROFILES: { html: true },
  };

  // Apply DOMPurify sanitization
  let sanitized = DOMPurify.sanitize(preprocessed, config);

  // Post-process to fix any remaining issues with quoted URLs
  sanitized = sanitized
    .replace(/src="([^"]*)&quot;\/"/g, 'src="$1"')
    .replace(/src="&quot;([^"]*)"/g, 'src="$1"')
    .replace(/src="([^"]*)&quot;"/g, 'src="$1"');

  // Final pass to fix trailing slashes in image URLs
  sanitized = sanitized.replace(/<img[^>]*src="([^"]+?)\/?"[^>]*>/g, (match, url) => {
    // Don't remove slashes that are part of the URL structure
    if (url.match(/\.(com|org|net|io|app|dev|co|me|blog|jpg|jpeg|png|gif|webp|svg|bmp)\//)) {
      return match; // Keep this slash as it's part of the domain/path structure
    }

    // Remove trailing slash for file extensions
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)\/$/i)) {
      return match.replace(`${url}/`, url);
    }

    return match;
  });

  // Wrap the content in a div with a special class
  // This helps us target it with CSS to ensure text colors are correct
  sanitized = `<div class="sanitized-content">${sanitized}</div>`;

  return sanitized;
}
