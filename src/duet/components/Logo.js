import React from "react";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";

// The Duet mark: two interleaved waves.
export function WaveMark({ size = 28, color = colors.accent, secondary = "#ff9a72" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M3 18 C7 6, 12 6, 15 16 S22 27, 29 13" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M3 13 C8 24, 13 24, 16 15 S23 5, 29 19" stroke={secondary} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
}

// White "voice" glyph used on the composer button.
export function VoiceBars({ size = 22, color = "#111" }) {
  const heights = [8, 15, 22, 13, 18, 8];
  const gap = size / 6;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {heights.map((h, i) => {
        const height = (h / 22) * size;
        const x = gap * i + gap / 2;
        return (
          <Path key={i} d={`M${x} ${(size - height) / 2} V${(size + height) / 2}`} stroke={color} strokeWidth={size / 11} strokeLinecap="round" />
        );
      })}
    </Svg>
  );
}
