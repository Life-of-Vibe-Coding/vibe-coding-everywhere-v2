export const RESTRICTED_PRIMITIVES = [
  'View',
  'Text',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'ScrollView',
  'FlatList',
  'SectionList',
  'VirtualizedList',
  'Modal',
  'TextInput',
  'Image',
  'ImageBackground',
  'SafeAreaView',
  'ActivityIndicator',
  'Switch',
  'KeyboardAvoidingView',
  'RefreshControl',
  'StatusBar',
  'Alert',
];

export const APPROVED_REACT_NATIVE_NON_PRIMITIVES = [
  'AccessibilityInfo',
  'Animated',
  'Dimensions',
  'InteractionManager',
  'Keyboard',
  'LayoutAnimation',
  'Linking',
  'Platform',
  'StyleSheet',
  'UIManager',
  'useWindowDimensions',
];

export const ALLOWLIST_DIRS = [
  'src/components/ui/',
  'src/components/ui/_migration/',
  'src/components/icons/',
  'src/design-system/',
  'src/theme/',
  'src/lib/',
  'src/services/',
  'src/core/',
  'src/state/',
  'src/constants/',
  'src/data/',
  'src/features/',
  'src/utils/',
];

export function shouldScan(relPath) {
  if (!relPath.startsWith('src/components/')) return false;
  if (!relPath.endsWith('.ts') && !relPath.endsWith('.tsx')) return false;
  if (relPath.includes('__tests__/') || relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx')) return false;
  return !ALLOWLIST_DIRS.some((prefix) => relPath.startsWith(prefix));
}
