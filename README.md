# CogArcade

**Offline-first practice for campus-placement cognitive assessments** (Accenture, Capgemini/Aon, IBM, Cognizant, Deloitte style).
14 procedurally generated games, an adaptive difficulty engine, timed company mocks and a custom mock builder — in about
4 000 lines of plain JavaScript with **zero dependencies, zero build step and zero network requests**.

- Every puzzle is generated at runtime by a deterministic algorithm. There is no question bank anywhere in the repo.
- Difficulty adapts per game on a 1–10 staircase and everything is stored in `localStorage` (sanitized on load).
- Installable PWA that works in airplane mode; wrap it into an Android APK with PWABuilder.
- Strict Content-Security-Policy, no `eval`/`new Function`, every search loop has a hard iteration cap.

## Quick start

ES modules are blocked on `file://`, so serve the folder over HTTP:

```bash
cd cogarcade
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

No install step. Optional dev tooling (not needed to run): `npx eslint src` and `npx prettier --check .`.

## Project structure

```text
cogarcade/
├── index.html      entry point: CSP meta, manifest link, styles.css, <script type="module">
├── styles.css      hand-rolled utility classes, animations, 3D arcade buttons
├── sw.js           service worker (pre-caches the shell, stale-while-revalidate)
├── manifest.json   PWA manifest
├── _headers        Cloudflare Pages / Netlify security headers
├── icon-192.png, icon-512.png
├── native/         Capacitor wrapper that turns the same files into a standalone Android APK
├── .github/workflows/android.yml   cloud APK build (GitHub Actions)
├── .assetsignore   keeps native/ and .github/ off the Cloudflare website
└── src/
    ├── runtime.js  VDOM + hooks runtime and shared helpers (R, cl, shuf, pk)
    ├── engine.js   storage, audio/haptics, pause-aware hooks, adaptive engine, sponsor slot
    ├── games.js    the 14 game engines, solvers, GameRegistry, MOCKS, MODS
    └── main.js     UI views + root mount + service-worker registration
```

Dependency direction (no cycles): `runtime ← engine ← games ← main` (main also imports runtime and engine directly).
`engine.load(registry)` receives the registry as an argument, so `engine.js` never imports `games.js`.

## Architecture

### Data flow

```text
GameRegistry ──► Brief (scorecard, rules, tip) ──► Runner ──► <Game difficulty onRoundComplete/>
                                                      │                  │
                                                      │   { isCorrect, timeMs, moveEfficiency, explain }
                                                      ▼                  │
                                     useAdaptiveEngine.record ◄──────────┘
                                                      │  persist(id, patch)
                                                      ▼
                                      App store ──► save() ──► localStorage
