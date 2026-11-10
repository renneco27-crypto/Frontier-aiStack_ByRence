package com.studyup.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "NativeSTT",
    permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "audio")
    }
)
public class NativeSTTPlugin extends Plugin {

    private static final String TAG = "NativeSTT";
    private SpeechRecognizer speechRecognizer;

    @PluginMethod
    public void startListening(PluginCall call) {
        if (!hasPermission("audio")) {
            requestPermissionForAlias("audio", call, "permissionCallback");
            return;
        }
        startRecognition(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (hasPermission("audio")) {
            startRecognition(call);
        } else {
            call.reject("Permission denied");
        }
    }

    private void startRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
            }

            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    JSObject ret = new JSObject();
                    ret.put("event", "ready");
                    notifyListeners("sttEvent", ret);
                }

                @Override
                public void onBeginningOfSpeech() {
                    JSObject ret = new JSObject();
                    ret.put("event", "beginning");
                    notifyListeners("sttEvent", ret);
                }

                @Override
                public void onRmsChanged(float rmsdB) {}

                @Override
                public void onBufferReceived(byte[] buffer) {}

                @Override
                public void onEndOfSpeech() {
                    JSObject ret = new JSObject();
                    ret.put("event", "end");
                    notifyListeners("sttEvent", ret);
                }

                @Override
                public void onError(int error) {
                    JSObject ret = new JSObject();
                    ret.put("event", "error");
                    ret.put("error", error);
                    notifyListeners("sttEvent", ret);
                    call.reject("Error code: " + error);
                }

                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        JSObject ret = new JSObject();
                        ret.put("event", "result");
                        ret.put("text", matches.get(0));
                        notifyListeners("sttEvent", ret);
                        call.resolve(ret);
                    } else {
                        call.reject("No matches");
                    }
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        JSObject ret = new JSObject();
                        ret.put("event", "partial");
                        ret.put("text", matches.get(0));
                        notifyListeners("sttEvent", ret);
                    }
                }

                @Override
                public void onEvent(int eventType, Bundle params) {}
            });

            speechRecognizer.startListening(intent);
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.stopListening();
            }
            call.resolve();
        });
    }
}
