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
