# duet-live-audio-stream

Android-only fork of [react-native-live-audio-stream](https://github.com/xiqi/react-native-live-audio-stream)
1.1.1 by Qi Xi (MIT, see LICENSE). Changes:

- `namespace` in `android/build.gradle` (required by current Android Gradle Plugin).
- Depends on `react-android` instead of the retired `react-native:+` artifact.
- `stop()` resolves its promise and the `AudioRecord` is released.
- `start()` throws a readable error if the recorder could not start (for example no mic permission).

The original iOS code is not included; iOS is not built in this repo.
