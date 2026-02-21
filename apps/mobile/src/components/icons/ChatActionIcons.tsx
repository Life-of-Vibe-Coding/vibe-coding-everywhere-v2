import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

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

export function AttachPlusIcon({ color = "currentColor", size = 18, strokeWidth = 2 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path {...stroke} d="M12 6v12" />
      <Path {...stroke} d="M6 12h12" />
    </Svg>
  );
}

export function ChevronDownIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path {...stroke} d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path {...stroke} d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function GlobeIcon({ color = "currentColor", size = 18, strokeWidth = 1.8 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle {...stroke} cx="12" cy="12" r="9" />
      <Path {...stroke} d="M3 12h18" />
      <Path {...stroke} d="M12 3c2.7 2.4 4.2 5.6 4.2 9s-1.5 6.6-4.2 9c-2.7-2.4-4.2-5.6-4.2-9s1.5-6.6 4.2-9Z" />
    </Svg>
  );
}

export function TerminalIcon({ color = "currentColor", size = 18, strokeWidth = 1.8 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect {...stroke} x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <Path {...stroke} d="m8 9 3 3-3 3" />
      <Path {...stroke} d="M13.5 15h2.5" />
    </Svg>
  );
}

export function StopCircleIcon({ color = "currentColor", size = 16, strokeWidth = 1.8 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle {...stroke} cx="12" cy="12" r="8.5" />
      <Rect x="9" y="9" width="6" height="6" rx="1.5" fill={color} />
    </Svg>
  );
}

export function CloseIcon({ color = "currentColor", size = 14, strokeWidth = 2 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path {...stroke} d="M6 6l12 12" />
      <Path {...stroke} d="M18 6 6 18" />
    </Svg>
  );
}

export function PlayIcon({ color = "currentColor", size = 12 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill={color} d="M8.75 6.75a1 1 0 0 1 1.5-.87l8.5 5.25a1 1 0 0 1 0 1.74l-8.5 5.25a1 1 0 0 1-1.5-.87V6.75Z" />
    </Svg>
  );
}

/** Skill icon (lucide:sparkles) - for AI skills/plugins. */
export function SkillIcon({ color = "currentColor", size = 18, strokeWidth = 2 }: IconProps) {
  const stroke = getStrokeProps(color, strokeWidth);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill={color} d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <Path {...stroke} d="M20 2v4m2-2h-4" />
      <Circle fill={color} cx="4" cy="20" r="2" />
    </Svg>
  );
}

/** Docker icon (mdi:docker) - for container management. */
export function DockerIcon({ color = "currentColor", size = 18 }: Omit<IconProps, "strokeWidth">) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M21.81 10.25c-.06-.04-.56-.43-1.64-.43c-.28 0-.56.03-.84.08c-.21-1.4-1.38-2.11-1.43-2.14l-.29-.17l-.18.27c-.24.36-.43.77-.51 1.19c-.2.8-.08 1.56.33 2.21c-.49.28-1.29.35-1.46.35H2.62c-.34 0-.62.28-.62.63c0 1.15.18 2.3.58 3.38c.45 1.19 1.13 2.07 2 2.61c.98.6 2.59.94 4.42.94c.79 0 1.61-.07 2.42-.22c1.12-.2 2.2-.59 3.19-1.16A8.3 8.3 0 0 0 16.78 16c1.05-1.17 1.67-2.5 2.12-3.65h.19c1.14 0 1.85-.46 2.24-.85c.26-.24.45-.53.59-.87l.08-.24zm-17.96.99h1.76c.08 0 .16-.07.16-.16V9.5c0-.08-.07-.16-.16-.16H3.85c-.09 0-.16.07-.16.16v1.58c.01.09.07.16.16.16m2.43 0h1.76c.08 0 .16-.07.16-.16V9.5c0-.08-.07-.16-.16-.16H6.28c-.09 0-.16.07-.16.16v1.58c.01.09.07.16.16.16m2.47 0h1.75c.1 0 .17-.07.17-.16V9.5c0-.08-.06-.16-.17-.16H8.75c-.08 0-.15.07-.15.16v1.58c0 .09.06.16.15.16m2.44 0h1.77c.08 0 .15-.07.15-.16V9.5c0-.08-.06-.16-.15-.16h-1.77c-.08 0-.15.07-.15.16v1.58c0 .09.07.16.15.16M6.28 9h1.76c.08 0 .16-.09.16-.18V7.25c0-.09-.07-.16-.16-.16H6.28c-.09 0-.16.06-.16.16v1.57c.01.09.07.18.16.18m2.47 0h1.75c.1 0 .17-.09.17-.18V7.25c0-.09-.06-.16-.17-.16H8.75c-.08 0-.15.06-.15.16v1.57c0 .09.06.18.15.18m2.44 0h1.77c.08 0 .15-.09.15-.18V7.25c0-.09-.07-.16-.15-.16h-1.77c-.08 0-.15.06-.15.16v1.57c0 .09.07.18.15.18m0-2.28h1.77c.08 0 .15-.07.15-.16V5c0-.1-.07-.17-.15-.17h-1.77c-.08 0-.15.06-.15.17v1.56c0 .08.07.16.15.16m2.46 4.52h1.76c.09 0 .16-.07.16-.16V9.5c0-.08-.07-.16-.16-.16h-1.76c-.08 0-.15.07-.15.16v1.58c0 .09.07.16.15.16"
      />
    </Svg>
  );
}
