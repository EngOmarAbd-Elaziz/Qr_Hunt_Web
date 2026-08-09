# QR Hunt — Complete k6 Load Test Pre-Analysis

> Based exclusively on source-code inspection. No assumptions made.

---

## 1. Deployment

| Item | Value |
|------|-------|
| **Frontend host** | GitHub Pages |
| **Deploy trigger** | Push to `main` branch via `.github/workflows/deploy.yml` |
| **Vite `base`** | `/Qr_Hunt_Web/` (hardcoded in `vite.config.ts`) |
| **Production URL** | **Unknown** — the GitHub username / org is a placeholder (`yourusername`) in the README. The URL pattern would be `https://<username>.github.io/Qr_Hunt_Web/` but the actual username is not in the repository. |
| **Supabase project URL** | `https://ruigydgxrmafjvkghehh.supabase.co` (read from `.env`) |
| **Supabase anon key** | Present in `.env` (full JWT visible) |

> [!IMPORTANT]
> The GitHub Pages hostname is not deterministic from the repo alone. It depends on the owner's GitHub username. This is the **only** deployment detail missing.

---

## 2. Authentication

| Item | Detail |
|------|--------|
| **Required before play?** | Yes. Every protected action calls `auth.uid()` server-side and throws if `NULL`. |
| **Auth method** | **Supabase Anonymous Sign-In** (`supabase.auth.signInAnonymously()`) |
| **Session storage** | Supabase JS SDK manages the session via `localStorage` (key: `sb-<project>-auth-token`). The app also writes the user UUID to `localStorage` under `qr_hunt_player_id` as a secondary check. |
| **Token format** | Standard Supabase JWT (`access_token` + `refresh_token`) |
| **Admin auth** | Email + Password via `supabase.auth.signInWithPassword()` |

### How k6 authenticates

k6 cannot run `signInAnonymously()` natively because that SDK call hits the Supabase Auth REST API directly. The equivalent raw HTTP call is:

```
POST https://ruigydgxrmafjvkghehh.supabase.co/auth/v1/signup
Content-Type: application/json
apikey: <anon_key>

{}   ← empty body triggers anonymous sign-up
```

Response contains `access_token` and `refresh_token`. The `access_token` is then passed as `Authorization: Bearer <token>` on every subsequent PostgREST/RPC call.

**Subsequent sessions** (if the player is already registered): the client calls `auth.getSession()` which reads from `localStorage` — k6 must replicate this by reusing the token from the signup response.

---

## 3. Backend Endpoints

All backend communication goes through the **Supabase REST API** (`https://ruigydgxrmafjvkghehh.supabase.co`). There are no custom Express/Fastify/etc. servers.

The two base paths are:
- **PostgREST** → `/rest/v1/<table>` (table reads)
- **RPC** → `/rest/v1/rpc/<function>` (all writes + business logic)
- **Auth** → `/auth/v1/` (registration / session)
- **Realtime** → WebSocket `wss://ruigydgxrmafjvkghehh.supabase.co/realtime/v1/websocket`

### Complete Endpoint Inventory