```

### The game contract

A game is a component `({ difficulty, onRoundComplete, isMockMode }) => vnode` that calls
`onRoundComplete({ isCorrect, timeMs, moveEfficiency, explain })` exactly once. To add a game:

1. Write the component in `src/games.js` and register it in `GameRegistry` with `id, name, sub, icon, module, co, how, tip, Component, par, ready`.
2. Use `useClock(limitMs, onTimeout)` for timers so pause works automatically.
3. Build `explain` as lines: one step per line, a line starting with `=` for the result, a final `Tip: …` line.
   `ExplainView` renders these as STEP / RESULT / EXAM SHORTCUT cards.
4. Optionally reference it from `MOCKS` or let players pick it in the Custom Mock Builder.

### Runtime (`src/runtime.js`)

A ~300-line virtual DOM: `h(type, props, ...children)` vnodes, keyed child reconciliation, SVG namespace support,
and `useState / useRef / useMemo / useCallback / useEffect / createContext / useContext`. State updates are batched with
`queueMicrotask` and re-render the affected component subtree (no memoisation or bailouts). Effects run after the DOM patch
and are cleaned up on unmount. Event props map `onClick → click`, `onChange → input`. It covers what this app needs, not the
whole React API (no fragments, portals, refs on components or suspense).

### Adaptive engine (`useAdaptiveEngine`)

| Rule | Behaviour |
| --- | --- |
| Level up | `streak >= 3` **and** mean solve time since the last level change `< par(difficulty)` → difficulty + 1 |
| Level down | any wrong answer or timeout → difficulty − 1 |
| Points | `100 × difficulty × speed × efficiency`, speed = clamp(par/time, 0.5, 1.5), efficiency = clamp(moveEfficiency, 0.3, 1) |
| Persisted | difficulty, peak tier, high score, played, won, lifetime points, best solve time |

### Pause system

`PauseCtx` carries a boolean. `useClock` freezes its countdown, `useAfter` keeps the *remaining* delay of a timeout, and
`usePz` shifts stored `Date.now()` refs forward by the paused duration, so solve times and the mock countdown never include paused time.

## The 14 procedural games

| # | Game (`id`) | Module | Generator | Verifier / solver | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Bubble Math (`bubble`) | Numerical | Picks N target values (spacing shrinks with tier, half-steps from tier 9) and synthesises one expression per value | Sorted target order | O(N log N) |
| 2 | Fleeting Numbers (`fleeting`) | Working Memory | N distinct cells on a 5×6 grid, decoy tiles (tiers 4–7), reverse recall (tiers 9–10) | Expected-order list | Visible 2000/1200/750 ms |
| 3 | Digit Challenge (`digit`) | Numerical | Template + lambda pairs, distinct digits 1–9, target must be an integer ≥ 1 (≤ 500 tries, fixed fallback) | Re-evaluates the player's digits with the lambda | No `eval` |
| 4 | Switch Challenge (`switch`) | Concentration | Random non-identity permutation code; double-layer chaining (tiers 5–7); 5 symbols and same-first-digit decoys (tiers 8–10) | `ap(a, c)` — output slot *i* takes input slot `c[i]` (Aon convention) | O(n) |
| 5 | Grid Challenge (`grid`) | Working Memory | N dots on a 5×5 grid; 4×4 pattern pairs where the right grid is the left grid's mirror, or the mirror with 1–2 cells flipped | Ordered recall; a round passes with ≤ 1 missed check | Phase timers are pause-aware |
| 6 | Geo-Sudoku (`geo`) | Deductive & Inductive | Latin square from row/column/symbol permutations of a cyclic square; masks K cells | A mask is accepted only if the visible symbols in the `?` row ∪ column cover every symbol but the answer | ≤ 80 masks per K |
| 7 | Pathfinder (`pathfinder`) | Spatial & Planning | Random walls with start, key, door | `bfs` start→key and key→door must both succeed (≤ 400 tries, open-grid fallback); optimum = d1 + d2 | Even tiers ≥ 6 hide walls after 2.5 s |
| 8 | Bitwise Blitz (`bitwise`) | Numerical | Tiered pseudocode: AND/OR/XOR → shift loops → recursion (fib, popcount, XOR fold) | Executes the same logic in JS; decoys come from re-running with typical mistakes | Dry-run explanation in binary |
| 9 | Path Maker (`pathmaker`) | Spatial & Planning | `carve` (bounded randomised DFS) → pipe masks along the route → random fill → random rotation scramble | `pmConn` BFS after every tap; optimum ≈ rotations needed on the carved route (an upper bound) | Pipes drawn as SVG lines |
| 10 | Motion Challenge (`motion`) | Spatial & Planning | Random 5×5 board: ball, hole, rocks, 1×2 and 2×1 bars; best of 40 boards | `mvBfs` over the joint (ball + bars) state space, capped at 8000 states | `moveEfficiency = optimal / moves` |
| 11 | Tally Up (`tally`) | Numerical | Left cluster, then a right cluster split to hit a chosen relation (left >, =, <) with tier-scaled gaps | Sum comparison | 5 items, 5 s shot clock each |
| 12 | Numbubbles (`numbubbles`) | Numerical | A target and 2–4 matching expressions among near-miss distractors (±1, ±2, ±3, plus ±10 from tier 6) | Value equals target | No wrong taps allowed |
| 13 | Resemble (`resemble`) | Spatial & Planning | Random 3×3 two-colour pattern; regenerated until all 8 rotation/flip variants are distinct | Exact variant match | Flip appears from tier 7 |
| 14 | Scales (`scales`) | Concentration | Odd tiers (ix): four rule families sampled by rejection (≤ 3000 samples/matrix, ≤ 400 attempts, fixed fallback). Even tiers (e3+): six rapid YES/NO cards under a colour/side-count rule (XOR from tier 6) | Rule predicate | Per-card 3–4 s clock |

## Game modes

- **Free Practice Arcade** — filter by module, open a briefing (scorecard, rules, exam tip) and play adaptive rounds. A breather screen appears every 5th practice round.
- **Company Exam Simulators** — Accenture 20 min, Capgemini/Aon 33 min, IBM 25 min presets (`MOCKS`).
- **Build Your Own Drive** — pick any games in order, tune each duration (2/4/6/9/12 min steps), start immediately or save as a preset (stored in `store.customMocks`).

## Security model

| Control | Where |
| --- | --- |
| CSP: `default-src 'self'; script-src 'self'; style-src 'self'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`, plus `connect-src 'none'` in the page meta tag and `connect-src 'self'` in the `_headers` header | `index.html` and `_headers` |
| No inline scripts or `<style>` blocks — styles are set through CSSOM (`el.style.x = …`), which `style-src 'self'` allows | `runtime.js` |
| No `eval` / `new Function` (Digit uses lambdas) | `games.js` |
| Every generator loop is bounded and has a deterministic fallback | `games.js` |
| `localStorage` is validated on load: `__proto__`/`constructor`/`prototype` keys dropped, numbers clamped, game ids whitelisted, presets validated against the registry, preset names stripped of control characters and capped at 32 chars | `engine.js` |
| One reusable `AudioContext`; each oscillator/gain is disconnected in `onended` | `engine.js` |
| Service worker ignores cross-origin requests | `sw.js` |

The header uses `connect-src 'self'` because a service worker inherits the CSP of its own script response; `'none'` would block the worker's fetches and break every page load. (The app itself makes no network requests.)

`frame-ancestors` only works as an HTTP header, so clickjacking protection needs the `_headers` file (Cloudflare Pages / Netlify).
**Ads:** the sponsor slot (`AdBannerSlot`, `data-npa="1"` for non-personalised ads) is empty and collapsed by default. A real ad
network needs its own script and frame origins added to the CSP, which weakens the "no network" guarantee — decide that trade-off before enabling it.

## Offline / PWA

`sw.js` pre-caches `index.html`, `styles.css`, `manifest.json`, both icons and the four modules, then serves same-origin
requests stale-while-revalidate. **Bump `CACHE` in `sw.js` whenever a shell file changes.**
Test offline by loading the app once, then enabling airplane mode (DevTools → Application → Service Workers → Offline also works).

## Deploy

- **Cloudflare Pages / Netlify** — publish the folder as-is; `_headers` is applied automatically.
- **GitHub Pages** — works, but custom headers are unsupported, so only the meta-tag CSP applies (no `frame-ancestors`).

## Build an Android APK (PWABuilder)

1. Deploy over HTTPS and confirm the app installs from the browser.
2. Open <https://www.pwabuilder.com>, enter the URL and run the report (manifest, service worker and HTTPS should pass).
3. Choose **Package for stores → Android**, set the package id, and download the generated project.
4. Sign the bundle with the keystore PWABuilder generates (keep it safe — you need it for updates) and test the `.apk` on a device; use the `.aab` for Play Store.
5. Alternative: Google's [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) CLI (`npx @bubblewrap/cli init --manifest <url>`).

## Standalone Android app (Capacitor)

Unlike the PWABuilder wrapper (which opens your website), Capacitor **bundles the files inside the APK**, so the app
runs with no server and no internet. The web app stays zero-build at the repo root; the wrapper lives in `native/`.

**Build in the cloud (no Android Studio needed):** push to `main` (or Actions → *Build Android APK* → *Run workflow*).
The workflow installs Node 22 + Java 21 + the Android SDK, copies the web files into `native/www`, generates the Android
project, adds the vibration permission and portrait lock (`native/scripts/patch-android.mjs`) and runs
`./gradlew assembleDebug`. Download `app-debug.apk` from the run's **Artifacts**.

**Build locally** (needs Node 22, JDK 21, Android SDK):

```bash
cd native
npm ci
npm run build:web
npm run android:add
cd android && ./gradlew assembleDebug     # APK: app/build/outputs/apk/debug/app-debug.apk
```

Notes: the app id is `com.cogarcade.app` (change it in `native/capacitor.config.json` *before* your first release — it is
permanent). The debug APK is signed with a throw-away key, so uninstall the old build before installing a new one. A Play
Store release needs a release keystore. Inside the native shell the service worker is skipped, because everything is already local.

## Known limitations

- Generator internals keep terse local variable names (`P`, `st`, `k`…); the module boundaries, exports, comments and formatting are the readable layer.
- `moveEfficiency` for Path Maker uses the carved route's rotation count, which can slightly overstate the optimum.
- The repo has no automated test suite; verification was done with ESLint (`no-undef`/`no-unused-vars`) and scripted headless runs of every game.
- Timing uses `Date.now()`, so changing the system clock mid-round affects that round.

## License

MIT
