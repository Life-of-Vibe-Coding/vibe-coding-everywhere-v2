/**
 * Provider icons for chat UI (Gemini, Claude).
 * Designed to match each brand’s visual identity.
 */
import React from "react";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

const size = 24;
const viewBox = "0 0 24 24";

/**
 * Gemini (Google AI) icon.
 * Uses official 2025-style multi-color gradient by default.
 * If a color is explicitly provided, falls back to monochrome for compatibility.
 */
export function GeminiIcon({ color = "currentColor", size: s = size }: { color?: string; size?: number }) {
  const geminiPath =
    "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";

  if (color !== "currentColor") {
    return (
      <Svg width={s} height={s} viewBox={viewBox} fill="none">
        <Path fill={color} d={geminiPath} />
      </Svg>
    );
  }

  return (
    <Svg width={s} height={s} viewBox={viewBox} fill="none">
      <Path fill="#3186FF" d={geminiPath} />
      <Path fill="url(#gemini-fill-0)" d={geminiPath} />
      <Path fill="url(#gemini-fill-1)" d={geminiPath} />
      <Path fill="url(#gemini-fill-2)" d={geminiPath} />
      <Defs>
        <LinearGradient id="gemini-fill-0" x1="7" x2="11" y1="15.5" y2="12" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#08B962" />
          <Stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="gemini-fill-1" x1="8" x2="11.5" y1="5.5" y2="11" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F94543" />
          <Stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="gemini-fill-2" x1="3.5" x2="17.5" y1="13.5" y2="12" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FABC12" />
          <Stop offset="0.46" stopColor="#FABC12" stopOpacity="0" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

/** Upward send arrow for Gemini – used on light-themed send button. */
export function GeminiSendIcon({ color = "currentColor", size: s = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"
        transform="rotate(-90 12 12)"
      />
    </Svg>
  );
}

/** Send arrow for Claude – upward paper-plane style, fits Claude theme. */
export function ClaudeSendIcon({ color = "currentColor", size: s = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
      />
    </Svg>
  );
}

/** Claude (Anthropic AI) icon from official-style mark. */
export function ClaudeIcon({ color = "currentColor", size: s = size }: { color?: string; size?: number }) {
  const claudePath =
    "M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z";

  if (color !== "currentColor") {
    return (
      <Svg width={s} height={s} viewBox={viewBox} fill="none">
        <Path fill={color} d={claudePath} fillRule="nonzero" />
      </Svg>
    );
  }

  return (
    <Svg width={s} height={s} viewBox={viewBox} fill="none">
      <Path fill="#D97757" d={claudePath} fillRule="nonzero" />
    </Svg>
  );
}

/** Codex (OpenAI) icon – simplified code/AI mark. */
export function CodexIcon({ color = "currentColor", size: s = size }: { color?: string; size?: number }) {
  const codexPath =
    "M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.18l5.9 2.95V15.9L12 18.85l-5.9-2.95V7.13L12 4.18zM6 8.82v6.36l6 3 6-3V8.82l-6-3-6 3z";
  const fillColor = color !== "currentColor" ? color : "#19c37d";
  return (
    <Svg width={s} height={s} viewBox={viewBox} fill="none">
      <Path fill={fillColor} d={codexPath} fillRule="nonzero" />
    </Svg>
  );
}

/** Send arrow for Codex – same as GeminiSendIcon for consistency. */
export function CodexSendIcon({ color = "currentColor", size: s = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"
        transform="rotate(-90 12 12)"
      />
    </Svg>
  );
}
