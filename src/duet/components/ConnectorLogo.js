import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LOGOS } from "../logos";

// Brand mark in its official colour on a light tile, so dark brand colours (Slack purple,
// Stripe indigo) stay readable on the app's black background.
export default function ConnectorLogo({ id, size = 40 }) {
  const logo = LOGOS[id];
  const mark = Math.round(size * 0.58);
  return (
    <View
      accessibilityLabel={logo ? `${logo.title} logo` : undefined}
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: "#f6f4f1", alignItems: "center", justifyContent: "center" }}
    >
      {logo ? (
        <Svg width={mark} height={mark} viewBox="0 0 24 24">
          <Path d={logo.path} fill={logo.hex} />
        </Svg>
      ) : null}
    </View>
  );
}
