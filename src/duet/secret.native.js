import * as SecureStore from "expo-secure-store";

const KEY = "duet.apiKey";

export async function getSecret() {
  try {
    return (await SecureStore.getItemAsync(KEY)) || "";
  } catch {
    return "";
  }
}

export async function setSecret(value) {
  try {
    if (value) await SecureStore.setItemAsync(KEY, value);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // keychain unavailable
  }
}
