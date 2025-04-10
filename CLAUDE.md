# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands
- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npm run fetch` - Fetch RSS feeds
- `npm run clean` - Clean feed content
- `npm run refresh` - Clean and fetch feeds
- `npm run notify-discord` - Send notifications to Discord

## Linting and Formatting
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Automatically fix ESLint issues
- `npm run lint:clean` - Fix ESLint issues and run Prettier
- `npm run knip` - Analyze unused dependencies

## Code Style Guidelines
- **TypeScript**: Use strict mode with proper typing
- **Formatting**: 2 space indentation, 100 char line limit, single quotes
- **Naming**: camelCase for variables/functions, PascalCase for interfaces/components
- **Error handling**: Use try/catch with specific error logging
- **Imports**: Node.js native modules first, then external packages
- **Components**: Astro components with React integration where needed
- **Astro-specific**: Follow recommended plugin rules and JSX standards