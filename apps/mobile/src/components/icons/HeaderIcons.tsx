/**
 * Header icons: filled/solid style (no stroke-only).
 * Menu: three solid bars; Settings: solid gear with center hole.
 */
import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

const size = 22;
/** Bar width 16, height 1.5 — no bolding; square ends. */
const menuBarWidth = 16;
const menuBarHeight = 1.5;
const menuBarLeft = (24 - menuBarWidth) / 2;

export function MenuIcon({ color = "currentColor" }: { color?: string }) {
  const y1 = 5.25;
  const y2 = 11;
  const y3 = 16.75;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={menuBarLeft}
        y={y1}
        width={menuBarWidth}
        height={menuBarHeight}
        fill={color}
      />
      <Rect
        x={menuBarLeft}
        y={y2}
        width={menuBarWidth}
        height={menuBarHeight}
        fill={color}
      />
      <Rect
        x={menuBarLeft}
        y={y3}
        width={menuBarWidth}
        height={menuBarHeight}
        fill={color}
      />
    </Svg>
  );
}

/** Filled gear: 8 teeth, symmetric; center hole via fillRule evenodd. */
const gearPath =
  "M20 12 L17.08 14.11 L17.66 17.66 L14.11 17.08 L12 20 L9.89 17.08 L6.34 17.66 L6.92 14.11 L4 12 L6.92 9.89 L6.34 6.34 L9.89 6.92 L12 4 L14.11 6.92 L17.66 6.34 L17.08 9.89 Z";
const centerHole = "M12 12 m-3 0 a 3 3 0 1 1 6 0 a 3 3 0 1 1 -6 0 Z";

export function SettingsIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        fillRule="evenodd"
        d={`${gearPath} ${centerHole}`}
      />
    </Svg>
  );
}
