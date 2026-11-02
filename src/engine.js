/**
 * engine.js — platform services shared by every game.
 * Sanitized localStorage, WebAudio synth + haptics, pause-aware timing hooks (PauseCtx, useClock,
 * useAfter, usePz), the adaptive difficulty controller and the sponsor slot.
 */
import { cl, createContext, h, useContext, useEffect, useRef, useState } from './runtime.js';

export const KEY = 'cogarcade_v1',
  EMPTY = { games: {}, days: 0, last: '', mute: false, customMocks: [] };
export const cleanName = (x) =>
  String(x == null ? '' : x)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .slice(0, 32);
export function load(registry) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY), (k, v) =>
      k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v,
    );
    const isO = (x) => !!x && typeof x === 'object' && !Array.isArray(x),
      num = (x, a, b, f) => (Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : f),
      games = {};
    if (isO(raw.games))
      Object.keys(raw.games)
        .slice(0, 40)
        .forEach((id) => {
          const g = raw.games[id];
          if (/^[a-z]{2,16}$/.test(id) && isO(g))
            games[id] = {
              difficulty: num(g.difficulty, 1, 10, 1),
              high: num(g.high, 0, 1e9, 0),
              max: num(g.max, 1, 10, 1),
              played: num(g.played, 0, 1e7, 0),
              won: num(g.won, 0, 1e7, 0),
              pts: num(g.pts, 0, 1e10, 0),
              ...(Number.isFinite(g.bestMs) ? { bestMs: num(g.bestMs, 1, 6e7, 1) } : {}),
            };
        });
    const mocks = Array.isArray(raw.customMocks)
      ? raw.customMocks
          .slice(0, 20)
          .filter(
            (m) =>
              isO(m) &&
              typeof m.id === 'string' &&
              typeof m.name === 'string' &&
              Array.isArray(m.items),
          )
          .map((m) => ({
            id: m.id.slice(0, 24),
            name: cleanName(m.name),
            items: m.items
              .slice(0, 20)
              .filter(
                (x) =>
                  Array.isArray(x) &&
                  typeof x[0] === 'string' &&
                  registry.some((g) => g.id === x[0]) &&
                  Number.isFinite(x[1]),
              )
              .map((x) => [x[0], num(x[1], 60, 3600, 360)]),
          }))
          .filter((m) => m.items.length)
      : [];
    return {
      games,
      days: num(raw.days, 0, 36500, 0),
      last: typeof raw.last === 'string' ? raw.last.slice(0, 40) : '',
      mute: raw.mute === true,
      customMocks: mocks,
    };
  } catch (e) {
    return { ...EMPTY, games: {}, customMocks: [] };
  }
}

export function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (e) {}
}

/* ---------- Sponsor slot (non-personalized, collapses when empty) ---------- */
export function AdBannerSlot({ placement }) {
  const r = useRef(null);
  useEffect(() => {
    /* inject your NON-PERSONALIZED ad tag into r.current (keep data-npa="1"); loosen the CSP for that ad domain first */
  }, []);
  return h('div', {
    ref: r,
    className: 'adslot w-full min-h-[90px] rounded-2xl overflow-hidden',
    'data-placement': placement,
    'data-npa': '1',
  });
}
/* ---------- Adaptive engine ---------- */
export /**
 * Staircase difficulty controller, one instance per game.
 *
 * State: difficulty 1–10, streak, session score, and a window of solve times since the last
 * level change.
 *  - Level up   : streak >= 3 AND mean window time < par(difficulty)  (difficulty + 1, streak reset)
 *  - Level down : any miss or timeout                                  (difficulty - 1, streak reset)
 *  - Points     : 100 x difficulty x speed(0.5..1.5 = par / time) x efficiency(0.3..1)
 * Persists difficulty, peak tier, high score, played/won, lifetime points and best solve time
 * through `persist(id, patch)`. Every call is O(1) apart from the O(window) mean.
 */
function useAdaptiveEngine(id, store, persist) {
  const g = store.games[id] || {};
  const [d, setD] = useState(g.difficulty || 1),
    [streak, setSt] = useState(0),
    [score, setSc] = useState(0);
  const win = useRef([]),
    S = useRef({ r: 0, c: 0, t: 0, e: 0, s: 0 });
  const record = (res, game) => {
    const par = game.par(d),
      ok = res.isCorrect,
      me = res.moveEfficiency ?? 1,
      eff = cl(me, 0.3, 1),
      sp = cl(par / Math.max(res.timeMs, 1), 0.5, 1.5);
    const pts = ok ? Math.round(100 * d * sp * eff) : 0,
      s = S.current;
    s.r++;
    s.c += ok ? 1 : 0;
    s.t += res.timeMs;
    s.e += me;
    s.s += pts;
    let nd = d,
      ns = 0,
      lvl = null;
    if (ok) {
      win.current.push(res.timeMs);
      ns = streak + 1;
      const avg = win.current.reduce((a, b) => a + b, 0) / win.current.length;
      if (ns >= 3 && avg < par) {
        ns = 0;
        win.current = [];
        if (d < 10) {
          nd = d + 1;
          lvl = 'up';
        }
      }
    } else {
      win.current = [];
      if (d > 1) {
        nd = d - 1;
        lvl = 'down';
      }
    }
    setD(nd);
    setSt(ns);
    const tot = score + pts;
    setSc(tot);
    persist(id, {
      difficulty: nd,
      high: Math.max(g.high || 0, tot),
      max: Math.max(g.max || 1, nd),
      played: (g.played || 0) + 1,
      won: (g.won || 0) + (ok ? 1 : 0),
      pts: (g.pts || 0) + pts,
      bestMs: ok ? Math.min(g.bestMs || 1e12, res.timeMs) : g.bestMs,
    });
    return { pts, lvl, nd, ns };
  };
  return { d, streak, score, record, stats: () => ({ ...S.current, id }) };
}

