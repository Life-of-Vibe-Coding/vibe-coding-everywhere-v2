import React from "react";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/theme/index";
import type { StyleProp, ViewStyle } from "react-native";

type ListSectionCardProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function ListSectionCard({
  title,
  subtitle,
  action,
  footer,
  children,
  className,
  style,
}: ListSectionCardProps) {
  const theme = useTheme();

  return (
    <Card
      className={["border border-outline-100 rounded-xl", className ?? ""].join(" ")}
      style={style}
    >
      <VStack space="md">
        <HStack className="items-center justify-between gap-3">
          <Box className="flex-1 min-w-0">
            <Text size="sm" bold style={{ color: theme.colors.textPrimary }}>
              {title}
            </Text>
            {subtitle ? (
              <Text size="xs" className="mt-1" style={{ color: theme.colors.textSecondary }}>
                {subtitle}
              </Text>
            ) : null}
          </Box>
          {action ? <Box>{action}</Box> : null}
        </HStack>
        <Box>{children}</Box>
        {footer ? <Box>{footer}</Box> : null}
      </VStack>
    </Card>
  );
}
