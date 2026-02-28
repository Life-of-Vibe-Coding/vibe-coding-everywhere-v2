/**
 * File activity icons (Lucide via Iconify).
 * Read: book-open, Edit: pencil, Write: file-pen-line.
 */
import React from "react";
import Svg, { G, Path } from "react-native-svg";

const size = 18;
const viewBox = "0 0 24 24";
const strokeProps = {
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 2,
};

function strokeOnly(color: string) {
  return { stroke: color, fill: "none" };
}

/** Reading action - book open icon (lucide:book-open) */
export function BookOpenIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <Path
        {...strokeOnly(color)}
        {...strokeProps}
        d="M12 7v14m-9-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4a4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3a3 3 0 0 0-3-3z"
      />
    </Svg>
  );
}

/** Editing action - pencil icon (lucide:pencil) */
export function PencilIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <Path
        {...strokeOnly(color)}
        {...strokeProps}
        d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"
      />
    </Svg>
  );
}

/** Writing action - file with pen icon (lucide:file-pen-line) */
export function FilePenIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <G {...strokeOnly(color)} {...strokeProps}>
        <Path d="m18.226 5.226l-2.52-2.52A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.351" />
        <Path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506zM8 18h1" />
      </G>
    </Svg>
  );
}
