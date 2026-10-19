package com.dreamsoul.app;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "OfflineAI")
public class OfflineAIPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final Object LIFECYCLE = new Object();
    private static int instances = 0;
    private final AtomicBoolean destroyed = new AtomicBoolean(false);
    private static final AtomicBoolean busy = new AtomicBoolean(false);
    private static final AtomicBoolean downloadCanceled = new AtomicBoolean(false);
    private static volatile boolean downloading = false;
    private volatile boolean loaded = false;
    private volatile String activeRequest = null;
    private JSONObject manifest;

    @Override public void load() { synchronized (LIFECYCLE) { instances++; } }

    private synchronized JSONObject manifest() throws Exception {
        if (manifest == null) {
            try (InputStream in = getContext().getAssets().open("public/offline-model.json"); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096]; int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
                manifest = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
            }
            if (!manifest.getString("sha256").matches("[a-f0-9]{64}") || manifest.getLong("bytes") < 1000000) throw new IOException("Offline model manifest is invalid.");
        }
        return manifest;
    }
    private File directory() throws IOException {
        File dir = new File(getContext().getFilesDir(), "models");
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not create local model storage.");
        return dir;
    }
    private File modelFile() throws IOException { return new File(directory(), "dreamsoul-light.gguf"); }
    private File partFile() throws IOException { return new File(directory(), "dreamsoul-light.part"); }
    private boolean downloaded() throws Exception {
        return modelFile().isFile() && modelFile().length() == manifest().getLong("bytes") && manifest().getString("sha256").equals(getContext().getSharedPreferences("offline_ai", Context.MODE_PRIVATE).getString("verified_sha", ""));
    }
    private JSObject status() throws Exception {
        ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
        ((ActivityManager)getContext().getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(memory);
        return new JSObject().put("supported", OfflineEngine.AVAILABLE && Build.SUPPORTED_64_BIT_ABIS.length > 0)
            .put("ramGB", Math.round(memory.totalMem / 1e8) / 10.0).put("freeGB", Math.round(directory().getUsableSpace() / 1e8) / 10.0)
            .put("downloaded", downloaded()).put("loaded", loaded).put("downloading", downloading).put("busy", busy.get())
            .put("bytesDownloaded", partFile().length()).put("modelBytes", manifest().getLong("bytes")).put("modelName", manifest().getString("name"));
    }
    private void progress(String stage, long bytes) {
        if (getActivity() != null && !getActivity().isDestroyed()) {
            JSObject info = new JSObject().put("stage", stage).put("bytes", bytes);
            getActivity().runOnUiThread(() -> notifyListeners("progress", info));
        }
    }
    private String checksum(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[128 * 1024]; int n;
            while ((n = in.read(buffer)) != -1) {
                if (downloadCanceled.get() && downloading) throw new IOException("Download paused. You can resume it later.");
                digest.update(buffer, 0, n);
            }
        }
        StringBuilder hex = new StringBuilder();
        for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value & 255));
        return hex.toString();
    }
    private HttpsURLConnection connection(String location, long offset) throws Exception {
        URL url = new URL(location);
        for (int i = 0; i < 8; i++) {
            String host = url.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(url.getProtocol()) || !(host.equals("huggingface.co") || host.endsWith(".huggingface.co") || host.equals("hf.co") || host.endsWith(".hf.co"))) throw new IOException("The model download redirected to an untrusted source.");
            HttpsURLConnection conn = (HttpsURLConnection)url.openConnection();
            conn.setInstanceFollowRedirects(false); conn.setConnectTimeout(20000); conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "DreamSoul-Offline/1.1");
            if (offset > 0) conn.setRequestProperty("Range", "bytes=" + offset + "-");
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String next = conn.getHeaderField("Location"); conn.disconnect();
                if (next == null) throw new IOException("The model download could not be redirected.");
                url = new URL(url, next); continue;
            }
            return conn;
        }
        throw new IOException("Too many model download redirects.");
    }
    @PluginMethod public void getStatus(PluginCall call) {
        try { call.resolve(status()); } catch (Exception e) { call.reject("Offline AI setup is unavailable in this build."); }
    }
    private void installModel() throws Exception {
        if (!OfflineEngine.AVAILABLE) throw new IOException("This device needs the 64-bit Android offline build.");
        if (downloaded()) return;
        HttpsURLConnection conn = null;
        try {
            File part = partFile(); long total = manifest().getLong("bytes");
            if (part.length() > total && !part.delete()) throw new IOException("Could not reset the partial download.");
            if (directory().getUsableSpace() < total - part.length() + 64L * 1024 * 1024) throw new IOException("Free more storage before downloading the model.");
            if (part.length() < total) {
                long offset = part.length();
                conn = connection(manifest().getString("url"), offset);
                int response = conn.getResponseCode();
                boolean append = response == 206 && offset > 0 && String.valueOf(conn.getHeaderField("Content-Range")).startsWith("bytes " + offset + "-");
                if (response != 200 && response != 206) throw new IOException("Model download failed (HTTP " + response + "). Please retry on a stable connection.");
                if (!append) offset = 0;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part, append)) {
                    byte[] buffer = new byte[128 * 1024]; int n; long received = offset, last = 0;
                    while ((n = in.read(buffer)) != -1) {
                        if (downloadCanceled.get()) throw new IOException("Download paused. You can resume it later.");
                        received += n;
                        if (received > total) throw new IOException("The model download did not match its manifest.");
                        out.write(buffer, 0, n);
                        long now = System.currentTimeMillis();
                        if (now - last > 150) { progress("downloading", received); last = now; }
                    }
                    out.flush();
                }
            }
            progress("verifying", total);
            // Keep incomplete transfers resumable, but never retain a corrupt complete file.
            if (part.length() != total) throw new IOException("The download was interrupted. Tap Resume to continue.");
            if (!checksum(part).equals(manifest().getString("sha256"))) {
                part.delete(); throw new IOException("Model checksum failed. No model was loaded. Please download it again.");
            }
            if (loaded) { OfflineEngine.unload(); loaded = false; }
            File target = modelFile();
            if (target.exists() && !target.delete()) throw new IOException("Could not replace the model file.");
            if (!part.renameTo(target)) throw new IOException("Could not finish saving the model.");
            if (!getContext().getSharedPreferences("offline_ai", Context.MODE_PRIVATE).edit().putString("verified_sha", manifest().getString("sha256")).commit()) throw new IOException("Could not save verification. Free storage and retry.");
            progress("ready", total);
        } finally { if (conn != null) conn.disconnect(); }
    }
    @PluginMethod public void download(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("Please wait for the current local AI operation."); return; }
        downloadCanceled.set(false); downloading = true;
        worker.execute(() -> {
            String error = null;
            try { installModel(); }
            catch (Exception e) { error = e.getMessage() == null ? "Model download failed. Please retry." : e.getMessage(); }
            finally { downloading = false; busy.set(false); }
            if (error != null) call.reject(error);
            else { try { call.resolve(status()); } catch (Exception e) { call.reject("Could not read model status."); } }
        });
    }
    @PluginMethod public void pauseDownload(PluginCall call) { downloadCanceled.set(true); call.resolve(); }
    @PluginMethod public void loadModel(PluginCall call) {
        if (loaded) { call.resolve(new JSObject().put("loaded", true)); return; }
        if (!busy.compareAndSet(false, true)) { call.reject("Please wait for the current local AI operation."); return; }
        worker.execute(() -> {
            String error = null;
            try {
                if (!OfflineEngine.AVAILABLE || !downloaded()) throw new IOException("Open Offline AI and download the model first.");
                progress("loading", manifest().getLong("bytes"));
                if (!checksum(modelFile()).equals(manifest().getString("sha256"))) throw new IOException("The model file is damaged. Delete and download it again.");
                OfflineEngine.load(modelFile().getAbsolutePath(), Math.min(4, Runtime.getRuntime().availableProcessors()));
                loaded = true;
            } catch (Throwable e) { error = e.getMessage() == null ? "The model could not load. Free memory and retry." : e.getMessage(); }
            finally { busy.set(false); }
            if (error != null) call.reject(error); else call.resolve(new JSObject().put("loaded", true));
        });
    }
    @PluginMethod public void generate(PluginCall call) {
        String request = call.getString("requestId"); JSArray messages = call.getArray("messages");
        if (!loaded || request == null || messages == null) { call.reject("Load the local model before starting a reply."); return; }
        if (!busy.compareAndSet(false, true)) { call.reject("A local reply is already running."); return; }
        activeRequest = request; OfflineEngine.prepare();
        worker.execute(() -> {
            String error = null; JSObject response = null;
            try {
                if (messages.length() < 2 || messages.length() > 21) throw new IOException("Invalid offline conversation length.");
                String[] roles = new String[messages.length()], content = new String[messages.length()];
                for (int i = 0; i < messages.length(); i++) {
                    JSONObject message = messages.getJSONObject(i);
                    roles[i] = message.getString("role"); content[i] = message.getString("content");
                    if (!(roles[i].equals("user") || roles[i].equals("assistant") || (i == 0 && roles[i].equals("system"))) || content[i].length() > 12000) throw new IOException("Invalid offline message.");
                }
                byte[] result = OfflineEngine.generate(roles, content, Math.min(256, Math.max(1, call.getInt("maxTokens", 256))), delta -> {
                    String text = new String(delta, StandardCharsets.UTF_8);
                    JSObject event = new JSObject().put("requestId", request).put("delta", text);
                    if (getActivity() != null && !getActivity().isDestroyed()) getActivity().runOnUiThread(() -> notifyListeners("token", event));
                });
                response = new JSObject().put("text", new String(result, StandardCharsets.UTF_8)).put("contextTokens", 2048);
            } catch (Throwable e) { error = e.getMessage() == null ? "Local AI could not finish the reply." : e.getMessage(); }
            finally { activeRequest = null; busy.set(false); }
            if (error != null) call.reject(error); else call.resolve(response);
        });
    }
    @PluginMethod public void cancel(PluginCall call) {
        if (OfflineEngine.AVAILABLE && activeRequest != null && activeRequest.equals(call.getString("requestId"))) OfflineEngine.cancel();
        call.resolve();
    }
    @PluginMethod public void deleteModel(PluginCall call) {
        if (!busy.compareAndSet(false, true)) { call.reject("Stop the current operation before deleting the model."); return; }
        worker.execute(() -> {
            String error = null;
            try {
                if (loaded) OfflineEngine.unload(); loaded = false;
                File target = modelFile(), partial = partFile();
                if ((target.exists() && !target.delete()) || (partial.exists() && !partial.delete())) throw new IOException("Could not delete the model file.");
                getContext().getSharedPreferences("offline_ai", Context.MODE_PRIVATE).edit().remove("verified_sha").apply();
            } catch (Exception e) { error = "Could not remove the model file."; }
            finally { busy.set(false); }
            if (error != null) call.reject(error);
            else { try { call.resolve(status()); } catch (Exception e) { call.reject("Could not read model status."); } }
        });
    }
    @Override protected void handleOnDestroy() {
        if (!destroyed.compareAndSet(false, true)) return;
        synchronized (LIFECYCLE) { instances--; }
        downloadCanceled.set(true);
        if (OfflineEngine.AVAILABLE) OfflineEngine.cancel();
        worker.execute(() -> {
            // A replacement Activity may already own the shared native model.
            synchronized (LIFECYCLE) { if (instances == 0 && OfflineEngine.AVAILABLE) OfflineEngine.unload(); }
            loaded = false;
        });
        worker.shutdown();
    }
}
