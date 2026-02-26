import React, { memo, useCallback, useMemo } from "react";
import { Platform, type StyleProp, type ViewStyle, type FlatList as RNFlatList } from "react-native";
import { FlatList } from "@/components/ui/flat-list";
import type { PermissionDenial, Message } from "@/services/chat/hooks";
import { EntranceAnimation } from "@/design-system";
import { hasCodeBlockContent, hasFileActivityContent, MessageBubble } from "@/components/chat/MessageBubble";
import { PermissionDenialBanner } from "@/components/common/PermissionDenialBanner";
import type { Provider as BrandProvider } from "@/constants/modelOptions";

type ChatMessageListProps = {
  messages: Message[];
  provider: BrandProvider;
  sessionId: string | null;
  permissionDenials: PermissionDenial[];
  lastSessionTerminated: boolean;
  onOpenUrl: (url: string) => void;
  onFileSelect: (path: string) => void;
  onRetryPermission: () => void;
  onDismissPermission: () => void;
  tailBoxMaxHeight: number;
  flatListRef: React.RefObject<RNFlatList<Message> | null>;
  onContentSizeChange: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type ChatMessageRowProps = {
  item: Message;
  isLast: boolean;
  lastSessionTerminated: boolean;
  tailBoxMaxHeight: number;
  provider: BrandProvider;
  onOpenUrl: (url: string) => void;
  onFileSelect: (path: string) => void;
};

const chatMessageRowRenderCounts = new Map<string, number>();

const ChatMessageRow = memo(function ChatMessageRow({
  item,
  isLast,
  lastSessionTerminated,
  tailBoxMaxHeight,
  provider,
  onOpenUrl,
  onFileSelect,
}: ChatMessageRowProps) {
  if (__DEV__) {
    const previous = chatMessageRowRenderCounts.get(item.id) ?? 0;
    const next = previous + 1;
    chatMessageRowRenderCounts.set(item.id, next);
    if (next === 1 || next % 25 === 0) {
      console.debug("[ChatMessageRow] render", item.id, { count: next });
    }
  }

  const showTerminated =
    lastSessionTerminated && isLast && item.role === "assistant" && !item.content;
  const hasCodeOrFileContent =
    hasFileActivityContent(item.content) || hasCodeBlockContent(item.content);
  const showTailBox =
    isLast &&
    item.role === "assistant" &&
    !!(item.content && item.content.trim()) &&
    hasCodeOrFileContent;

  return (
    <MessageBubble
      message={item}
      isTerminatedLabel={showTerminated}
      showAsTailBox={showTailBox}
      tailBoxMaxHeight={tailBoxMaxHeight}
      provider={provider}
      onOpenUrl={onOpenUrl}
      onFileSelect={onFileSelect}
    />
  );
}, (prev, next) => {
  if (prev.item.id !== next.item.id) return false;
  if (prev.item.role !== next.item.role) return false;
  if (prev.item.content !== next.item.content) return false;
  if ((prev.item.codeReferences?.length ?? 0) !== (next.item.codeReferences?.length ?? 0)) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.lastSessionTerminated !== next.lastSessionTerminated) return false;
  if (prev.tailBoxMaxHeight !== next.tailBoxMaxHeight) return false;
  if (prev.provider !== next.provider) return false;
  if (prev.onOpenUrl !== next.onOpenUrl) return false;
  if (prev.onFileSelect !== next.onFileSelect) return false;
  return (
    true
  );
});

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  provider,
  sessionId,
  permissionDenials,
  lastSessionTerminated,
  onOpenUrl,
  onFileSelect,
  onRetryPermission,
  onDismissPermission,
  tailBoxMaxHeight,
  flatListRef,
  onContentSizeChange,
  style,
  contentContainerStyle,
}: ChatMessageListProps) {
  const displayMessages = messages;

  const sessionScopedKey = useMemo(() => `chat-${sessionId ?? "none"}`, [sessionId]);
  const lastMessageId = displayMessages[displayMessages.length - 1]?.id ?? null;
  const flatListExtraData = useMemo(
    () => ({
      lastMessageId: lastMessageId ?? "none",
      permissionDenials: permissionDenials.length,
      lastSessionTerminated,
      tailBoxMaxHeight,
    }),
    [lastMessageId, permissionDenials.length, lastSessionTerminated, tailBoxMaxHeight]
  );
  const renderMessageItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isLast = index === displayMessages.length - 1;
      return (
        <ChatMessageRow
          item={item}
          isLast={isLast}
          lastSessionTerminated={lastSessionTerminated}
          tailBoxMaxHeight={tailBoxMaxHeight}
          provider={provider}
          onOpenUrl={onOpenUrl}
          onFileSelect={onFileSelect}
        />
      );
    },
    [displayMessages.length, lastSessionTerminated, provider, tailBoxMaxHeight, onOpenUrl, onFileSelect]
  );

  const chatListFooter = useMemo(
    () => (
      <>
        {permissionDenials && permissionDenials.length > 0 && (
          <PermissionDenialBanner
            denials={permissionDenials}
            onDismiss={onDismissPermission}
            onAccept={onRetryPermission}
          />
        )}
      </>
    ),
    [permissionDenials, onDismissPermission, onRetryPermission]
  );

  return (
    <FlatList
      key={sessionScopedKey}
      ref={flatListRef}
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      data={displayMessages}
      extraData={flatListExtraData}
      keyExtractor={(item) => item.id}
      renderItem={renderMessageItem}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews={Platform.OS === "android"}
      ListFooterComponent={
        <EntranceAnimation variant="fade" duration={200}>
          {chatListFooter}
        </EntranceAnimation>
      }
      onContentSizeChange={onContentSizeChange}
    />
  );
});
