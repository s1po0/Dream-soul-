package com.dreamsoul.app;

/** All inference is local. This class has no network or credential access. */
public final class OfflineEngine {
    public static final boolean AVAILABLE;
    static {
        boolean available;
        try { System.loadLibrary("dreamsoul_llm"); available = true; }
        catch (UnsatisfiedLinkError error) { available = false; }
        AVAILABLE = available;
    }
    public interface TokenCallback { void onToken(byte[] utf8); }
    public static native void load(String path, int threads);
    public static native byte[] generate(String[] roles, String[] content, int maxTokens, TokenCallback callback);
    public static native void prepare();
    public static native void cancel();
    public static native void unload();
    private OfflineEngine() {}
}
