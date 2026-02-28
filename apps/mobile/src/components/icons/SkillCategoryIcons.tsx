import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

type IconProps = {
    color?: string;
    size?: number;
    strokeWidth?: number;
};

function getStrokeProps(color: string, strokeWidth: number) {
    return {
        stroke: color,
        strokeWidth,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };
}

export function GridIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Rect {...stroke} x="3" y="3" width="7" height="7" rx="1" />
            <Rect {...stroke} x="14" y="3" width="7" height="7" rx="1" />
            <Rect {...stroke} x="14" y="14" width="7" height="7" rx="1" />
            <Rect {...stroke} x="3" y="14" width="7" height="7" rx="1" />
        </Svg>
    );
}

export function CodeIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path {...stroke} d="m16 18 6-6-6-6" />
            <Path {...stroke} d="m8 6-6 6 6 6" />
        </Svg>
    );
}

export function LayoutIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Rect {...stroke} x="3" y="3" width="18" height="18" rx="2" />
            <Path {...stroke} d="M3 9h18" />
            <Path {...stroke} d="M9 21V9" />
        </Svg>
    );
}

export function ServerIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Rect {...stroke} x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <Rect {...stroke} x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <Path {...stroke} d="M6 6h.01" />
            <Path {...stroke} d="M6 18h.01" />
        </Svg>
    );
}

export function BugIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path {...stroke} d="m8 2 1.88 1.88" />
            <Path {...stroke} d="M14.12 3.88 16 2" />
            <Path {...stroke} d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
            <Path {...stroke} d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
            <Path {...stroke} d="M12 20v-9" />
            <Path {...stroke} d="M6.53 9C4.6 8.8 3 7.1 3 5" />
            <Path {...stroke} d="M17.47 9c1.93-.2 3.53-1.9 3.53-4" />
            <Path {...stroke} d="M8 14H4" />
            <Path {...stroke} d="M16 14h4" />
            <Path {...stroke} d="M9.5 19c-1.76.62-3.21 2.37-3.83 4" />
            <Path {...stroke} d="M14.5 19c1.76.62 3.21 2.37 3.83 4" />
        </Svg>
    );
}

export function MessageSquareIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path {...stroke} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </Svg>
    );
}

export function SparklesIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path {...stroke} d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <Path {...stroke} d="M5 3v4" />
            <Path {...stroke} d="M19 17v4" />
            <Path {...stroke} d="M3 5h4" />
            <Path {...stroke} d="M17 19h4" />
        </Svg>
    );
}

export function FolderIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
    const stroke = getStrokeProps(color, strokeWidth);
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path {...stroke} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </Svg>
    );
}

export const getCategoryIcon = (category: string, props: IconProps) => {
    switch (category) {
        case "All":
            return <GridIcon {...props} />;
        case "Development":
            return <CodeIcon {...props} />;
        case "UI/UX":
            return <LayoutIcon {...props} />;
        case "DevOps":
            return <ServerIcon {...props} />;
        case "Debug":
            return <BugIcon {...props} />;
        case "Prompt":
            return <MessageSquareIcon {...props} />;
        default:
            return <FolderIcon {...props} />;
    }
};
