import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Box } from "@/components/ui/box";
import type { CodeRefPayload } from "@/components/file/FileViewerModal";
import { FileViewerModal } from "@/components/file/FileViewerModal";

type FileViewerPageProps = {
  isOpen: boolean;
  style?: StyleProp<ViewStyle>;
  path: string;
  content: string | null;
  isImage: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAddCodeReference: (ref: CodeRefPayload) => void;
};

export function FileViewerPage({
  isOpen,
  style,
  path,
  content,
  isImage,
  loading,
  error,
  onClose,
  onAddCodeReference,
}: FileViewerPageProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Box style={style} pointerEvents="box-none">
      <FileViewerModal
        isOpen
        embedded
        path={path}
        content={content}
        isImage={isImage}
        loading={loading}
        error={error}
        onClose={onClose}
        onAddCodeReference={onAddCodeReference}
      />
    </Box>
  );
}
