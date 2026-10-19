#include <jni.h>
#include "llama.h"
#include <algorithm>
#include <atomic>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
std::mutex model_mutex;
std::once_flag backend_once;
std::atomic<bool> canceled{false};
llama_model * model = nullptr;
int threads = 2;
constexpr int context_size = 2048;

// JNI's modified UTF-8 corrupts supplementary characters; convert UTF-16 explicitly.
std::string utf8(JNIEnv * env, jstring input) {
    if (!input) return {};
    const jchar * chars = env->GetStringChars(input, nullptr);
    if (!chars) throw std::runtime_error("Not enough memory for this message.");
    const jsize length = env->GetStringLength(input);
    std::string out;
    for (jsize i = 0; i < length; ++i) {
        uint32_t cp = chars[i];
        if (cp >= 0xd800 && cp <= 0xdbff) {
            if (i + 1 < length && chars[i + 1] >= 0xdc00 && chars[i + 1] <= 0xdfff) {
                cp = 0x10000 + ((cp - 0xd800) << 10) + (chars[++i] - 0xdc00);
            } else cp = 0xfffd;
        } else if (cp >= 0xdc00 && cp <= 0xdfff) cp = 0xfffd;
        if (cp < 0x80) out.push_back(static_cast<char>(cp));
        else if (cp < 0x800) {
            out.push_back(static_cast<char>(0xc0 | (cp >> 6)));
            out.push_back(static_cast<char>(0x80 | (cp & 63)));
        } else if (cp < 0x10000) {
            out.push_back(static_cast<char>(0xe0 | (cp >> 12)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 63)));
            out.push_back(static_cast<char>(0x80 | (cp & 63)));
        } else {
            out.push_back(static_cast<char>(0xf0 | (cp >> 18)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 63)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 63)));
            out.push_back(static_cast<char>(0x80 | (cp & 63)));
        }
    }
    env->ReleaseStringChars(input, chars);
    return out;
}
jbyteArray bytes(JNIEnv * env, const std::string & text) {
    auto result = env->NewByteArray(static_cast<jsize>(text.size()));
    if (result) env->SetByteArrayRegion(result, 0, text.size(), reinterpret_cast<const jbyte *>(text.data()));
    return result;
}
size_t complete_utf8(const std::string & text) {
    size_t i = 0;
    while (i < text.size()) {
        const auto c = static_cast<unsigned char>(text[i]);
        const size_t n = c < 0x80 ? 1 : (c & 0xe0) == 0xc0 ? 2 : (c & 0xf0) == 0xe0 ? 3 : (c & 0xf8) == 0xf0 ? 4 : 1;
        if (i + n > text.size()) break;
        i += n;
    }
    return i;
}
void fail(JNIEnv * env, const char * message) {
    if (!env->ExceptionCheck()) env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), message);
}
std::string format(const std::vector<std::string> & roles, const std::vector<std::string> & content) {
    std::vector<llama_chat_message> messages;
    for (size_t i = 0; i < roles.size(); ++i) messages.push_back({roles[i].c_str(), content[i].c_str()});
    const char * tmpl = llama_model_chat_template(model, nullptr);
    if (!tmpl) tmpl = "chatml";
    std::vector<char> buffer(16384);
    int n = llama_chat_apply_template(tmpl, messages.data(), messages.size(), true, buffer.data(), buffer.size());
    if (n < 0) throw std::runtime_error("This model's conversation template is unsupported.");
    if (n > static_cast<int>(buffer.size())) {
        buffer.resize(n + 1);
        n = llama_chat_apply_template(tmpl, messages.data(), messages.size(), true, buffer.data(), buffer.size());
    }
    return std::string(buffer.data(), n);
}
}

