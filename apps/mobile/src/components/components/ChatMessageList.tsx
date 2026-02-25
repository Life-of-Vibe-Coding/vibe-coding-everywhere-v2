import React, { useCallback, useMemo } from "react";
import { Platform, type StyleProp, type ViewStyle, type FlatList as RNFlatList } from "react-native";
import { FlatList } from "@/components/ui/flat-list";
import type { PermissionDenial, Message } from "@/services/chat/hooks";
import { EntranceAnimation } from "@/design-system";
import { hasCodeBlockContent, hasFileActivityContent, MessageBubble } from "@/components/chat/MessageBubble";
import { PermissionDenialBanner } from "@/components/common/PermissionDenialBanner";
import type { Provider as BrandProvider } from "@/theme/index";

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
  index: number;
  total: number;
  lastSessionTerminated: boolean;
  tailBoxMaxHeight: number;
  provider: BrandProvider;
  onOpenUrl: (url: string) => void;
  onFileSelect: (path: string) => void;
};

function ChatMessageRow({
  item,
  index,
  total,
  lastSessionTerminated,
  tailBoxMaxHeight,
  provider,
  onOpenUrl,
  onFileSelect,
}: ChatMessageRowProps) {
  const isLast = index === total - 1;
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
}

export function ChatMessageList({
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
  const listIdsKey = useMemo(() => displayMessages.map((message) => message.id).join(","), [displayMessages]);

  const flatListExtraData = useMemo(
    () => `${lastSessionTerminated}-${displayMessages.length}-${listIdsKey}`,
    [lastSessionTerminated, displayMessages.length, listIdsKey]
  );

  const renderMessageItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      return (
        <ChatMessageRow
          item={item}
          index={index}
          total={displayMessages.length}
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
      keyExtractor={(item) => `${sessionScopedKey}:${item.id}`}
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
      onContentSizeChange={() => {
        onContentSizeChange();
      }}
    />
  );
}
