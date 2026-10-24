// Browsers have no secure enclave; localStorage is the best available place for the key.
const KEY = "duet.apiKey";

export async function getSecret() {
  try {
    return window.localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export async function setSecret(value) {
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}
