import React from "react";
import { Box } from "@/components/ui/box";
import type { CodeRefPayload } from "@/components/file/FileViewerModal";
import { FileViewerModal } from "@/components/file/FileViewerModal";
import { SafeAreaView } from "react-native-safe-area-context";

type FileViewerPageProps = {
  isOpen: boolean;
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
  path,
  content,
  isImage,
  loading,
  error,
  onClose,
  onAddCodeReference,
}: FileViewerPageProps) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
      <Box className="flex-1">
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
    </SafeAreaView>
  );
}
