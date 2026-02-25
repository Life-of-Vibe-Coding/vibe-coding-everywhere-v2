import React, { useCallback, useMemo } from "react";
import { FlatList, Platform, StyleProp, type ViewStyle } from "react-native";
import type { PermissionDenial, Message } from "../../src/services/socket/hooks";
import { EntranceAnimation } from "../../src/design-system";
import { hasCodeBlockContent, hasFileActivityContent, MessageBubble } from "../../src/components/chat/MessageBubble";
import { TypingIndicator } from "../../src/components/chat/TypingIndicator";
import { PermissionDenialBanner } from "../../src/components/common/PermissionDenialBanner";
import type { BrandProvider } from "../../src/theme/index";

type ChatMessageListProps = {
  messages: Message[];
  provider: BrandProvider;
  typingIndicator: boolean;
  currentActivity: string | null;
  permissionDenials: PermissionDenial[];
  lastSessionTerminated: boolean;
  onOpenUrl: (url: string) => void;
  onFileSelect: (path: string) => void;
  onRetryPermission: () => void;
  onDismissPermission: () => void;
  tailBoxMaxHeight: number;
  flatListRef: React.RefObject<FlatList<Message>>;
  onContentSizeChange: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function ChatMessageList({
  messages,
  provider,
  typingIndicator,
  currentActivity,
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

  const useStreamingList =
    !!typingIndicator && displayMessages.length > 0 && displayMessages[displayMessages.length - 1]?.role === "assistant";

  const listIdsKey = useMemo(() => displayMessages.map((message) => message.id).join(","), [displayMessages]);

  const listDataStable = useMemo(
    () => displayMessages.slice(0, -1),
    [displayMessages.length, listIdsKey]
  );

  const chatListData = useStreamingList ? listDataStable : displayMessages;
  const flatListExtraData = useMemo(
    () => `${lastSessionTerminated}-${chatListData.length}`,
    [lastSessionTerminated, chatListData.length]
  );

  const renderMessageItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isLast = !useStreamingList && index === displayMessages.length - 1;
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
          isStreaming={typingIndicator && isLast && item.role === "assistant"}
        />
      );
    },
    [
      useStreamingList,
      displayMessages.length,
      lastSessionTerminated,
      provider,
      tailBoxMaxHeight,
      typingIndicator,
      onOpenUrl,
      onFileSelect,
    ]
  );

  const chatListFooter = useMemo(
    () => (
      <>
        {typingIndicator && (
          <EntranceAnimation variant="fade" duration={200}>
            <TypingIndicator visible provider={provider} activity={currentActivity} />
          </EntranceAnimation>
        )}
        {permissionDenials && permissionDenials.length > 0 && (
          <PermissionDenialBanner
            denials={permissionDenials}
            onDismiss={onDismissPermission}
            onAccept={onRetryPermission}
          />
        )}
      </>
    ),
    [
      typingIndicator,
      provider,
      currentActivity,
      permissionDenials,
      onDismissPermission,
      onRetryPermission,
    ]
  );

  const streamingFooterContent = useMemo(() => {
    const last = displayMessages[displayMessages.length - 1];
    if (!last) return chatListFooter;
    const hasCodeOrFileContent =
      hasFileActivityContent(last.content) || hasCodeBlockContent(last.content);
    const showTailBox = !!(last.content && last.content.trim()) && hasCodeOrFileContent;
    return (
      <>
        <MessageBubble
          message={last}
          isTerminatedLabel={false}
          showAsTailBox={showTailBox}
          tailBoxMaxHeight={tailBoxMaxHeight}
          provider={provider}
          onOpenUrl={onOpenUrl}
          onFileSelect={onFileSelect}
          isStreaming
        />
        {chatListFooter}
      </>
    );
  }, [
    displayMessages,
    chatListFooter,
    onFileSelect,
    onOpenUrl,
    provider,
    tailBoxMaxHeight,
  ]);

  const flatListFooterComponent = useStreamingList ? streamingFooterContent : chatListFooter;

  return (
    <FlatList
      key="chat"
      ref={flatListRef}
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      data={chatListData}
      extraData={flatListExtraData}
      keyExtractor={(item) => item.id}
      renderItem={renderMessageItem}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews={Platform.OS === "android"}
      ListFooterComponent={flatListFooterComponent}
      onContentSizeChange={() => {
        onContentSizeChange();
      }}
    />
  );
}
