package com.tonchan;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import okhttp3.*;

import org.json.JSONObject;

import java.io.IOException;

public class BalanceModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "BalanceModule";
    private static final String DAEMON_URL =
            "http://82.165.218.56:17081/getwalletsyncdata";

    private final OkHttpClient client = new OkHttpClient();

    public BalanceModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void pingDaemon(Promise promise) {
        try {
            JSONObject body = new JSONObject();
            body.put("blockCount", 1);
            body.put("blockHashCheckpoints", new org.json.JSONArray());
            body.put("skipCoinbaseTransactions", true);
            body.put("startHeight", 0);
            body.put("startTimestamp", 0);

            // ✅ Creazione corretta per OkHttp compatibile con Gradle / Android
            RequestBody requestBody = RequestBody.create(
                    okhttp3.MediaType.parse("application/json; charset=utf-8"),
                    body.toString()
            );

            Request request = new Request.Builder()
                    .url(DAEMON_URL)
                    .post(requestBody)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    promise.reject("DAEMON_ERROR", e.getMessage());
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (!response.isSuccessful()) {
                        promise.reject("DAEMON_HTTP", "HTTP " + response.code());
                        return;
                    }

                    String res = response.body() != null ? response.body().string() : "";
                    promise.resolve(res);
                }
            });

        } catch (Exception e) {
            promise.reject("NATIVE_ERROR", e.getMessage());
        }
    }
}
