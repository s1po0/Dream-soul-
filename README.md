# DreamSoul

A mobile-first, adults-only AI character chat app. Designed at **390px**, with a dark charcoal/lavender/rose identity, original AI-generated character art, a bottom tab bar on phones, and an expanded desktop layout.

**Stack:** Vite · React 19 · TypeScript · TanStack Router · Tailwind CSS 4 · Supabase · Vitest · Playwright.

## Run

```bash
npm ci
npm run dev          # http://localhost:5173, bound to 0.0.0.0
npm run build       # TypeScript + production build
npm run preview
npm test            # unit tests
npx playwright install chromium
npm run test:e2e    # phone + desktop browser flows
```

The checked-in `src/lib/project-config.ts` contains the connected project's **public URL and publishable key only**. These are designed to be public; row-level security protects data. No service-role credential or LLM key is included.

To use another project, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. To explicitly disable the connection, set `VITE_LOCAL_ONLY=true`.

## Current connected backend

The existing project was restored with permission. The following were deployed:

- `profiles`, `characters`, `chats`, `messages`, `favorites`, `reports`, and `character_blocks`.
- RLS and column-level write grants, owner-only profiles/conversations, public/private character access.
- Public `avatars` bucket with 5 MB JPG/PNG/WebP limit and user-folder write/delete policies.
- Six curated starter characters. Their initial counts and ratings are **illustrative sample data**, not real community activity. Replace/reset these before public launch.
- `chat` and `delete-account` Edge Functions, both authenticating user JWTs themselves.
- Email auth with email verification left enabled. Local development and Arena preview redirect URLs are allowed.

**Cloud-mode setup (not needed for Offline AI):**

1. The connected project already has `LLM_API_KEY`, but a real provider request returned **HTTP 429 / quota or billing** on 2026-10-19. Fix provider credit/limits for cloud chat. For a fresh project, add `LLM_API_KEY` in **Supabase → Edge Functions → Secrets**. Never add this to a `VITE_*` variable, source code, or chat. Optional secrets: `LLM_BASE_URL` (default `https://api.openai.com/v1`), `LLM_MODEL` (default `gpt-4o-mini`), and `ALLOWED_ORIGINS` (comma-separated exact origins).
2. In **Authentication → Sign In / Providers → Google**, enable Google and configure your Google OAuth client ID/secret. Use the callback URL Supabase displays. The UI checks provider availability and shows a helpful error rather than redirecting to a broken provider URL.
3. For production, set the actual Auth Site URL, narrow the redirect allowlist to your deployment, set `ALLOWED_ORIGINS` to your exact deployment origin, and configure a production SMTP provider. The built-in email sender is rate-limited and not suitable for unrestricted public registration.

Without an LLM secret, the live function returns a useful **503 configuration error** before storing or consuming a generation. It does **not** silently substitute a demo reply. The real OpenAI round-trip was verified to reach the provider, which refused generation because of quota/billing; a successful cloud reply is not claimed. Google OAuth remains unconfigured/unverified.

## Real Android Offline AI

The **1.1.0-offline-preview** Android build adds actual CPU inference using **llama.cpp** and **Qwen2.5-0.5B Instruct Q4_K_M**. This is not the scripted demo. Publishing is gated on the real Android model/inference test described below; older APK previews do not include this engine.

