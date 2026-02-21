/**
 * Docker manager icons: header branding + tabs (Containers, Images, Volumes).
 * Consistent 24x24 viewBox, SVG stroke-based design.
 */
import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

const size = 22;
const closeSize = 20;

/** Docker branding: container cube for header (Docker = containers). */
export function DockerIcon({ color = "currentColor", size: s = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9v6l8 4 8-4V9l-8-4-8 4z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M4 9l8 4 8-4M12 13v6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Close (X) icon for modal header. */
export function CloseIcon({ color = "currentColor", size: s = closeSize }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Chevron left – collapse sidebar. */
export function ChevronLeftIcon({ color = "currentColor", size: s = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 6-6 6 6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Panel/menu – expand sidebar (split-panel affordance). */
export function PanelLeftIcon({ color = "currentColor", size: s = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={2} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M12 4v16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Copy to clipboard icon. */
export function CopyIcon({ color = "currentColor", size: s = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={9} width={13} height={13} rx={2} stroke={color} strokeWidth={2} />
      <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const strokeW = 1.6;

/** Containers: 3D cube (running containers). */
export function ContainerIcon({ color = "currentColor", size: s = size }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8v8l8 4 8-4V8l-8-4-8 4z" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" fill="none" />
      <Path d="M4 8l8 4 8-4M12 12v8" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Images: layered layers (Docker image layers). */
export function ImageIcon({ color = "currentColor", size: s = size }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8v8l4 2 4-2 4 2 4-2V8l-4-2-4 2-4-2-4 2z"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M8 8l4 4 4-4" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Volumes: storage/drive. */
export function VolumeIcon({ color = "currentColor", size: s = size }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6} width={18} height={12} rx={1.5} stroke={color} strokeWidth={strokeW} fill="none" />
      <Rect x={6} y={9} width={12} height={6} rx={0.5} stroke={color} strokeWidth={strokeW * 0.8} fill="none" />
      <Rect x={10} y={11} width={4} height={2} rx={0.5} fill={color} opacity={0.7} />
    </Svg>
  );
}
