/**
 * Shim for tailwindcss/resolveConfig (removed in Tailwind v4).
 * @gluestack-ui/utils uses it only to read theme.screens for useBreakpointValue.
 * We return default Tailwind breakpoints so gluestack's responsive hooks work.
 */
export default function resolveConfig() {
  return {
    theme: {
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
  };
}
