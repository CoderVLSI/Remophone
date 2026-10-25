package com.imxiqi.rnliveaudiostream;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder.AudioSource;
import android.util.Base64;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

// Based on react-native-live-audio-stream 1.1.1 (MIT, Qi Xi). See LICENSE.
public class RNLiveAudioStreamModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    private int sampleRateInHz;
    private int channelConfig;
    private int audioFormat;
    private int audioSource;

    private AudioRecord recorder;
    private int bufferSize;
    private volatile boolean isRecording;
    private Thread recordingThread;

    public RNLiveAudioStreamModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "RNLiveAudioStream";
    }

    @ReactMethod
    public void init(ReadableMap options) {
        releaseRecorder();

        sampleRateInHz = options.hasKey("sampleRate") ? options.getInt("sampleRate") : 44100;
        channelConfig = (options.hasKey("channels") && options.getInt("channels") == 2)
                ? AudioFormat.CHANNEL_IN_STEREO : AudioFormat.CHANNEL_IN_MONO;
        audioFormat = (options.hasKey("bitsPerSample") && options.getInt("bitsPerSample") == 8)
                ? AudioFormat.ENCODING_PCM_8BIT : AudioFormat.ENCODING_PCM_16BIT;
        audioSource = options.hasKey("audioSource") ? options.getInt("audioSource") : AudioSource.VOICE_RECOGNITION;

        bufferSize = AudioRecord.getMinBufferSize(sampleRateInHz, channelConfig, audioFormat);
        if (options.hasKey("bufferSize")) {
            bufferSize = Math.max(bufferSize, options.getInt("bufferSize"));
        }

        try {
            recorder = new AudioRecord(audioSource, sampleRateInHz, channelConfig, audioFormat, bufferSize * 3);
        } catch (Exception e) {
            recorder = null;
        }
    }

    @ReactMethod
    public void start(Promise promise) {
        if (recorder == null || recorder.getState() != AudioRecord.STATE_INITIALIZED) {
            promise.reject("E_NO_RECORDER", "The microphone could not be opened. Check the microphone permission.");
            return;
        }
        if (isRecording) {
            promise.resolve(null);
            return;
        }
        try {
            recorder.startRecording();
        } catch (Exception e) {
            promise.reject("E_START", "The microphone could not be started: " + e.getMessage());
            return;
        }
        isRecording = true;

        final AudioRecord active = recorder;
        final int size = bufferSize;
        recordingThread = new Thread(new Runnable() {
            public void run() {
                try {
                    int count = 0;
                    byte[] buffer = new byte[size];
                    while (isRecording) {
                        int bytesRead = active.read(buffer, 0, buffer.length);
                        // skip the first 2 buffers to avoid a start-up click
                        if (bytesRead > 0 && ++count > 2) {
                            String base64Data = Base64.encodeToString(buffer, 0, bytesRead, Base64.NO_WRAP);
                            reactContext
                                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                    .emit("data", base64Data);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        recordingThread.start();
        promise.resolve(null);
    }

    @ReactMethod
    public void stop(Promise promise) {
        isRecording = false;
        try {
            if (recordingThread != null) recordingThread.join(500);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        recordingThread = null;
        releaseRecorder();
        promise.resolve(null);
    }

    // Required by NativeEventEmitter on newer React Native versions.
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    private void releaseRecorder() {
        isRecording = false;
        if (recorder != null) {
            try {
                if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
            } catch (Exception ignored) {
                // already stopped
            }
            recorder.release();
            recorder = null;
        }
    }
}
