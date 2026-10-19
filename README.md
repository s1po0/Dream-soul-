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

**Still requires owner configuration:**

1. Add `LLM_API_KEY` in **Supabase → Edge Functions → Secrets**. Never add this to a `VITE_*` variable, source code, or chat. Optional secrets: `LLM_BASE_URL` (default `https://api.openai.com/v1`), `LLM_MODEL` (default `gpt-4o-mini`), and `ALLOWED_ORIGINS` (comma-separated exact origins).
2. In **Authentication → Sign In / Providers → Google**, enable Google and configure your Google OAuth client ID/secret. Use the callback URL Supabase displays. The UI checks provider availability and shows a helpful error rather than redirecting to a broken provider URL.
3. For production, set the actual Auth Site URL, narrow the redirect allowlist to your deployment, set `ALLOWED_ORIGINS` to your exact deployment origin, and configure a production SMTP provider. The built-in email sender is rate-limited and not suitable for unrestricted public registration.

Without an LLM secret, the live function returns a useful **503 configuration error** before storing or consuming a generation. It does **not** silently substitute a demo reply. Live LLM and Google OAuth round-trips cannot be verified until those credentials are configured.

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
- 22 Vitest checks pass, including arbitrary SSE framing/UTF-8 chunk boundaries.
- 8 Playwright flows pass at 390px and desktop widths, including real keystrokes in the edit dialog and no horizontal overflow on the main pages. External auth/catalog APIs are mocked in browser tests; demo conversations are exercised end to end.
- The rollback-only SQL regression was also run against the connected Supabase project: owner isolation, anonymous/public/private access, protected message/counter writes, service-only RPCs, concurrent chat locking, one thread per character, and the 30/hour cap all pass. Fixtures were rolled back.
- `npm audit` reports no known dependency vulnerabilities at build time.
- Live provider-generated replies and Google OAuth remain unverified until the owner supplies those provider credentials.

## Android APK

DreamSoul also has a Capacitor 8 Android shell (`com.dreamsoul.app`, Android 7.0+). The app is bundled locally rather than loading a hosted website. Native builds skip the PWA service worker, use branded launcher/splash assets, handle Android's back button, and support sign-in/recovery callbacks through `com.dreamsoul.app://auth/callback`.

### Download

Open [GitHub Releases](https://github.com/s1po0/Dream-soul-/releases) and download **DreamSoul-preview.apk** from the newest Android preview. Android may ask you to allow installation from your browser/file manager. This is a **debug-signed testing build**, not a production or Play Store release; debugging is enabled, and it should not be used for sensitive conversations. A SHA-256 checksum is published with the APK.

### Automatic build

The **Android APK** GitHub Actions workflow builds, verifies the APK signature, uploads an Actions artifact, and creates a prerelease with APK/checksum downloads. It runs on app changes pushed to `arena/15a781b8-dream-soul` and can be manually rerun using that branch. Release tags identify the exact source commit.

The initial preview uses the Android debug signing key. A best-effort Actions cache preserves that key across builds, but it is not a durable or secure production signing setup. If the key changes, uninstall the previous preview before installing the replacement (this clears local demo data). For production updates, use a permanent release keystore stored securely as GitHub Actions secrets, with an offline owner-controlled backup; never commit signing keys or passwords.

### Local Android development

Install Android Studio/SDK 36 and Java 21, then:

```bash
npm ci
npm run android:assets    # regenerate the branded native icons/splash screens
npm run android:sync      # build the web app and sync it into Android
npm run android:open      # open in Android Studio
# Or: cd android && ./gradlew assembleDebug
```

No APKs, signing keys, local SDK paths, or generated copies of web assets are committed.

### Native backend setup

- Include `https://localhost` in the Edge Functions' allowed origins (Capacitor's on-device origin). If `ALLOWED_ORIGINS` is explicitly configured, include this origin alongside the web deployment's exact origin.
- Include `com.dreamsoul.app://auth/**` in Supabase Auth's redirect allowlist for the native email/Google callback. The app uses PKCE and opens Google OAuth in the system browser, not an embedded sign-in page.
- Email confirmation/recovery links initiated on a phone should be opened on that same phone so the app can exchange its stored PKCE verifier.
- The APK does not include LLM secrets or privileged Supabase keys. Live AI and Google OAuth still require the owner configuration described above.

### Existing AI secret compatibility

The deployed chat function accepts the existing secret named `Dream soul ` (including its trailing space), so the owner does not have to expose or copy its value to fix that naming mismatch. `LLM_API_KEY` remains the recommended name and takes priority; whitespace around either value is trimmed. With the default OpenAI endpoint, an alias that clearly belongs to another provider is rejected rather than sent to OpenAI. Configure `LLM_BASE_URL` and `LLM_MODEL` explicitly for a compatible non-OpenAI provider.

This is a server-only fix: the existing APK does not need to be reinstalled. Provider rejection, model configuration, and billing/rate-limit failures have distinct safe messages; provider responses and credentials are never echoed to clients. Eight isolated Edge Function regression checks cover key precedence, the existing alias, missing/unknown-provider credentials, native CORS, fragmented Unicode streaming/persistence, error redaction/unlocking, and keyless restart. Tests use only dummy credentials and mocked provider/auth/database adapters, not the owner's real provider account.