| # | Endpoint | Method | Who Calls It | Request Body | Expected Response | Auth Required | Typical Frequency |
|---|----------|--------|--------------|--------------|-------------------|---------------|-------------------|
| 1 | `/auth/v1/signup` | POST | Registration page | `{}` (empty = anon) | `{ access_token, refresh_token, user }` | No (anon key) | Once per player lifetime |
| 2 | `/auth/v1/token?grant_type=refresh_token` | POST | SDK auto-refresh | `{ refresh_token }` | New `access_token` | No | Every ~55 min |
| 3 | `/rest/v1/rpc/register_player` | POST | Registration | `{ p_name, p_code }` | `{ success: true }` | Yes (anon JWT) | Once per player |
| 4 | `/rest/v1/players?id=eq.<uid>&select=*` | GET | GameDashboard, WinnerScreen | — | Single player row | Yes | On page load |
| 5 | `/rest/v1/player_fragments?player_id=eq.<uid>&select=fragment_id,used_in_word,fragments(letter,hint,word_id)` | GET | GameDashboard | — | Array of player fragments | Yes | On page load + realtime callback |
| 6 | `/rest/v1/words?status=eq.SOLVED&select=*` (count only) | GET | GameDashboard leaderboard | — | `Content-Range` count header | Yes | Every 5 seconds (polled) |
| 7 | `/rest/v1/rpc/claim_fragment` | POST | FragmentScan | `{ p_token: "<token>" }` | `{ success, already_owned, fragment_id, letter, hint, word_id }` | Yes | Per QR scan |
| 8 | `/rest/v1/rpc/submit_word` | POST | GameDashboard | `{ p_fragment_ids: ["uuid",...] }` | `{ success, message, word? }` | Yes | Per word submission attempt |
| 9 | `/rest/v1/rpc/discard_fragment` | POST | GameDashboard | `{ p_fragment_id: "uuid" }` | `{ success, message }` | Yes | Occasional (player choice) |
| 10 | `/auth/v1/signout` | POST | Admin logout | — | — | Yes | Rare (admin only) |
| 11 | `/rest/v1/rpc/reactivate_fragment` | POST | AdminDashboard | `{ p_fragment_id: "uuid" }` | `{ success, message }` | Yes (admin JWT) | Rare (admin only) |
| 12 | `/rest/v1/players?select=count` | GET | AdminDashboard | — | Count | Yes (admin) | On admin refresh |
| 13 | `/rest/v1/fragments?select=id,letter,public_token,status,used_in_winning_word,words(word)&order=id` | GET | AdminDashboard | — | Full fragment list | Yes (admin) | On admin refresh |

> [!NOTE]
> Endpoint #6 (`words` count query) is the **single highest-volume read** in the system — every active player fires it every 5 seconds regardless of game activity.

---

## 4. RPC Functions

All RPCs live in `supabase/` SQL files. The **effective** (last-applied) version of each is in `09_performance_and_audit.sql` for `claim_fragment` and `submit_word`, and in `06_fix_submit_word.sql` for the standalone `submit_word`.

> [!WARNING]
> There are **conflicting versions** of `submit_word`. `06_fix_submit_word.sql` defines `submit_word(p_fragment_ids UUID[])` (no `p_word_id`). `09_performance_and_audit.sql` re-defines it as `submit_word(p_word_id UUID, p_fragment_ids UUID[])`. The **last script applied wins**. The frontend calls `supabase.rpc('submit_word', { p_fragment_ids: placedFrags })` — no `p_word_id`. This means **`06_fix_submit_word.sql` must be the active version** for the app to work correctly.

| Function | Signature | Returns | DB Write? | Auth Required | Notes |
|----------|-----------|---------|-----------|---------------|-------|
| `register_player` | `(p_name TEXT, p_code TEXT)` | `{ success, message? }` | ✅ INSERT into `players` | Yes (anon JWT) | Idempotent — returns `success:false` if already registered |
| `claim_fragment` | `(p_token TEXT)` | `{ success, already_owned, fragment_id, letter, hint, word_id }` | ✅ UPDATE `fragments`, INSERT `player_fragments`, INSERT `audit_logs` | Yes | Row-locks fragment with `FOR UPDATE`. Raises exception if fragment already locked by another player. |
| `submit_word` | `(p_fragment_ids UUID[])` | `{ success, message, word? }` | ✅ (on win) UPDATE `words`, UPDATE `players`, UPDATE `player_fragments`, UPDATE `fragments` | Yes | Atomic row-lock on matching word. Fails silently (returns `success:false`) on wrong answer. |
| `discard_fragment` | `(p_fragment_id UUID)` | `{ success, message }` | ✅ DELETE `player_fragments`, UPDATE `fragments`, INSERT `audit_logs` | Yes | Can only discard fragment you own and that hasn't been used in a win. |
| `reactivate_fragment` | `(p_fragment_id UUID)` | `{ success, message }` | ✅ DELETE `player_fragments`, UPDATE `fragments` | Yes (admin only) | Calls `is_admin()` check. |

---

## 5. Game Flow

