import React from "react";
import Feather from "@expo/vector-icons/Feather";
import { colors } from "../theme";

export default function Icon({ name, size = 20, color = colors.text, style }) {
  return <Feather name={name} size={size} color={color} style={style} />;
}

// Icons offered when creating a channel.
export const CHANNEL_ICONS = ["hash", "video", "mail", "calendar", "briefcase", "dollar-sign", "edit-3", "star", "heart", "globe", "camera", "music"];
