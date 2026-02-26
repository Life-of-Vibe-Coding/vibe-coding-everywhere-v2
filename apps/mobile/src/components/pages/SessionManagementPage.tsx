import React from "react";
import { Box } from "@/components/ui/box";
import { SessionManagementModal, type SessionManagementModalProps } from "@/components/chat/SessionManagementModal";

type SessionManagementPageProps = Omit<SessionManagementModalProps, "embedded">;

export function SessionManagementPage({
  isOpen,
  ...props
}: SessionManagementPageProps) {
  if (!isOpen) return null;

  return (
    <Box className="flex-1 bg-surface-base">
      <SessionManagementModal isOpen embedded {...props} />
    </Box>
  );
}
