// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://astoria-tech.github.io',
  base: '/subcurrent-astro',
  integrations: [
    react(),
    tailwind(),
    sitemap({
      // Generate sitemap for better SEO
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date(),
      // Filter out any admin or private pages if they exist
      filter: (page) => !page.includes('/admin/') && !page.includes('/private/'),
    }),
  ],
});
