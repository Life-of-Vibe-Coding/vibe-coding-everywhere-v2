import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Box } from "../ui/box";
import type { CodeRefPayload } from "../file/FileViewerModal";
import { FileViewerModal } from "../file/FileViewerModal";

type FileViewerOverlayProps = {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  path: string;
  content: string | null;
  isImage: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAddCodeReference: (ref: CodeRefPayload) => void;
};

export function FileViewerOverlay({
  visible,
  style,
  path,
  content,
  isImage,
  loading,
  error,
  onClose,
  onAddCodeReference,
}: FileViewerOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <Box style={style} pointerEvents="box-none">
      <FileViewerModal
        visible
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