extern "C" JNIEXPORT void JNICALL Java_com_dreamsoul_app_OfflineEngine_load(JNIEnv * env, jclass, jstring path, jint n_threads) {
    std::lock_guard<std::mutex> lock(model_mutex);
    try {
        if (model) return;
        std::call_once(backend_once, [] {
            // Never log prompts, generated text, or the contents of model files.
            llama_log_set([](ggml_log_level, const char *, void *) {}, nullptr);
            llama_backend_init();
        });
        auto params = llama_model_default_params();
        params.n_gpu_layers = 0;
        params.load_mode = LLAMA_LOAD_MODE_MMAP;
        model = llama_model_load_from_file(utf8(env, path).c_str(), params);
        if (!model) throw std::runtime_error("The local model could not be loaded. Free memory and try again.");
        threads = std::clamp(static_cast<int>(n_threads), 1, 4);
    } catch (const std::exception & error) { fail(env, error.what()); }
}
extern "C" JNIEXPORT void JNICALL Java_com_dreamsoul_app_OfflineEngine_prepare(JNIEnv *, jclass) { canceled.store(false); }
extern "C" JNIEXPORT void JNICALL Java_com_dreamsoul_app_OfflineEngine_cancel(JNIEnv *, jclass) { canceled.store(true); }
extern "C" JNIEXPORT void JNICALL Java_com_dreamsoul_app_OfflineEngine_unload(JNIEnv *, jclass) {
    std::lock_guard<std::mutex> lock(model_mutex);
    if (model) { llama_model_free(model); model = nullptr; }
}
extern "C" JNIEXPORT jbyteArray JNICALL Java_com_dreamsoul_app_OfflineEngine_generate(JNIEnv * env, jclass, jobjectArray role_array, jobjectArray content_array, jint requested, jobject callback) {
    std::lock_guard<std::mutex> lock(model_mutex);
    try {
        if (!model) throw std::runtime_error("Download and load the offline model first.");
        const int max_tokens = std::clamp(static_cast<int>(requested), 1, 256);
        const int count = env->GetArrayLength(role_array);
        if (count < 2 || count > 21 || env->GetArrayLength(content_array) != count) throw std::runtime_error("Invalid offline conversation.");
        std::vector<std::string> roles, content;
        for (int i = 0; i < count; ++i) {
            auto role = static_cast<jstring>(env->GetObjectArrayElement(role_array, i));
            auto text = static_cast<jstring>(env->GetObjectArrayElement(content_array, i));
            roles.push_back(utf8(env, role)); content.push_back(utf8(env, text));
            env->DeleteLocalRef(role); env->DeleteLocalRef(text);
        }
        const auto * vocab = llama_model_get_vocab(model);
        std::vector<llama_token> tokens;
        while (true) {
            const auto prompt = format(roles, content);
            const int n = -llama_tokenize(vocab, prompt.data(), prompt.size(), nullptr, 0, true, true);
            if (n <= 0 || n > 65536) throw std::runtime_error("The offline prompt is too large.");
            if (n <= context_size - max_tokens - 8) {
                tokens.resize(n);
                if (llama_tokenize(vocab, prompt.data(), prompt.size(), tokens.data(), n, true, true) < 0) throw std::runtime_error("Could not prepare this message.");
                break;
            }
            if (roles.size() > 2) { roles.erase(roles.begin() + 1); content.erase(content.begin() + 1); }
            else if (content.front().size() > 1200) {
                const size_t end = complete_utf8(content.front().substr(0, content.front().size() - 256));
                content.front().resize(end);
            } else throw std::runtime_error("This message is too long for the lightweight model. Please shorten it.");
        }
        auto params = llama_context_default_params();
        params.n_ctx = context_size; params.n_batch = 256; params.n_ubatch = 128;
        params.n_threads = threads; params.n_threads_batch = threads; params.no_perf = true;
        params.abort_callback = [](void *) { return canceled.load(); };
        std::unique_ptr<llama_context, decltype(&llama_free)> ctx(llama_init_from_model(model, params), llama_free);
        if (!ctx) throw std::runtime_error("Not enough memory for local AI. Close other apps and try again.");
        for (size_t offset = 0; offset < tokens.size(); offset += 256) {
            if (canceled.load()) throw std::runtime_error("Reply stopped.");
            auto batch = llama_batch_get_one(tokens.data() + offset, std::min<size_t>(256, tokens.size() - offset));
            if (llama_decode(ctx.get(), batch) != 0) throw std::runtime_error(canceled.load() ? "Reply stopped." : "Local AI could not process this message.");
        }
        std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)> sampler(llama_sampler_chain_init(llama_sampler_chain_default_params()), llama_sampler_free);
        llama_sampler_chain_add(sampler.get(), llama_sampler_init_penalties(llama_vocab_n_tokens(vocab), 64, 1.12f, 0, 0));
        llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_k(40));
        llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_p(0.9f, 1));
        llama_sampler_chain_add(sampler.get(), llama_sampler_init_temp(0.8f));
        llama_sampler_chain_add(sampler.get(), llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
        auto callback_class = env->GetObjectClass(callback);
        auto on_token = env->GetMethodID(callback_class, "onToken", "([B)V");
        if (!on_token) throw std::runtime_error("Could not open the local reply stream.");
        std::string full, pending;
        for (int i = 0; i < max_tokens && !canceled.load(); ++i) {
            llama_token token = llama_sampler_sample(sampler.get(), ctx.get(), -1);
            if (llama_vocab_is_eog(vocab, token)) break;
            std::vector<char> piece(256);
            int n = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0, false);
            if (n < 0) { piece.resize(-n); n = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0, false); }
            if (n < 0) throw std::runtime_error("Could not decode the local reply.");
            full.append(piece.data(), n); pending.append(piece.data(), n);
            const size_t complete = complete_utf8(pending);
            if (complete) {
                auto delta = bytes(env, pending.substr(0, complete));
                env->CallVoidMethod(callback, on_token, delta); env->DeleteLocalRef(delta);
                if (env->ExceptionCheck()) return nullptr;
                pending.erase(0, complete);
            }
            auto batch = llama_batch_get_one(&token, 1);
            if (llama_decode(ctx.get(), batch) != 0) {
                if (canceled.load()) break;
                throw std::runtime_error("Local AI was interrupted. Please try again.");
            }
        }
        env->DeleteLocalRef(callback_class);
        if (canceled.load()) throw std::runtime_error("Reply stopped.");
        if (full.empty()) throw std::runtime_error("The model returned an empty reply. Try a shorter message.");
        return bytes(env, full);
    } catch (const std::exception & error) { fail(env, error.what()); return nullptr; }
}
