package com.dreamsoul.app;

import static org.junit.Assert.*;

import android.content.Context;
import android.net.ConnectivityManager;
import android.os.ParcelFileDescriptor;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real GGUF + real JNI, not mocked inference. CI must supply only a 4 MiB .part prefix. */
@RunWith(AndroidJUnit4.class)
public class OfflineEngineTest {
    private static class AwaitCall extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1);
        volatile JSObject value;
        volatile String failure;
        AwaitCall(String method, JSObject data) { super(null, "OfflineAI", UUID.randomUUID().toString(), method, data); }
        @Override public void resolve(JSObject data) { value = data; done.countDown(); }
        @Override public void resolve() { resolve(new JSObject()); }
        @Override public void reject(String message) { failure = message; done.countDown(); }
        JSObject result(long seconds) throws Exception {
            assertTrue("Native operation timed out", done.await(seconds, TimeUnit.SECONDS));
            assertNull("Native operation failed: " + failure, failure);
            assertNotNull("Native operation returned no result", value);
            return value;
        }
    }
    private static class Tokens extends PluginCall {
        final ConcurrentHashMap<String, StringBuffer> streams = new ConcurrentHashMap<>();
        Tokens() { super(null, "OfflineAI", "test-tokens", "addListener", new JSObject().put("eventName", "token")); }
        @Override public void resolve(JSObject event) {
            streams.computeIfAbsent(event.getString("requestId"), key -> new StringBuffer()).append(event.getString("delta"));
        }
    }
    private JSArray messages(String... roleContent) {
        JSArray result = new JSArray();
        for (int i = 0; i < roleContent.length; i += 2) result.put(new JSObject().put("role", roleContent[i]).put("content", roleContent[i + 1]));
        return result;
    }
    private JSObject status(OfflineAIPlugin plugin) throws Exception {
        AwaitCall call = new AwaitCall("getStatus", new JSObject()); plugin.getStatus(call); return call.result(5);
    }
    private String generate(OfflineAIPlugin plugin, Tokens tokens, JSArray messages) throws Exception {
        String id = UUID.randomUUID().toString();
        AwaitCall call = new AwaitCall("generate", new JSObject().put("requestId", id).put("messages", messages).put("maxTokens", 64));
        plugin.generate(call);
        String text = call.result(90).getString("text");
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {}); // Drain token events before comparing.
        assertNotNull(tokens.streams.get(id));
        assertEquals("UTF-8 streamed tokens must equal the final reply", text, tokens.streams.get(id).toString());
        assertFalse(text.trim().isEmpty());
        assertFalse("Broken Unicode in a native reply", text.contains("\uFFFD"));
        assertFalse(status(plugin).getBoolean("busy"));
        return text.toLowerCase(java.util.Locale.ROOT);
    }
    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor.AutoCloseInputStream in = new ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command))) {
            byte[] buffer = new byte[2048]; while (in.read(buffer) != -1) { /* Wait for command completion. */ }
        }
    }
    @Test(timeout = 360000)
    public void realDownloadResumeThenInferenceWithoutInternet() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue("The CPU JNI library must be packaged for this ABI", OfflineEngine.AVAILABLE);
        File partial = new File(context.getFilesDir(), "models/dreamsoul-light.part");
        assertEquals("CI must supply a partial file, not bypass the native downloader", 4L * 1024 * 1024, partial.length());
        AtomicReference<OfflineAIPlugin> ref = new AtomicReference<>();
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            activity.onActivity(main -> {
                assertNotNull("OfflineAI must be registered in the Capacitor bridge", main.getBridge().getPlugin("OfflineAI"));
                ref.set((OfflineAIPlugin) main.getBridge().getPlugin("OfflineAI").getInstance());
            });
            OfflineAIPlugin plugin = ref.get();
            JSObject before = status(plugin);
            assertTrue(before.getBoolean("supported")); assertFalse(before.getBoolean("downloaded"));
            assertEquals(partial.length(), before.getLong("bytesDownloaded"));
            AwaitCall download = new AwaitCall("download", new JSObject()); plugin.download(download);
            JSObject installed = download.result(240);
            assertTrue("Native HTTPS download and SHA-256 verification must succeed", installed.getBoolean("downloaded"));
            assertFalse(installed.getBoolean("busy")); assertFalse(installed.getBoolean("downloading"));
            assertFalse("Completed partial file should be renamed", partial.exists());

            shell("cmd connectivity airplane-mode enable"); shell("svc wifi disable"); shell("svc data disable");
            ConnectivityManager networks = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            long deadline = System.currentTimeMillis() + 10000;
            while (networks.getActiveNetwork() != null && System.currentTimeMillis() < deadline) Thread.sleep(100);
            assertNull("Inference must run with no active network", networks.getActiveNetwork());

            AwaitCall load = new AwaitCall("loadModel", new JSObject()); plugin.loadModel(load); load.result(60);
            assertTrue(status(plugin).getBoolean("loaded")); assertFalse(status(plugin).getBoolean("busy"));
            Tokens tokens = new Tokens(); plugin.addListener(tokens);
            String system = "You are Lumi, a friendly adult fictional companion. Follow instructions. Keep replies short. The garden has a moon 🌙.";
            assertTrue("The real model must follow a new prompt", generate(plugin, tokens, messages("system", system, "user", "Reply with only the word violet.")).contains("violet"));
            assertTrue("The real model must use recent conversation context", generate(plugin, tokens, messages("system", system, "user", "My favorite word is starlight.", "assistant", "I will remember that.", "user", "What is my favorite word? Reply with only that word.")).contains("starlight"));

            String canceledId = UUID.randomUUID().toString();
            AwaitCall canceled = new AwaitCall("generate", new JSObject().put("requestId", canceledId).put("messages", messages("system", system, "user", "Tell me a long story.")).put("maxTokens", 256));
            plugin.generate(canceled);
            AwaitCall cancel = new AwaitCall("cancel", new JSObject().put("requestId", canceledId)); plugin.cancel(cancel); cancel.result(5);
            assertTrue(canceled.done.await(30, TimeUnit.SECONDS)); assertNotNull("A canceled generation must reject", canceled.failure);
            assertTrue(canceled.failure.toLowerCase(java.util.Locale.ROOT).contains("stopped"));
            assertTrue("A new request must work after cancellation", generate(plugin, tokens, messages("system", system, "user", "Reply with only the word comet.")).contains("comet"));
            assertNull("All replies above were generated without internet", networks.getActiveNetwork());

            AwaitCall remove = new AwaitCall("deleteModel", new JSObject()); plugin.deleteModel(remove);
            JSObject removed = remove.result(15); assertFalse(removed.getBoolean("downloaded")); assertFalse(removed.getBoolean("loaded")); assertFalse(removed.getBoolean("busy"));
        }
    }
}
