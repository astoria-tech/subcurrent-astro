/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class", // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Rich, deep background colors
        dark: {
          bg: "#0A0A16", // Slightly blue-tinted dark background
          surface: "#12121F", // Slightly elevated surfaces
          border: "#2A2A3F", // Subtle blue-tinted borders
        },
        // Accent colors
        accent: {
          primary: "#6366F1", // Indigo
          secondary: "#8B5CF6", // Purple
          muted: "#4F46E5", // Darker indigo
        },
        // Text colors
        content: {
          primary: "#F8F8FF", // Off-white
          secondary: "#B4B4ED", // Light purple-tinted
          muted: "#7171A6", // Medium purple-tinted
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
