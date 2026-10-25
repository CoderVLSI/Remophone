import { NativeModules, NativeEventEmitter } from "react-native";

const { RNLiveAudioStream } = NativeModules;

// `available` is false in Expo Go and on platforms without the native module.
export const available = !!RNLiveAudioStream;

let emitter = null;
const getEmitter = () => {
  if (!emitter) emitter = new NativeEventEmitter(RNLiveAudioStream);
  return emitter;
};

const AudioRecord = {
  init: (options) => RNLiveAudioStream.init(options),
  start: () => RNLiveAudioStream.start(),
  stop: () => RNLiveAudioStream.stop(),
  // Returns a subscription; call .remove() to stop listening.
  on: (event, callback) => {
    if (event !== "data") throw new Error("Invalid event");
    return getEmitter().addListener("data", callback);
  },
};

export default AudioRecord;
