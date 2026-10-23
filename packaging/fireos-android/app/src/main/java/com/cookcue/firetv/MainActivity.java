package com.cookcue.firetv;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import java.util.Locale;

/**
 * CookCue on Fire OS.
 *
 * A single WebView activity that hosts the production build of the React
 * app. The web assets are served over an https origin through
 * WebViewAssetLoader, so the page runs in a normal secure context instead of
 * a file:// one.
 *
 * The Android Back button is forwarded to the web app
 * (window.cookcue.handleBack()); the app decides whether to navigate or let
 * the platform close it.
 */
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "CookCue";
    private static final String APP_URL =
            "https://appassets.androidplatform.net/assets/www/index.html";

    private WebView webView;
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;

    private class AndroidVoiceBridge {

        @JavascriptInterface
        public void speak(String text) {
            runOnUiThread(() -> {
                if (textToSpeech != null && ttsReady && text != null) {
                    textToSpeech.speak(
                            text,
                            TextToSpeech.QUEUE_FLUSH,
                            null,
                            "cookcue_step"
                    );
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> {
                if (textToSpeech != null) { 
                    textToSpeech.stop();
                }
            });
        }
    }

    private void initializeTextToSpeech() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = textToSpeech.setLanguage(Locale.US);
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA
                        && result != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // A cooking guide must not let the screen sleep mid-recipe.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#14110F"));
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        
        initializeTextToSpeech();

        webView.addJavascriptInterface(
                new AndroidVoiceBridge(),
                "AndroidVoice"
        );
        // The timer alert plays a short beep, which the WebView would
        // otherwise block as an unrequested autoplay.
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                Log.d(TAG, message.message() + " ("
                        + message.sourceId() + ":" + message.lineNumber() + ")");
                return true;
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript(
                        "(function(){try{"
                                + "return !!(window.cookcue && window.cookcue.handleBack());"
                                + "}catch(e){return false;}})()",
                        value -> {
                            if (!"true".equals(value)) {
                                finish();
                            }
                        });
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }
    @Override
    protected void onDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
            ttsReady = false;
        }

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

}
