# gluestack-ui + Uniwind

This project uses **gluestack-ui** with **Uniwind** (Tailwind 4 for React Native) instead of NativeWind.

## Setup

- `GluestackUIProvider` wraps the app in `index.ts` with `mode="system"` (follows device light/dark)
- gluestack design tokens are defined in `global.css` via `@layer theme` and `@variant light`/`@variant dark`
- Theme switching: `Uniwind.setTheme('light' | 'dark' | 'system')`

## Adding Components

```bash
npx gluestack-ui add box
npx gluestack-ui add button
npx gluestack-ui add input
# or add all
npx gluestack-ui add --all
```

Components are added under `components/ui/` and use Tailwind/Uniwind classes.

## Usage Example

```tsx
import { Box, Text } from '../ui/box'; // or your added component path

export function MyScreen() {
  return (
    <Box className="flex-1 p-4 bg-background-0">
      <Text className="text-typography-900">Hello</Text>
    </Box>
  );
}
```

## Styling

- Use `className` with Tailwind utilities: `className="flex-1 p-4 bg-background-100"`
- gluestack semantic tokens: `bg-primary-500`, `text-typography-900`, `bg-background-muted`, etc.
- Uniwind theme variants apply automatically based on `Uniwind.setTheme()`
