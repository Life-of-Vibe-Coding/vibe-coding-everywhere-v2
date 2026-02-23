# gluestack-ui Components Reference

Use this for code generation. Import path: `@/components/ui/<component>` or `../../../components/ui/<component>` relative to `apps/mobile/src`.

---

## All Components Metadata

| Component | Title | Description |
|-----------|-------|-------------|
| accordion | Accordion | A collapsible component for Expo, React & React Native that displays expandable and collapsible sections. |
| actionsheet | Actionsheet | A bottom sheet component for Expo, React & React Native that displays a set of options. |
| alert-dialog | AlertDialog | A dialog component that interrupts users with important content requiring immediate attention and action |
| alert | Alert | A notification component that provides contextual feedback messages with React Native properties. |
| avatar | Avatar | Avatar component with support for images, text fallbacks, and status indicators. |
| badge | Badge | Status indicator component that highlights information with React Native properties. |
| box | Box | Renders as `<div>` on web and `<View>` on native. Accepts standard layout props and className for styling. |
| button | Button | Interactive component for triggering actions with React Native properties and className styling. |
| center | Center | Centers children horizontally and vertically. Renders as `<div>` on web and `<View>` on native. |
| checkbox | Checkbox | A form control component for React & React Native that allows users to select multiple options. |
| divider | Divider | A separator component for React & React Native that visually separates content in a layout. |
| drawer | Drawer | A responsive Drawer component that provides a sliding panel for navigation or content. |
| fab | Fab | A floating action button component for React & React Native with customizable properties. |
| form-control | FormControl | A component to build accessible form fields with labels, helper text, and error handling. |
| grid | Grid | A flexible layout component that creates responsive grid layouts. |
| heading | Heading | A customizable heading component with various size options. |
| hstack | HStack | A layout component that arranges children horizontally with customizable spacing. |
| icon | Icon | A scalable icon component with built-in icons collection. |
| image | Image | Image component with React Native properties and className styling. |
| input | Input | A flexible input component with validation and styling options. |
| link | Link | A navigation component that directs users to different pages or external resources. |
| menu | Menu | Menu component for dropdown options. |
| modal | Modal | A responsive overlay component for alerts, forms, and notifications. |
| popover | Popover | A contextual overlay component that displays information, controls, or forms. |
| portal | Portal | Renders content outside the parent component's DOM hierarchy. |
| pressable | Pressable | Touchable component with interaction states and React Native properties. |
| progress | Progress | A visual indicator component that displays the progress of an operation. |
| radio | Radio | A radio button component that allows users to select a single option. |
| scroll-view | ScrollView | A scrollable container component. |
| skeleton | Skeleton | A loading state component that improves UX during content loading. |
| slider | Slider | A customizable slider component for selecting a value from a range. |
| switch | Switch | Toggle component with className styling support. |
| table | Table | A tabular data component that displays information in rows and columns. |
| text | Text | Inherits all Text component properties with multiple styling options via classNames. |
| textarea | Textarea | A multi-line input component with customizable properties. |
| tooltip | Tooltip | Displays informative text when users hover or focus on an element. |
| vstack | VStack | A layout component that arranges children vertically with customizable spacing. |

---

## Selected Component Docs (Button, Input, Actionsheet, Badge, Modal, VStack, HStack)

### Button

```jsx
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";

<Button action="primary" variant="solid" size="md" isDisabled={false}>
  <ButtonText>Hello World!</ButtonText>
</Button>
```

**Props:** `action`: primary | secondary | positive | negative | default · `variant`: link | outline | solid · `size`: xs | sm | md | lg | xl

---

### Input

```jsx
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";

<Input variant="outline" size="md">
  <InputSlot className="pl-3">
    <InputIcon as={SearchIcon} />
  </InputSlot>
  <InputField placeholder="Enter text..." />
</Input>
```

**Props:** `variant`: underlined | outline | rounded · `size`: sm | md | lg | xl

---

### Actionsheet

```jsx
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";

<Actionsheet isOpen={show} onClose={() => setShow(false)}>
  <ActionsheetBackdrop />
  <ActionsheetContent>
    <ActionsheetDragIndicatorWrapper>
      <ActionsheetDragIndicator />
    </ActionsheetDragIndicatorWrapper>
    <ActionsheetItem onPress={handleClose}>
      <ActionsheetItemText>Option 1</ActionsheetItemText>
    </ActionsheetItem>
  </ActionsheetContent>
</Actionsheet>
```

**Props:** `isOpen`, `onClose`, `snapPoints` (default [50]) · Set maxHeight on ActionsheetContent if no snapPoints.

---

### Badge

```jsx
import { Badge, BadgeText, BadgeIcon } from "@/components/ui/badge";

<Badge action="success" variant="solid" size="md">
  <BadgeText>Verified</BadgeText>
  <BadgeIcon as={GlobeIcon} className="ml-2" />
</Badge>
```

**Props:** `action`: error | warning | success | info | muted · `variant`: solid | outline · `size`: sm | md | lg

---

### Modal

```jsx
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@/components/ui/modal";
```

---

### VStack / HStack

```jsx
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";

<VStack space="md" reversed={false}>
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</VStack>

<HStack space="lg">
  <Button>Left</Button>
  <Button>Right</Button>
</HStack>
```

**space:** xs | sm | md | lg | xl | 2xl | 3xl | 4xl

---

## Styling Rules

- Use `className` with Tailwind/Uniwind utilities, not StyleSheet
- Semantic tokens: `bg-primary-500`, `text-typography-900`, `bg-background-muted`, `border-outline-100`
- Import from `@/components/ui/<name>` or relative `../../../components/ui/<name>`
- Prefer VStack/HStack over Box for layout
- Images: use unsplash.com only