**Published and verified:** [Android Preview #9 — download APK](https://github.com/s1po0/Dream-soul-/releases/download/android-preview-9/DreamSoul-preview.apk) ([release notes](https://github.com/s1po0/Dream-soul-/releases/tag/android-preview-9)). APK: 19,817,010 bytes. SHA-256: `909adc0ae21f3ca94028931015972f3e389b1f75e39fa2085ebff667696bf3fe`.

The [Android validation/release run 39289529829](https://github.com/s1po0/Dream-soul-/actions/runs/39289529829) passed: real native HTTPS resume/download/verification; actual prompt-dependent JNI replies, recent-message context, streamed UTF-8 equality, cancellation and retry with **no active device network**; model deletion; APK signing verification and publication. Source: `677c27db6019f9273f57d776765d02aac16c4012`. The [web CI run 39289529811](https://github.com/s1po0/Dream-soul-/actions/runs/39289529811) also passed all 35 units and 12 phone/desktop browser flows.

### Use it on a phone

1. Install an APK whose release notes explicitly say **real Offline AI** from [GitHub Releases](https://github.com/s1po0/Dream-soul-/releases).
2. Open **Offline AI** from the header/menu. On Wi-Fi, tap **Download free model**. Keep the app open. Interrupted downloads can resume.
3. Tap **Use Offline AI**, choose a local profile, and confirm you are 18 or older. You do not need a cloud account or API key.
4. Pick a bundled character or create a local character, then chat. After setup, replies work with Wi-Fi/mobile data turned off. Regenerate, edit the last message, restart, and stop generation are supported.

**Requirements:** 64-bit Android 7.0+ (`arm64-v8a` or `x86_64`), **4–6 GB RAM recommended**, and approximately **1 GB free storage** during setup. The separate model download is **491,400,032 bytes (~491 MB / 469 MiB)**. Normal network/data charges may apply; there are **no API generation charges or provider credentials** for local replies.

| Mode | Reply source | History | Network / limits |
|---|---|---|---|
| Offline AI | Real local Qwen model via native llama.cpp | Device-only, separate from demo | Initial model download; no API hourly generation limit |
| Cloud account | Configured server-side LLM provider | Owner-protected Supabase records | Internet, provider credit, 30 generations/hour |
| Local demo | Explicitly scripted examples | Device-only | Public catalog can load online; 30/hour browser-side preview cap |

**Honest limitations:** this small model is less capable than cloud AI, can repeat itself or make mistakes, and has best-effort—not guaranteed—safety filtering. Defaults remain safe-for-work and adults-only. Generation uses battery, can warm the phone, and varies greatly in speed by hardware. Context is capped at **2,048 tokens** and each reply at **256 tokens**. The prompt includes the character and up to the latest 20 messages that fit; older messages are removed from the prompt, not deleted from stored history. It is not professional advice or a substitute for real-world relationships.

### Local privacy, storage, and switching modes

- When Offline AI is on, automatic Supabase auth refresh, catalog, favorites/history, and chat networking are paused. On offline boot the Supabase client is not constructed at all, including when an expired cloud session is stored. An existing cloud session/data is retained and used again only after an explicit **Return to online / demo mode** action.
- Only bundled starter and locally created characters are shown. Local characters/preferences can be reused between the two local modes, but offline conversations/drafts use separate `dreamsoul:offline:*` storage keys so scripted history is not presented as real-model history.
- Chat messages, profiles, drafts, and local creations are in app-private WebView storage. The model is in private native files (`files/models/dreamsoul-light.gguf`). Android app/cloud-backup and device-transfer rules exclude these files. DreamSoul does not provide a backup for local content.
- Local storage has a capacity limit. Offline saves report an error if required storage is full/unavailable rather than pretending to save. Keep local portraits small; clearing old conversations frees local capacity. Uninstalling or clearing app data removes local content.
- **Profile → Settings → Clear all local data** clears local profiles, conversations, favorites, and creations without deleting an existing cloud account. **Offline AI → Remove local model** frees model storage without deleting chats.
- Native failures show a real error with retry/setup actions. There is **no fallback to scripted or paid cloud replies**. A pending user message is saved before inference, so it can be retried after interruption/restart. Local reports remain on-device, clearly not submitted to moderators.

### Model integrity and licenses

`public/offline-model.json` pins the official model's revision, exact size, and SHA-256. Official metadata was confirmed by Actions run [39279343350](https://github.com/s1po0/Dream-soul-/actions/runs/39279343350). Downloads follow HTTPS only to Hugging Face delivery hosts, support HTTP Range resume, and are SHA-256 verified before installation and cold loading. Weights are never committed to Git, bundled in the APK, or sent to Supabase. The initial download contacts Hugging Face/CDN servers (IP/request metadata only, not chats).

The native engine is pinned to llama.cpp source commit `620d2225cc436ab0b001e3200e590e3b286ef9ab`, with its source archive checksum checked by CMake. Engine: MIT. Model: Apache 2.0. Full licenses and provenance are bundled under `public/licenses/`.

## Explore without credentials

Choose **Sign in → Try a local demo**, pick a username/avatar, and confirm you are 18+. This mode supports creating/editing/deleting characters, favorites, persistent conversations, a simulated typing/streaming experience, editing the last message, regenerating, restarting, blocking/unblocking, and settings.

**Demo replies are scripted, not model-generated.** All demo data and uploads stay in this browser. Demo reports are clearly labeled as local and are not submitted to moderation. Connected accounts use the real database and server functions instead. The public catalog is available to visitors. Curated fallback cards remain usable if the catalog is temporarily unreachable.

## Fresh Supabase project

Do **not** rerun the foundation against the already-configured connected project: it has already been installed. For a fresh project:

```bash
supabase init                         # only if initializing a new local setup
supabase link --project-ref YOUR_REF
supabase db push                      # installs supabase/migrations
# Run supabase/seed.sql once in the SQL editor if you want the sample catalog.
supabase functions deploy chat --no-verify-jwt
supabase functions deploy delete-account --no-verify-jwt
```

Set the secrets and Auth URLs in the dashboard. The functions have `verify_jwt=false` because they explicitly call `auth.getUser(token)` to validate sessions; they never trust an unverified request body or client-supplied user ID. Built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used only inside Edge Functions.

## Chat and security design

- The client sends a character ID, message, and action—not a system prompt or a user ID.
- `begin_chat_turn` is **service-role only**. It validates adulthood/onboarding, character ownership/visibility, safety settings and blocks, then reserves a request atomically.
- A per-user PostgreSQL advisory lock enforces **30 requests per rolling hour** across devices and concurrent requests. Sending, editing, and regenerating all count; restarting does not generate a reply.
- A per-thread lease stops simultaneous reply generation. A unique `(user_id, character_id)` constraint ensures one thread per character.
- Clients cannot insert/update AI messages, edit counters/ratings, or write moderation status. Only the Edge Function persists conversation turns.
- The function constructs the safety prompt + character personality/style + **last 20 stored messages**, calls an OpenAI-compatible provider, streams SSE `start`/`delta`/`done` events, then saves the assistant response. Failed generations unlock the thread and can be retried without duplicating the sent user message.
- Only the latest user message can be edited. Its following reply is replaced. Regeneration replaces the latest reply. Restart deletes the existing thread’s messages.
- Account deletion verifies the authenticated account and exact username, removes that user's avatar folder, then deletes the Auth user; database cascades remove associated private data. Safety reports retain no account identifier after deletion.
- `supabase/tests/security.sql` provides a rollback-only regression test for actual RLS, write grants, concurrency, duplicate threads and the rolling-hour limit. Run it as the database owner against a development/test project.

## Routes

| Route | Purpose |
|---|---|
| `/` | Discover, search, categories, trending/new/top-rated collections |
| `/auth`, `/onboarding`, `/reset-password` | Email/Google auth, 18+ profile setup, recovery |
| `/create`, `/characters/:id/edit` | Character studio, upload, live preview, ownership controls |
| `/chat/:id`, `/chats` | Conversation, history, streaming and safety controls |
| `/offline` | Native model download/resume, device requirements, activation, removal, and explicit mode switching |
| `/favorites`, `/profile` | Saved souls, creations, account and safety settings |
| `/terms`, `/privacy` | Community guidelines and data handling |

## PWA and hosting

`public/manifest.webmanifest`, regular/maskable PNG icons, an Apple touch icon, and a production-only service worker support installation and offline app-shell loading. Private/auth/API responses are **never cached** by the service worker. Offline demo conversations work locally; connected chat requires a network connection.

Deploy `dist/` to a static host that rewrites application routes to `index.html`. An example `vercel.json` is included. All assets and fonts are self-hosted. The Vite preview accepts Arena's `*.e2b.app` host, and all app navigation is same-origin; there are no browser-facing localhost API calls.

## Before a public launch

- Replace example activity counts/ratings and decide on a real ratings workflow.
- Configure LLM, Google OAuth, SMTP, exact allowed origins and production URLs.
- Add provider-side moderation/abuse detection and a staffed report-review process. A safety prompt is not a complete moderation system.
- Publish the operator's identity and monitored support/privacy contact; complete legal review of the included starter Terms and Privacy pages.
- Review storage quotas, anti-bot protections, backup retention, content policies and provider data-processing terms.

## Verification completed

- TypeScript and production build pass.
- 35 Vitest checks pass, including arbitrary SSE framing/UTF-8 chunk boundaries.
- 12 Playwright flows pass at 390px and desktop widths, including real keystrokes in the edit dialog and no horizontal overflow on the main pages. External auth/catalog APIs are mocked in browser tests; demo conversations are exercised end to end. Offline browser checks prove no cloud requests (even with an expired saved session), separate histories, persistent pending messages, explicit switching, and honest errors without a native engine.
- The rollback-only SQL regression was also run against the connected Supabase project: owner isolation, anonymous/public/private access, protected message/counter writes, service-only RPCs, concurrent chat locking, one thread per character, and the 30/hour cap all pass. Fixtures were rolled back.
- The pinned native C++ engine and JNI bridge compile on the Linux host. The Android runtime was also tested successfully in the release-gating emulator run linked above: real native download/resume + SHA-256 verification, real model inference, streamed UTF-8, recent-message context, cancellation/retry, and removal **after disabling device networking**. This is an emulator check, not a speed/RAM benchmark for every physical phone.
- `npm audit` reports no known dependency vulnerabilities at build time.
- A real OpenAI request was tested on 2026-10-19: it returned HTTP 429 with a quota/billing-related failure. The key is configured, but successful live replies remain blocked on the provider account. Google OAuth remains unverified/unconfigured.

## Android APK

DreamSoul also has a Capacitor 8 Android shell (`com.dreamsoul.app`, 64-bit Android 7.0+). The app is bundled locally rather than loading a hosted website. Native builds skip the PWA service worker, use branded launcher/splash assets, handle Android's back button, and support sign-in/recovery callbacks through `com.dreamsoul.app://auth/callback`.

### Download

Open [GitHub Releases](https://github.com/s1po0/Dream-soul-/releases) and download **DreamSoul-preview.apk** from the newest Android preview. Android may ask you to allow installation from your browser/file manager. This is a **debug-signed testing build**, not a production or Play Store release; debugging is enabled, and it should not be used for sensitive conversations. A SHA-256 checksum is published with the APK.

### Automatic build

The **Android APK** GitHub Actions workflow builds the CPU engine for arm64/x86_64, exercises a real Android emulator with the official model, verifies the APK signature, uploads an Actions artifact, and creates a prerelease with APK/checksum downloads. It runs on app changes pushed to `arena/15a781b8-dream-soul` and can be manually rerun using that branch. Release tags identify the exact source commit.

The initial preview uses the Android debug signing key. A best-effort Actions cache preserves that key across builds, but it is not a durable or secure production signing setup. If the key changes, uninstall the previous preview before installing the replacement (this clears local offline/demo data). For production updates, use a permanent release keystore stored securely as GitHub Actions secrets, with an offline owner-controlled backup; never commit signing keys or passwords.

### Local Android development

Install Android Studio/SDK 36, Java 21, **NDK 27.3.13750724**, and **CMake 3.22.1**, then:

```bash
npm ci
npm run android:assets    # regenerate the branded native icons/splash screens
npm run android:sync      # build the web app and sync it into Android
npm run android:open      # open in Android Studio
# Or: cd android && ./gradlew assembleDebug
```

The workflow's Android test supplies only a 4 MiB partial model, calls the production Capacitor plugin to resume/download/verify it, turns off device networking, then checks actual prompt-dependent replies, streamed-token equality, context, cancellation recovery, and deletion. `node scripts/offline-model.mjs` is a CI/developer helper that verifies official metadata and downloads a verified test model into excluded `.arena/`; it does not contain credentials.

No weights, APKs, signing keys, local SDK paths, or generated copies of web assets are committed.

### Native backend setup

- Include `https://localhost` in the Edge Functions' allowed origins (Capacitor's on-device origin). If `ALLOWED_ORIGINS` is explicitly configured, include this origin alongside the web deployment's exact origin.
- Include `com.dreamsoul.app://auth/**` in Supabase Auth's redirect allowlist for the native email/Google callback. The app uses PKCE and opens Google OAuth in the system browser, not an embedded sign-in page.
- Email confirmation/recovery links initiated on a phone should be opened on that same phone so the app can exchange its stored PKCE verifier.
- The APK does not include LLM secrets or privileged Supabase keys. Cloud AI and Google OAuth still require the owner configuration described above. Real Offline AI does not.

### Existing AI secret compatibility

The deployed chat function accepts the existing secret named `Dream soul ` (including its trailing space), so the owner does not have to expose or copy its value to fix that naming mismatch. `LLM_API_KEY` remains the recommended name and takes priority; whitespace around either value is trimmed. With the default OpenAI endpoint, an alias that clearly belongs to another provider is rejected rather than sent to OpenAI. Configure `LLM_BASE_URL` and `LLM_MODEL` explicitly for a compatible non-OpenAI provider.

This is a server-only fix: the existing APK does not need to be reinstalled. Provider rejection, model configuration, and billing/rate-limit failures have distinct safe messages; provider responses and credentials are never echoed to clients. Eleven isolated Edge Function regression checks cover key precedence, the existing alias, missing/unknown-provider credentials, native CORS, fragmented Unicode streaming/persistence, error redaction/unlocking, and keyless restart. Tests use only dummy credentials and mocked provider/auth/database adapters, not the owner's real provider account.

### A saved secret is not necessarily a working AI connection

`LLM_API_KEY` must contain an actual API key issued by the selected **AI provider**. A Supabase publishable/service key, GitHub token, project password, secret name, or the SHA-256 digest shown by the management API is not a replacement. Save the original provider-issued value directly in Supabase Edge Function secrets; never paste it in chat, commit it, or add it to a `VITE_` variable.

The default provider is OpenAI. Create its key at https://platform.openai.com/api-keys and ensure the provider account has API quota. If using a different provider, identify its website first and configure its documented OpenAI-compatible endpoint/model; do not send unknown credentials to guessed providers. Merely finding a secret or passing mocked tests does not verify a live reply.

A temporary server-side classification check was used during diagnosis and then removed. It returned only predefined key-family/format labels, never credential values, and made no AI-generation requests.

### Verified provider blocker (2026-10-19)

A small live request from the connected backend to OpenAI returned **HTTP 429**, with a quota/billing-related error. This is separate from DreamSoul's own 30-messages/hour allowance and is not fixed by reinstalling the APK or creating another key on the same provider account. The owner must check [OpenAI API billing](https://platform.openai.com/settings/organization/billing/overview) and [API/project limits](https://platform.openai.com/settings/organization/limits), then retry. ChatGPT subscription billing and API usage are separate. No existing user chats were used in the test.

The server now returns redacted `AI_PROVIDER_QUOTA`, `AI_PROVIDER_RATE_LIMIT`, `AI_PROVIDER_AUTH`, or `AI_PROVIDER_MODEL` codes with distinct messages. It never forwards raw provider errors, which may include sensitive account/key details. Temporary diagnostic infrastructure is removed after testing.