```
Player opens app
        │
        ▼
supabase.auth.getSession()
        │
   session?  ──── NO ──► /register
        │YES
        ▼
GET /rest/v1/players?id=eq.<uid>
        │
  player row?  ─── NO ──► clear localStorage + signOut → /register
        │YES
        ▼
GET /rest/v1/player_fragments (initial load)
        │
        ▼
GET /rest/v1/words (count SOLVED) [leaderboard seed]
        │
        ▼
WebSocket connects (3 channels):
  ├── public:words         → global SOLVED events
  ├── player-frags-<uid>  → player's own fragment changes
  └── player-status-<uid> → player WON trigger
        │
        ▼
GameDashboard idle
        │
   [every 5s] ──────────────────────────────────────────────►
        │                                                      │
   GET /rest/v1/words (count SOLVED, with 5s in-memory cache) │
        │◄─────────────────────────────────────────────────────┘
        │
     Player finds QR code physically → taps SCAN QR
        │
        ▼
Camera opens (html5-qrcode — browser only, no network)
        │
   QR decoded → navigate to /f/<token>
        │
        ▼
POST /rest/v1/rpc/claim_fragment { p_token }
        │
   success?
   ├── YES, already_owned=false → add to collection, play sound
   ├── YES, already_owned=true  → show "already collected"
   └── NO (locked by another)  → show error
        │
        ▼
[3.5s auto-redirect] → GameDashboard
        │
   Player drags letters into word slot (pure client-side)
        │
   Slot full? → "Check Word ✓" button appears
        │
        ▼
POST /rest/v1/rpc/submit_word { p_fragment_ids: [...] }
        │
   success=true?
   ├── YES → navigate /winner
   │         POST /rest/v1/players (read only, select)
   │         GET /rest/v1/words (fetch winning word text)
   │
   └── NO  → clear board slots, show toast, retry
        │
   [Optional] Player drags fragment to trash area
        │
        ▼
POST /rest/v1/rpc/discard_fragment { p_fragment_id }
        │
        ▼
Fragment returns to pool; realtime triggers refresh
```

---

## 6. Realtime

