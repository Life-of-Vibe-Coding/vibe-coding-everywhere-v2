import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#DC2626',     // Bold red
        secondary: '#EF4444',    // Bright red
        accent: '#FB923C',       // Orange accent
        cta: '#FBBF24',         // Yellow CTA for contrast
        background: '#7F1D1D',   // Deep red background
        'card-bg': '#991B1B',    // Dark red for cards
        'card-hover': '#B91C1C', // Lighter red for hover
        text: '#FEF2F2',        // Light cream text
        'text-muted': '#FCA5A5', // Muted red-pink
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Rubik', 'sans-serif'],
        body: ['var(--font-body)', 'Nunito Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
