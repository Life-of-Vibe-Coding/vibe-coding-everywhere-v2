# ShopHub Design System - Master

## Overview
Bold, modern e-commerce platform with a striking red theme designed to energize users and drive conversions.

## Color Palette

### Primary Colors
- **Primary Red**: `#DC2626` - Bold red for key elements
- **Secondary Red**: `#EF4444` - Bright red for accents
- **Accent Orange**: `#FB923C` - Warm accent color
- **CTA Yellow**: `#FBBF24` - High-contrast call-to-action

### Background & Cards
- **Background**: `#7F1D1D` - Deep red background with gradient
- **Card Background**: `#991B1B` - Dark red for glass cards
- **Card Hover**: `#B91C1C` - Lighter red on hover

### Text Colors
- **Text**: `#FEF2F2` - Light cream for primary text
- **Text Muted**: `#FCA5A5` - Muted red-pink for secondary text

## Typography

### Font Families
- **Heading**: Rubik (300, 400, 500, 600, 700)
- **Body**: Nunito Sans (300, 400, 500, 600, 700)

### Font Sizes
- **Hero Heading**: 3.5rem (56px) on desktop, 3rem (48px) on mobile
- **Section Heading**: 2.5rem (40px)
- **Card Title**: 1.25rem (20px)
- **Body Text**: 1rem (16px)
- **Small Text**: 0.875rem (14px)

### Line Heights
- Body text: 1.5-1.75 for optimal readability
- Headings: 1.2-1.3 for tight, impactful text

## Effects & Interactions

### Glass Morphism
```css
.glass-card {
  background: rgba(153, 27, 27, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(127, 29, 29, 0.3);
}
```

### Transitions
- **Standard**: 200ms ease-in-out
- **Micro-interactions**: 150-300ms
- **Hover effects**: Scale 1.02-1.10, no layout shift

### Shadows
- **Card Default**: shadow-lg
- **Card Hover**: shadow-2xl
- **CTA Buttons**: shadow-lg → shadow-xl on hover

## Components

### Buttons
- Primary CTA: Gradient from yellow to orange (`from-cta to-accent`)
- Hover: Reverse gradient, scale 1.05
- Focus: 2px yellow outline with offset
- Min touch target: 44x44px

### Cards
- Glass effect with backdrop blur
- Rounded corners: 1rem (16px)
- Hover: Lift effect (scale 1.02), enhanced shadow
- Border: Subtle red glow

### Navigation
- Fixed with spacing from edges (top-4, left-4, right-4)
- Glass background
- Active link: Underline animation from left to right

## Accessibility

### Color Contrast
- Text on background: 4.5:1 minimum (WCAG AA)
- All interactive elements have visible focus states
- Icons include aria-hidden="true", labels on buttons

### Keyboard Navigation
- Tab order follows visual hierarchy
- Focus rings visible (yellow outline)
- All clickable elements have cursor-pointer

### Motion
- Respects `prefers-reduced-motion`
- All animations can be disabled

## Layout

### Max Width
- Content container: 1280px (max-w-7xl)

### Spacing
- Section gaps: 5rem (80px)
- Card gaps: 1.5rem (24px)
- Internal padding: 1.5rem (24px)

### Responsive Breakpoints
- Mobile: 375px+
- Tablet: 768px+
- Desktop: 1024px+
- Wide: 1440px+

## Best Practices

### DO
✅ Use gradient CTAs for maximum visibility
✅ Apply glass effect to all cards
✅ Provide smooth transitions (200ms)
✅ Add aria-labels to icon-only buttons
✅ Use cursor-pointer on all clickables
✅ Include hover states with visual feedback
✅ Test both light and dark mode
✅ Use semantic HTML (nav, article, footer)

### DON'T
❌ Use emojis as UI icons (use Lucide icons instead)
❌ Create layout shifts on hover
❌ Set transitions longer than 300ms
❌ Forget focus states
❌ Mix different icon sets
❌ Use insufficient color contrast
❌ Assume default 3000ms port
❌ Hardcode localhost in API URLs

## Performance

### Images
- Use Next.js Image component
- Provide responsive sizes
- Lazy load below fold
- WebP format preferred

### Fonts
- Preload critical fonts
- Use font-display: swap
- Subset to required characters

### Bundle
- Code split by route
- Lazy load heavy components
- Tree-shake unused utilities

---

**Last Updated**: February 22, 2026  
**Version**: 1.0.0