| Channel | Table | Event | Filter | Action |
|---------|-------|-------|--------|--------|
| `public:words` | `words` | `UPDATE` | none (global) | If `status=SOLVED` → show global toast, clear matching board length, increment discovered count |
| `player-frags-<uid>` | `player_fragments` | `INSERT, UPDATE, DELETE` | `player_id=eq.<uid>` | Re-fetch `player_fragments` join (GET #5) and rebuild fragment state |
| `player-status-<uid>` | `players` | `UPDATE` | `id=eq.<uid>` | If `status=WON` → navigate to `/winner` |

### Should k6 simulate Realtime?

**Recommendation: Skip Realtime WebSocket simulation in k6.**

Rationale:
- Supabase Realtime is a separate Phoenix channel infrastructure — stressing it would require a separate socket-level test.
- The **dominant server load** comes from PostgREST API calls and RPC executions, not WebSocket presence.
- The 5-second leaderboard poll **replaces** the realtime dependency for the one metric players care about (discovered count), so the app degrades gracefully without Realtime.
- A realistic test should simulate REST+RPC load patterns. Realtime stress is a separate concern.

---

## 7. Database Writes

| Operation | Tables Written | RPC | Trigger | Notes |
|-----------|---------------|-----|---------|-------|
| **Register Player** | `players` (INSERT) | `register_player` | User enters name | Once per player |
| **Claim Fragment** | `fragments` (UPDATE status→LOCKED, collected_by, collected_at), `player_fragments` (INSERT), `audit_logs` (INSERT) | `claim_fragment` | QR scan | Row-locked. Most concurrent hot path. |
| **Discard Fragment** | `player_fragments` (DELETE), `fragments` (UPDATE status→AVAILABLE), `audit_logs` (INSERT) | `discard_fragment` | Player drags to trash | Occasional |
| **Submit Word (wrong)** | None | `submit_word` | Player submits board | Read-only path; just returns false |
| **Submit Word (win)** | `words` (UPDATE status→SOLVED), `players` (UPDATE status→WON), `player_fragments` (UPDATE used_in_word), `fragments` (UPDATE used_in_winning_word), `audit_logs` (INSERT) | `submit_word` | Correct word | Row-locks the word. Triggers realtime cascade. |
| **Reactivate Fragment** (admin) | `player_fragments` (DELETE), `fragments` (UPDATE) | `reactivate_fragment` | Admin UI click | Rare |

---

## 8. Stress Test Targets — Priority Ranking

| Priority | Operation | Why |
|----------|-----------|-----|
| 🔴 **1 — Critical** | **Leaderboard poll** `GET /rest/v1/words?status=eq.SOLVED` (count) | Fired by **every active player every 5 seconds**. At 300 players that's **60 req/s constant**, regardless of game activity. This is the highest sustained load in the system. |
| 🔴 **2 — Critical** | **`claim_fragment` RPC** | The most write-intensive endpoint. Uses row-level `FOR UPDATE` locks on `fragments`. A burst of players scanning the same QR code simultaneously tests Postgres lock contention directly. |
| 🟠 **3 — High** | **Initial load sequence** (auth getSession → GET players → GET player_fragments → GET words count) | All 300 players run this in a short window at event start. 4 serial requests × 300 players = spike of ~1200 requests in seconds. |
| 🟠 **4 — High** | **Auth: `signInAnonymously`** | At event start all players register in a short window. The Supabase Auth service has separate rate limits from PostgREST. |
| 🟠 **5 — High** | **`submit_word` RPC** | Row-locks the `words` table row. Multiple concurrent correct submissions for the same word test atomic lock behavior. The wrong-answer path is read-only and light. |
| 🟡 **6 — Medium** | **`register_player` RPC** | One-time per player but happens in a burst at event start. |
| 🟡 **7 — Medium** | **Fragment fetch on realtime callback** `GET /rest/v1/player_fragments` | After each QR scan the realtime event triggers a re-fetch. Under real play this happens a few times per player. |
| 🟢 **8 — Low** | **`discard_fragment` RPC** | Player-initiated, infrequent. Not a load concern. |

---

## 9. Recommended Load Scenario

Based on the README's stated design target of **250–300 concurrent players** at a live event:

```
Phase 1 — EVENT START SURGE (0–60s)
  Ramp 300 virtual users from 0 → 300 over 60 seconds
  Each VU performs:
    POST /auth/v1/signup                          [anon sign-in, ~1s]
    POST /rest/v1/rpc/register_player             [register, ~0.5s]
    GET  /rest/v1/players                         [load profile, ~0.3s]
    GET  /rest/v1/player_fragments                [load inventory, ~0.3s]
    GET  /rest/v1/words (count SOLVED)            [leaderboard seed, ~0.3s]

Phase 2 — STEADY STATE GAMEPLAY (60s–600s)
  300 VUs continuously loop:
    Every 5s: GET /rest/v1/words (count SOLVED)  [leaderboard poll]
    Every 30–90s (random): simulate a QR scan:
      POST /rest/v1/rpc/claim_fragment { p_token: <random token from manifest> }
      sleep(3.5s)                                 [auto-redirect delay]
      GET  /rest/v1/player_fragments              [re-fetch after scan]
    Every 60–300s (random, 20% of VUs): simulate a word submit:
      POST /rest/v1/rpc/submit_word { p_fragment_ids: [<valid fragment UUIDs>] }

Phase 3 — BURST SCAN (simulating a crowded QR station)
  10 VUs claim the SAME fragment token simultaneously
  Purpose: test row-lock contention in claim_fragment
  Expected: 1 success, 9 exceptions ("already been discovered")

Phase 4 — RAMP DOWN (600s–660s)
  VUs decrease from 300 → 0

Realistic timings:
  - Think time between actions: uniform_random(2s, 10s)
  - QR scan frequency: 1 scan every 45–90 seconds per player
  - Submit attempt: 1 attempt every 2–5 minutes (players need all letters first)
  - Discard: 5% of players, once in the session
```

---

## 10. Information Missing from Repository

The following information is absent from the codebase and is required to write a complete, production-grade k6 script:

| # | Missing Item | Why Needed |
|---|-------------|------------|
| 1 | **Exact GitHub Pages production URL** (the GitHub username/org) | k6 cannot target the frontend without the full URL. Pattern is `https://<username>.github.io/Qr_Hunt_Web/` |
| 2 | **Pre-seeded test player accounts** | k6 needs existing anonymous JWTs to test the gameplay path without creating hundreds of real DB rows on every test run. At minimum: 10–50 pre-registered player UUIDs with their access tokens, or a mechanism to provision/cleanup test players. |
| 3 | **Confirmation of which `submit_word` signature is active** | There are two conflicting function signatures in the SQL files. The k6 script must call the correct one. |

> [!NOTE]
> The Supabase URL and anon key **are** present in `.env` and are sufficient to call the API directly. k6 does not need the GitHub Pages URL to test the Supabase backend.

---

## 11. Architecture Diagram & Final Checklist

### Request Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLAYER DEVICE (Browser)                   │
│                                                                   │
│  React SPA (GitHub Pages /Qr_Hunt_Web/)                          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │Register  │  │GameDash    │  │FragmentScan  │  │Winner    │  │
│  │.tsx      │  │.tsx        │  │.tsx          │  │Screen    │  │
│  └────┬─────┘  └─────┬──────┘  └──────┬───────┘  └────┬─────┘  │
│       │              │                 │               │         │
└───────┼──────────────┼─────────────────┼───────────────┼─────────┘
        │              │                 │               │
        ▼              ▼                 ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│             Supabase (https://ruigydgxrmafjvkghehh.supabase.co)  │
│                                                                   │
│  ┌─────────────────┐  ┌───────────────────┐  ┌───────────────┐  │
│  │  Auth Service   │  │  PostgREST API    │  │   Realtime    │  │
│  │  /auth/v1/      │  │  /rest/v1/        │  │   (Phoenix)   │  │
│  │                 │  │                   │  │   WebSocket   │  │
│  │ • signup (anon) │  │ TABLE reads:      │  │               │  │
│  │ • token refresh │  │  • players        │  │ Channels:     │  │
│  │ • signout       │  │  • player_frags   │  │ • public:words│  │
│  └────────┬────────┘  │  • words (count)  │  │ • player-frags│  │
│           │           │  • fragments(adm) │  │ • player-status│ │
│           │           │                   │  └───────┬───────┘  │
│           │           │ RPC calls:        │          │           │
│           │           │  • register_player│          │           │
│           │           │  • claim_fragment │          │           │
│           │           │  • submit_word    │          │           │
│           │           │  • discard_frag   │          │           │
│           │           │  • reactivate_frag│          │           │
│           │           └────────┬──────────┘          │           │
│           │                    │                      │           │
│           └────────────────────▼──────────────────────┘           │
│                                │                                  │
│                    ┌───────────▼──────────┐                       │
│                    │   PostgreSQL DB       │                       │
│                    │                       │                       │
│                    │  Tables:              │                       │
│                    │  • auth.users (Supa)  │                       │
│                    │  • players            │                       │
│                    │  • words              │                       │
│                    │  • fragments          │                       │
│                    │  • player_fragments   │                       │
│                    │  • audit_logs         │                       │
│                    │  • admins             │                       │
│                    └───────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

### k6 Readiness Checklist

| Check | Status | Note |
|-------|--------|------|
| ✅ Supabase project URL known | **READY** | `https://ruigydgxrmafjvkghehh.supabase.co` |
| ✅ Supabase anon key known | **READY** | Present in `.env` |
| ✅ Auth mechanism understood | **READY** | Anonymous sign-in via `/auth/v1/signup` with `{}` body |
| ✅ All RPC names + params confirmed | **READY** | All 5 RPCs documented above |
| ✅ All table endpoints confirmed | **READY** | All 13 endpoints documented above |
| ✅ Game flow fully understood | **READY** | Complete flow documented |
| ✅ Fragment tokens available | **READY** | All 97 tokens available in `data/qr-manifest.csv` |
| ✅ Leaderboard polling interval known | **READY** | Every 5,000 ms (`LEADERBOARD_POLL_MS = 5000`) |
| ✅ Database schema known | **READY** | Full schema from `01_schema.sql` |
| ⚠️ Production frontend URL | **MISSING** | GitHub username not in repo |
| ⚠️ Test player accounts | **MISSING** | Need pre-seeded UUIDs+tokens or cleanup strategy |
| ⚠️ Active `submit_word` signature | **NEEDS CONFIRMATION** | Two conflicting SQL definitions |

### Verdict

> **Enough information exists to generate a production-grade k6 script that stress-tests the Supabase backend directly.**
>
> The frontend URL is irrelevant for backend load testing — k6 will call the Supabase REST API directly, exactly as the browser does.
>
> The two missing items (test accounts + submit_word signature confirmation) must be resolved before the script can safely run against the production database without polluting it with test data.
>
> **✅ Ready to generate the k6 script upon your confirmation of the two items above.**