/* ---------- Juice (WebAudio + haptics) & pause plumbing ---------- */
export const PauseCtx = createContext(false);
let audioCtx = null,
  muted = false;
/** Mute toggle for sound + haptics (imported bindings are read-only, so main.js calls this setter). */
export function setMute(v) {
  muted = !!v;
}
export function sfx(t) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    let at = audioCtx.currentTime;
    (
      ({
        tap: [[660, 0.04]],
        win: [
          [523, 0.08],
          [784, 0.14],
        ],
        lose: [
          [220, 0.12],
          [150, 0.22],
        ],
        lvlup: [
          [523, 0.08],
          [659, 0.08],
          [784, 0.08],
          [1047, 0.2],
        ],
      })[t] || []
    ).forEach(([f, d]) => {
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.type = t === 'lose' ? 'sawtooth' : 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.05, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + d);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      o.start(at);
      o.stop(at + d);
      at += d;
    });
  } catch (e) {}
  try {
    navigator.vibrate &&
      navigator.vibrate(
        t === 'tap'
          ? 15
          : t === 'lose'
            ? [40, 60, 40]
            : t === 'lvlup'
              ? [30, 40, 30, 40, 60]
              : t === 'win'
                ? 25
                : 0,
      );
  } catch (e) {}
}
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('button:not([disabled])')) sfx('tap');
});
window.addEventListener('pagehide', () => {
  try {
    audioCtx && audioCtx.close();
  } catch (e) {}
  audioCtx = null;
});
/* shift stored timestamps forward by the paused duration on resume */
export /**
 * Pause support for stored timestamps: while the PauseCtx is true we remember when the pause began;
 * on resume every ref in `refs` (numbers holding Date.now() values) is shifted forward by the
 * paused duration, so elapsed-time maths never counts paused time.
 */
function usePz(...refs) {
  const p = useContext(PauseCtx),
    s = useRef(0);
  useEffect(() => {
    if (p) s.current = Date.now();
    else if (s.current) {
      const d = Date.now() - s.current;
      refs.forEach((r) => (r.current += d));
      s.current = 0;
    }
  }, [p]);
}
/* pause-aware setTimeout: ms=null disables; remaining time is preserved across pauses */
export /**
 * Pause-aware setTimeout. `ms === null` disables the timer. When `deps` change the full delay
 * restarts; when only the pause state changes the *remaining* time is preserved. O(1).
 */
function useAfter(fn, ms, deps) {
  const p = useContext(PauseCtx),
    rem = useRef(ms),
    lk = useRef(null),
    f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    const k = deps.join('|');
    if (lk.current !== k) {
      lk.current = k;
      rem.current = ms;
    }
    if (p || ms == null) return;
    const s0 = Date.now(),
      t = setTimeout(() => f.current(), rem.current);
    return () => {
      clearTimeout(t);
      rem.current -= Date.now() - s0;
    };
  }, [...deps, p]);
}
export function useClock(limit, onEnd, paused) {
  const pc = useContext(PauseCtx),
    p = paused ?? pc;
  const t0 = useRef(Date.now()),
    ps = useRef(0),
    pr = useRef(p),
    end = useRef(onEnd),
    [f, setF] = useState(1);
  end.current = onEnd;
  pr.current = p;
  useEffect(() => {
    if (p) ps.current = Date.now();
    else if (ps.current) {
      t0.current += Date.now() - ps.current;
      ps.current = 0;
    }
  }, [p]);
  useEffect(() => {
    const i = setInterval(() => {
      if (pr.current) return;
      const r = 1 - (Date.now() - t0.current) / limit;
      setF(Math.max(0, r));
      if (r <= 0) {
        clearInterval(i);
        end.current();
      }
    }, 100);
    return () => clearInterval(i);
  }, [limit]);
  return { f, el: () => Date.now() - t0.current };
}
export const Bar = ({ f }) =>
  h(
    'div',
    { className: 'h-2 rounded bg-slate-800 overflow-hidden shrink-0' },
    h('div', {
      className: 'h-full',
      style: { width: f * 100 + '%', background: f < 0.25 ? '#f87171' : '#34d399' },
    }),
  );
