# React Native Design System

A comprehensive, accessible, and performant design system for React Native applications.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Theme System](#theme-system)
4. [Components](#components)
5. [Animation System](#animation-system)
6. [Performance](#performance)
7. [Accessibility](#accessibility)
8. [Best Practices](#best-practices)

## Overview

This design system provides:

- **WCAG 2.1 AA compliant** color contrast ratios
- **60fps optimized** animations using Reanimated 3
- **Responsive typography** with proper scaling
- **Dark/Light mode** support with system preference detection
- **Haptic feedback** integration
- **8px grid spacing** system
- **Modular architecture** for tree-shaking

## Installation

The design system is included in the project. Import components from the design-system directory:

```tsx
import { 
  ModernThemeProvider, 
  Button, 
  Card, 
  Typography,
  triggerHaptic 
} from './src/design-system';
```

### Dependencies

Ensure you have the following dependencies installed:

```json
{
  "react-native-reanimated": "~3.17.4",
  "react-native-gesture-handler": "~2.20.2",
  "expo-haptics": "~14.1.4",
  "expo-image": "~3.0.11"
}
```

## Theme System

### Theme Provider

Wrap your app with the `ModernThemeProvider`:

```tsx
import { ModernThemeProvider } from './src/design-system';

function App() {
  return (
    <ModernThemeProvider 
      provider="gemini" 
      mode="system"
      onProviderChange={(p) => console.log('Provider:', p)}
      onModeChange={(m) => console.log('Mode:', m)}
    >
      <YourApp />
    </ModernThemeProvider>
  );
}
```

### Theme Configuration

#### Providers

- `gemini` - Google Blue accent (#1a73e8)
- `claude` - Orange accent (#b3541e)

#### Color Modes

- `light` - Light color scheme
- `dark` - Dark color scheme
- `system` - Follows OS preference

### Using the Theme

```tsx
import { useTheme, useColors, useTypography } from './src/design-system';

function MyComponent() {
  const theme = useTheme();
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ fontSize: typography.body.fontSize }}>
        Hello World
      </Text>
    </View>
  );
}
```

## Components

### Typography

```tsx
import { Typography } from './src/design-system';

<Typography variant="title1" tone="accent" align="center">
  Hello World
</Typography>
```

**Variants:** `display`, `title1`, `title2`, `title3`, `headline`, `body`, `bodyStrong`, `callout`, `subhead`, `footnote`, `caption`, `caption2`, `label`, `mono`

**Tones:** `primary`, `secondary`, `tertiary`, `muted`, `inverse`, `accent`, `danger`, `success`, `warning`

### Button

```tsx
import { Button } from './src/design-system';

<Button
  label="Press Me"
  onPress={() => console.log('Pressed!')}
  variant="primary"
  size="md"
  haptic="selection"
/>
```

**Variants:** `primary`, `secondary`, `tertiary`, `ghost`, `danger`, `success`

**Sizes:** `xs`, `sm`, `md`, `lg`, `xl`

**Haptic Types:** `light`, `medium`, `heavy`, `success`, `warning`, `error`, `selection`

### IconButton

```tsx
import { IconButton } from './src/design-system';

<IconButton
  icon={<MyIcon />}
  onPress={() => {}}
  accessibilityLabel="Close"
/>
```

### Card

```tsx
import { Card } from './src/design-system';

<Card variant="elevated" padding="4" onPress={() => {}}>
  <Typography variant="title3">Card Title</Typography>
  <Typography variant="body">Card content goes here.</Typography>
</Card>
```

**Variants:** `default`, `elevated`, `outlined`, `ghost`

### Input

```tsx
import { Input } from './src/design-system';

<Input
  label="Email"
  placeholder="Enter your email"
  error={emailError}
  helper="We'll never share your email"
  leading={<EmailIcon />}
  hapticOnFocus
/>
```

### Badge

```tsx
import { Badge } from './src/design-system';

<Badge label="New" variant="accent" size="md" dot />
```

**Variants:** `default`, `accent`, `success`, `danger`, `warning`, `info`

### Avatar

```tsx
import { Avatar } from './src/design-system';

<Avatar source={{ uri: 'https://...' }} size="md" />
<Avatar name="John Doe" size="lg" />
```

**Sizes:** `xs`, `sm`, `md`, `lg`, `xl`

### Chip

```tsx
import { Chip } from './src/design-system';

<Chip
  label="React Native"
  selected={isSelected}
  onPress={() => setSelected(!isSelected)}
  onRemove={() => removeChip()}
/>
```

### ListItem

```tsx
import { ListItem } from './src/design-system';

<ListItem
  title="Item Title"
  subtitle="Item description"
  leading={<Icon />}
  trailing={<Chevron />}
  onPress={() => {}}
/>
```

## Animation System

### Haptic Feedback

```tsx
import { triggerHaptic } from './src/design-system';

// Trigger haptic feedback
triggerHaptic('success');
triggerHaptic('error');
triggerHaptic('light');
```

### Animated Pressable

```tsx
import { AnimatedPressableView } from './src/design-system';

<AnimatedPressableView
  onPress={() => {}}
  haptic="selection"
  scaleTo={0.96}
  style={{ padding: 16 }}
>
  <Text>Press me</Text>
</AnimatedPressableView>
```

### Skeleton Loading

```tsx
import { Skeleton, SkeletonText, SkeletonCard } from './src/design-system';

// Basic skeleton
<Skeleton width="100%" height={20} />

// Text skeleton with multiple lines
<SkeletonText lines={3} lineHeight={16} />

// Card skeleton
<SkeletonCard hasImage imageHeight={120} lines={2} />
```

### Entrance Animations

```tsx
import { EntranceAnimation, StaggeredList } from './src/design-system';

// Single element entrance
<EntranceAnimation variant="slideUp" delay={200}>
  <MyComponent />
</EntranceAnimation>

// Staggered list
<StaggeredList
  data={items}
  renderItem={(item) => <ListItem {...item} />}
  keyExtractor={(item) => item.id}
  staggerDelay={50}
/>
```

**Animation Variants:** `fade`, `scale`, `slideUp`, `slideDown`, `slideLeft`, `slideRight`, `bounce`

### Progressive Image

```tsx
import { ProgressiveImage } from './src/design-system';

<ProgressiveImage
  source={{ uri: 'https://...' }}
  style={{ width: 200, height: 200 }}
  contentFit="cover"
  transitionDuration={300}
/>
```

### Typing Indicator

```tsx
import { TypingDots } from './src/design-system';

<TypingDots dotSize={8} dotColor="#666" />
```

## Performance

### Performance Monitoring

```tsx
import { usePerformanceMonitor } from './src/design-system';

function MyComponent() {
  const metrics = usePerformanceMonitor(true);
  
  console.log(`FPS: ${metrics.currentFps}`);
  console.log(`Average: ${metrics.averageFps}`);
  console.log(`Dropped Frames: ${metrics.droppedFrames}`);
  console.log(`Jank Score: ${metrics.jankScore}`);
  
  return <View>...</View>;
}
```

### Spring Configurations

```tsx
import { springConfigs } from './src/design-system';

// Available configurations:
// - snappy: Fast, responsive
// - standard: Balanced
// - gentle: Smooth, elegant
// - bouncy: Playful
// - dramatic: Slow, emphasis
```

### Animation Timing

```tsx
import { motion, easings } from './src/design-system';

// Duration presets:
// - motion.instant: 80ms
// - motion.fast: 140ms
// - motion.normal: 220ms
// - motion.slow: 360ms
// - motion.deliberate: 500ms

// Easing functions:
// - easings.linear
// - easings.easeIn
// - easings.easeOut
// - easings.easeInOut
// - easings.spring
```

## Accessibility

### WCAG 2.1 AA Compliance

The design system ensures:

- **Color Contrast:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Touch Targets:** Minimum 44x44 points
- **Focus Indicators:** Visible focus states
- **Semantic Markup:** Proper accessibility roles

### Accessibility Props

All components support:

```tsx
<Button
  label="Submit"
  accessibilityLabel="Submit form"
  accessibilityHint="Double tap to submit the form"
  accessibilityState={{ disabled: false, busy: loading }}
/>
```

### Screen Reader Support

- All interactive elements have proper labels
- Dynamic content announces changes
- Error states are communicated clearly

## Best Practices

### 1. Use Semantic Colors

```tsx
// ✅ Good
<View style={{ backgroundColor: colors.surface }} />

// ❌ Bad
<View style={{ backgroundColor: '#ffffff' }} />
```

### 2. Responsive Typography

```tsx
// ✅ Good
<Typography variant="body">Text</Typography>

// ❌ Bad
<Text style={{ fontSize: 16 }}>Text</Text>
```

### 3. Consistent Spacing

```tsx
import { spacing } from './src/design-system';

// ✅ Good
<View style={{ padding: spacing['4'] }} />

// ❌ Bad
<View style={{ padding: 20 }} />
```

### 4. Haptic Feedback

```tsx
// ✅ Good
<Button haptic="success" onPress={onSuccess} />

// ❌ Bad (no feedback)
<Button onPress={onSuccess} />
```

### 5. Loading States

```tsx
// ✅ Good
{loading ? (
  <SkeletonCard />
) : (
  <Card>...</Card>
)}
```

## Performance Benchmarks

### Frame Rates

- Target: 60fps on modern devices
- Minimum: 55fps on older devices
- Animation jank: <5% dropped frames

### Memory Usage

- Base theme: ~20KB
- Full component library: ~150KB
- Tree-shakeable: Yes

### Bundle Size

- Design System: ~50KB gzipped
- Animations: ~30KB gzipped
- Total impact: ~80KB gzipped

## Migration Guide

### From Legacy Components

Old:
```tsx
import { AppButton, AppCard } from './src/design-system';
```

New:
```tsx
import { Button, Card } from './src/design-system';
```

### Theme Migration

Old:
```tsx
import { ThemeProvider, getTheme } from './src/theme';
```

New:
```tsx
import { ModernThemeProvider, useTheme } from './src/design-system';
```

## Troubleshooting

### Animations not working

1. Ensure Reanimated is properly configured in `babel.config.js`:
```js
module.exports = {
  plugins: ['react-native-reanimated/plugin'],
};
```

2. Clear Metro bundler cache: `npx expo start --clear`

### Haptics not working

- Haptics require a physical device (not simulator)
- Check if device supports haptic feedback

### Dark mode not switching

- Ensure you're using `useTheme()` hook
- Check system preferences

## Contributing

When adding new components:

1. Follow the existing patterns
2. Add TypeScript types
3. Include haptic feedback for interactions
4. Ensure accessibility props
5. Add to this documentation
