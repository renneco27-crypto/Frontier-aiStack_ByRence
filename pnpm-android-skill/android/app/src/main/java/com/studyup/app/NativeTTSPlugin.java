package com.studyup.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin implements TextToSpeech.OnInitListener {

    private static final String TAG = "NativeTTS";
    public static volatile NativeTTSPlugin instance;
    private TextToSpeech tts;
    // volatile: onInit() runs on the main thread while speak() polls this flag on the plugin thread
    private volatile boolean isInitialized = false;

    @Override
    public void load() {
        super.load();
        instance = this;
        initTTS();
    }

    private synchronized void initTTS() {
        if (tts == null && getContext() != null) {
            try {
                tts = new TextToSpeech(getContext().getApplicationContext(), this);
            } catch (Exception e) {
                Log.e(TAG, "Failed creating TextToSpeech instance", e);
            }
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            try {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setLegacyStreamType(AudioManager.STREAM_MUSIC)
                    .build();
                tts.setAudioAttributes(audioAttributes);
            } catch (Exception e) {
                Log.w(TAG, "Failed to set audio attributes on TTS engine", e);
            }

            int res = tts.setLanguage(Locale.US);
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.w(TAG, "US English TTS not supported or missing data, trying default");
                int defRes = tts.setLanguage(Locale.getDefault());
                if (defRes == TextToSpeech.LANG_MISSING_DATA || defRes == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.w(TAG, "Default locale missing data, falling back to Locale.ENGLISH");
                    tts.setLanguage(Locale.ENGLISH);
                }
            }

            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    Log.i(TAG, "TTS onStart: " + utteranceId);
                    JSObject ret = new JSObject();
                    ret.put("utteranceId", utteranceId);
                    ret.put("event", "start");
                    notifyListeners("ttsEvent", ret);
                }

                @Override
                public void onDone(String utteranceId) {
                    Log.i(TAG, "TTS onDone: " + utteranceId);
                    JSObject ret = new JSObject();
                    ret.put("utteranceId", utteranceId);
                    ret.put("event", "done");
                    notifyListeners("ttsEvent", ret);
                }

                @Override
                public void onError(String utteranceId) {
                    Log.e(TAG, "TTS onError: " + utteranceId);
                    JSObject ret = new JSObject();
                    ret.put("utteranceId", utteranceId);
                    ret.put("event", "error");
                    notifyListeners("ttsEvent", ret);
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    Log.e(TAG, "TTS onError: " + utteranceId + " errorCode: " + errorCode);
                    JSObject ret = new JSObject();
                    ret.put("utteranceId", utteranceId);
                    ret.put("event", "error");
                    ret.put("errorCode", errorCode);
                    notifyListeners("ttsEvent", ret);
                }
            });

            isInitialized = true;
            Log.i(TAG, "Native Android TextToSpeech successfully initialized on-device (Locale.US) with USAGE_MEDIA.");
        } else {
            Log.e(TAG, "Native TTS initialization failed with status: " + status);
            isInitialized = false;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", isInitialized && tts != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Text cannot be empty");
            return;
        }

        double rate = call.getDouble("rate", 1.0);
        double pitch = call.getDouble("pitch", 1.0);

        if (!isInitialized || tts == null) {
            initTTS();
            long startWait = System.currentTimeMillis();
            while (!isInitialized && (System.currentTimeMillis() - startWait < 3000)) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException ignored) {
                    break;
                }
            }
        }

        if (!isInitialized || tts == null) {
            call.reject("TTS engine initializing, please retry");
            return;
        }

        try {
            tts.stop();
            tts.setSpeechRate((float) rate);
            tts.setPitch((float) pitch);

            // Ensure AudioAttributes is set to USAGE_MEDIA with STREAM_MUSIC legacy stream type
            try {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setLegacyStreamType(AudioManager.STREAM_MUSIC)
                    .build();
                tts.setAudioAttributes(audioAttributes);
            } catch (Exception ignored) {}

            String utteranceId = call.getString("utteranceId", null);
            if (utteranceId == null || utteranceId.isEmpty()) {
                utteranceId = "utt_" + System.currentTimeMillis();
            }
            Bundle params = new Bundle();
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);

            if (getContext() != null) {
                try {
                    AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                    if (am != null) {
                        int vol = am.getStreamVolume(AudioManager.STREAM_MUSIC);
                        int maxVol = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                        boolean isMuted = false;
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            isMuted = am.isStreamMute(AudioManager.STREAM_MUSIC);
                        }
                        Log.i(TAG, "NativeTTS.speak() STREAM_MUSIC volume: " + vol + "/" + maxVol + (isMuted ? " [MUTED!]" : "") + " (text: " + text + ")");
                    }
                } catch (Exception ignored) {}
            }

            int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
            if (result == TextToSpeech.SUCCESS) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("utteranceId", utteranceId);
                call.resolve(ret);
            } else {
                Log.e(TAG, "tts.speak() failed with code: " + result);
                call.reject("TTS speak returned error code: " + result);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in speak()", e);
            call.reject("Speech failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            if (tts != null) {
                tts.stop();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed stopping TTS: " + e.getMessage());
        }
    }

    public boolean isTTSAvailable() {
        return isInitialized && tts != null;
    }

    public boolean speakDirect(String text, float rate) {
        if (!isInitialized || tts == null) {
            initTTS();
            long startWait = System.currentTimeMillis();
            while (!isInitialized && (System.currentTimeMillis() - startWait < 2000)) {
                try {
                    Thread.sleep(50);
                } catch (InterruptedException ignored) {
                    break;
                }
            }
        }
        if (!isInitialized || tts == null) return false;
        try {
            tts.stop();
            tts.setSpeechRate(rate);
            Bundle params = new Bundle();
            String utteranceId = "dir_" + System.currentTimeMillis();
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);

            if (getContext() != null) {
                try {
                    AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                    if (am != null) {
                        int vol = am.getStreamVolume(AudioManager.STREAM_MUSIC);
                        int maxVol = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                        Log.i(TAG, "DirectTTS.speak() STREAM_MUSIC vol: " + vol + "/" + maxVol + " text=" + text);
                    }
                } catch (Exception ignored) {}
            }

            int res = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
            return res == TextToSpeech.SUCCESS;
        } catch (Exception e) {
            Log.e(TAG, "Direct speak error", e);
            return false;
        }
    }

    public void stopDirect() {
        if (tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
        super.handleOnDestroy();
    }
}
