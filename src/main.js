/**
 * main.js — UI views (RankCard, Brief, ExplainView, Breather, Builder, Runner, App),
 * root mount and service-worker registration.
 */
import {
  AdBannerSlot,
  EMPTY,
  PauseCtx,
  cleanName,
  load,
  save,
  setMute,
  sfx,
  useAdaptiveEngine,
} from './engine.js';
import { GameRegistry, MOCKS, MODS, byId } from './games.js';
import { cl, createRoot, h, useCallback, useEffect, useRef, useState } from './runtime.js';

/* ---------- Custom Mock Builder & module filter ---------- */
const STEPS = [120, 240, 360, 540, 720];
const defSecs = (id) => (MOCKS.flatMap((m) => m.items).find((x) => x[0] === id) || [0, 360])[1],
  mmin = (t) => Math.round(t / 60) + 'm';
function Builder({ store, setStore, onStart }) {
  const [sel, setSel] = useState([]),
    [secs, setSecs] = useState({}),
    [name, setName] = useState(''),
    sc = (id) => secs[id] ?? defSecs(id),
    mc = store.customMocks || [];
  const tog = (id) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const adj = (id, up) => {
    const c = sc(id);
    setSecs({
      ...secs,
      [id]: up
        ? STEPS.find((x) => x > c) || STEPS[4]
        : [...STEPS].reverse().find((x) => x < c) || STEPS[0],
    });
  };
  const items = sel.map((id) => [id, sc(id)]),
    tot = items.reduce((a, x) => a + x[1], 0);
  const save = () => {
    if (!items.length) return;
    setStore((s) => ({
      ...s,
      customMocks: [
        ...(s.customMocks || []),
        {
          id: 'c' + Date.now(),
          name: cleanName(name).trim() || 'My Drive ' + ((s.customMocks || []).length + 1),
          items,
        },
      ],
    }));
    setName('');
  };
  return h(
    'div',
    { className: 'bg-slate-900 rounded-xl p-3 flex flex-col gap-2' },
    h('b', null, '🛠 Build Your Own Drive'),
    h(
      'div',
      { className: 'text-xs text-slate-400' },
      `Tap games in the order you want them · ${sel.length} selected · ${mmin(tot)} total`,
    ),
    h(
      'div',
      { className: 'flex flex-wrap gap-1.5' },
      GameRegistry.map((g) => {
        const i = sel.indexOf(g.id);
        return h(
          'button',
          {
            key: g.id,
            onClick: () => tog(g.id),
            className:
              'px-2 py-1 rounded-full text-xs ' +
              (i >= 0 ? 'bg-indigo-600 font-bold' : 'bg-slate-800 text-slate-300'),
          },
          (i >= 0 ? i + 1 + '. ' : '') + g.icon + ' ' + g.name,
        );
      }),
    ),
    items.map(([id, t], i) =>
      h(
        'div',
        { key: id, className: 'flex items-center gap-2 text-sm' },
        h('span', { className: 'flex-1 truncate' }, i + 1 + '. ' + byId(id).name),
        h('button', { onClick: () => adj(id, 0), className: 'w-7 h-7 rounded bg-slate-800' }, '−'),
        h('span', { className: 'w-10 text-center font-mono' }, mmin(t)),
        h('button', { onClick: () => adj(id, 1), className: 'w-7 h-7 rounded bg-slate-800' }, '+'),
      ),
    ),
    h('input', {
      value: name,
      onChange: (e) => setName(cleanName(e.target.value)),
      maxLength: 32,
      placeholder: 'Preset name (optional)',
      style: { userSelect: 'text', WebkitUserSelect: 'text' },
      className: 'bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none',
    }),
    h(
      'div',
      { className: 'flex gap-2' },
      h(
        'button',
        {
          disabled: !items.length,
          onClick: () => onStart({ id: 'custom', name: 'Custom Session', items }),
          className:
            'flex-1 py-2 rounded-lg font-bold text-sm ' +
            (items.length ? 'bg-indigo-600' : 'bg-slate-800 text-slate-500'),
        },
        '▶ Start Custom Session',
      ),
      h(
        'button',
        {
          disabled: !items.length,
          onClick: save,
          className:
            'flex-1 py-2 rounded-lg text-sm ' +
            (items.length ? 'bg-slate-700' : 'bg-slate-800 text-slate-500'),
        },
        '💾 Save Preset',
      ),
    ),
    mc.length > 0 && h('div', { className: 'text-xs text-slate-400 mt-1' }, 'Saved drives'),
    mc.map((m) =>
      h(
        'div',
        { key: m.id, className: 'flex items-center gap-2 text-sm bg-slate-800 rounded-lg p-2' },
        h(
          'div',
          { className: 'flex-1 min-w-0' },
          h('div', { className: 'truncate font-bold' }, m.name),
          h(
            'div',
            { className: 'text-[10px] text-slate-400 truncate' },
            m.items.map(([id, t]) => byId(id).name + ' ' + mmin(t)).join(' → '),
          ),
        ),
        h(
          'button',
          { onClick: () => onStart(m), className: 'px-2 py-1 rounded bg-indigo-600' },
          '▶',
        ),
        h(
          'button',
          {
            onClick: () =>
              setStore((s) => ({ ...s, customMocks: s.customMocks.filter((x) => x.id !== m.id) })),
            className: 'px-2 py-1 rounded bg-slate-700',
          },
          '🗑',
        ),
      ),
    ),
  );
}

/* ---------- Briefing, rank card, Runner ---------- */
const MB = (t) =>
  t <= 2 ? 'Novice' : t <= 4 ? 'Contender' : t <= 6 ? 'Specialist' : t <= 8 ? 'Ace' : 'Grandmaster';
function Brief({ g, store, onStart, onBack }) {
  const s = store.games[g.id] || {},
    t = s.difficulty || 1,
    peak = s.max || 1,
    pl = s.played || 0;
  const st = [
    ['High score', s.high || 0],
    ['Played', pl],
    ['Accuracy', pl ? Math.round(((s.won || 0) / pl) * 100) + '%' : '—'],
    ['Best solve', s.bestMs ? (s.bestMs / 1000).toFixed(1) + 's' : '—'],
  ];
  return h(
    'div',
    { className: 'flex flex-col h-full gap-3 overflow-auto' },
    h(
      'div',
      { className: 'flex items-center gap-3' },
      h('div', { className: 'text-4xl' }, g.icon),
      h(
        'div',
        null,
        h('div', { className: 'text-xl font-bold' }, g.name),
        h('div', { className: 'text-sm text-slate-400' }, g.sub),
        h('div', { className: 'text-[11px] text-indigo-300' }, 'Asked in: ' + g.co),
      ),
    ),
    h(
      'div',
      { className: 'bg-slate-900 rounded-xl p-3' },
      h('div', { className: 'text-xs text-slate-400 mb-2' }, 'YOUR SCORECARD'),
      h(
        'div',
        { className: 'flex items-center gap-2 mb-2' },
        h('span', { className: 'px-2 py-0.5 rounded bg-indigo-600 text-sm font-bold' }, 'T' + t),
        h('span', { className: 'text-sm text-slate-400' }, 'Peak T' + peak),
        h(
          'span',
          { className: 'ml-auto px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-sm' },
          '🏅 ' + MB(peak),
        ),
      ),
      h(
        'div',
        { className: 'grid grid-cols-4 gap-2 text-center' },
        st.map(([a, b]) =>
          h(
            'div',
            { key: a, className: 'bg-slate-800 rounded-lg p-2' },
            h('div', { className: 'font-bold text-sm' }, b),
            h('div', { className: 'text-[10px] text-slate-400' }, a),
          ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'bg-slate-900 rounded-xl p-3' },
      h('div', { className: 'text-xs text-slate-400 mb-1' }, 'HOW IT WORKS'),
      h('div', { className: 'text-sm' }, g.how),
    ),
    h(
      'div',
      { className: 'bg-amber-500/10 border border-amber-500/30 rounded-xl p-3' },
      h('div', { className: 'text-xs text-amber-300 mb-1' }, '💡 EXAM PRO-TIP'),
      h('div', { className: 'text-sm' }, g.tip),
    ),
    h('div', { className: 'flex-1' }),
    h(
      'button',
      { onClick: onStart, className: 'py-4 rounded-xl bg-indigo-600 font-bold text-lg' },
      `▶ Start Round (Tier ${t})`,
    ),
    h('button', { onClick: onBack, className: 'py-2 rounded-xl bg-slate-800 text-sm' }, '← Back'),
  );
}
const TITLES = [
  'Rookie Thinker',
  'Pattern Spotter',
  'Quick Solver',
  'Logic Architect',
  'Cognitive Ace',
  'Placement Pro',
  'Grandmaster',
];
function RankCard({ store, onMute }) {
  const xp = Object.values(store.games).reduce((a, g) => a + (g.pts || 0), 0),
    lv = Math.floor(Math.sqrt(xp / 150)) + 1,
    lo = 150 * (lv - 1) ** 2,
    hi = 150 * lv ** 2;
  const msg = !xp
    ? 'Play your first round to earn XP!'
    : store.days >= 3
      ? `🔥 ${store.days}-day streak — you're on fire!`
      : `${hi - xp} XP to Level ${lv + 1} — keep going!`;
  return h(
    'div',
    { className: 'bg-slate-900 rounded-xl p-3 shrink-0' },
    h(
      'div',
      { className: 'flex items-center' },
      h('b', { className: 'flex-1 text-sm' }, `Level ${lv} · ${TITLES[Math.min(lv - 1, 6)]}`),
      h('span', { className: 'text-xs text-slate-400 mr-2' }, xp + ' XP'),
      h('button', { onClick: onMute, className: 'text-lg' }, store.mute ? '🔇' : '🔊'),
    ),
    h(
      'div',
      { className: 'h-2 rounded bg-slate-800 my-1.5 overflow-hidden' },
      h('div', {
        className: 'h-full bg-indigo-500',
        style: { width: cl((xp - lo) / (hi - lo), 0, 1) * 100 + '%' },
      }),
    ),
    h('div', { className: 'text-xs text-slate-400' }, msg),
  );
}
const TOKEN_RE = /(\b[01]{3,}\b|-?\d+(?:\.\d+)?|→|←|[<>=+×÷−^&|]+)/;
function ExplainView({ text }) {
  const L = String(text)
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean),
    tip = L.filter((l) => l.startsWith('Tip:'))
      .map((l) => l.slice(4).trim())
      .join(' '),
    res = L.filter((l) => l[0] === '='),
    steps = L.filter((l) => l[0] !== '=' && !l.startsWith('Tip:'));
  const tok = (t) =>
    t
      .split(TOKEN_RE)
      .map((x, i) =>
        /^[01]{3,}$/.test(x)
          ? h('span', { key: i, className: 'px-1.5 rounded-md bg-indigo-600 text-white' }, x)
          : /^-?\d/.test(x)
            ? h('span', { key: i, className: 'text-amber-300 font-bold' }, x)
            : /^(→|←)$/.test(x)
              ? h('span', { key: i, className: 'text-sky-300 font-bold' }, x)
              : /^[<>=+×÷−^&|]+$/.test(x)
                ? h('span', { key: i, className: 'text-fuchsia-400 font-bold' }, x)
                : x,
      );
  const pill = (t, c) =>
    h(
      'span',
      {
        className: 'shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-bold ' + c,
        style: { letterSpacing: '.08em' },
      },
      t,
    );
  return h(
    'div',
    { className: 'flex flex-col gap-2' },
    steps.map((l, i) =>
      h(
        'div',
        { key: 's' + i, className: 'flex items-start gap-2 rounded-xl p-2 bg-slate-800' },
        pill('STEP ' + (i + 1), 'bg-indigo-600'),
        h(
          'div',
          { className: 'flex-1 font-mono text-sm text-left', style: { wordBreak: 'break-word' } },
          tok(l),
        ),
      ),
    ),
    res.map((l, i) =>
      h(
        'div',
        {
          key: 'r' + i,
          className:
            'flex items-start gap-2 rounded-xl p-2 bg-emerald-600/20 border-2 border-emerald-500',
        },
        pill('RESULT', 'bg-emerald-600'),
        h(
          'div',
          { className: 'flex-1 font-mono text-sm text-left', style: { wordBreak: 'break-word' } },
          tok(l.slice(1).trim()),
        ),
      ),
    ),
    tip &&
      h(
        'div',
        { className: 'rounded-2xl p-3 border-2 border-amber-400 bg-amber-500/15 text-left' },
        h('div', { className: 'text-xs font-bold text-amber-300 mb-1' }, '⚡ EXAM SHORTCUT'),
        h('div', { className: 'text-base' }, tip),
      ),
  );
}
function Breather({ title, sub, btn, onContinue }) {
  return h(
    'div',
    { className: 'h-full flex flex-col justify-center gap-4 text-center' },
    h('div', { className: 'text-6xl' }, '🎉'),
    h('div', { className: 'text-2xl font-bold' }, title || '5-Round Breather'),
    h(
      'div',
      { className: 'text-slate-300' },
      sub || 'Nice rhythm! Sip some water and roll your shoulders.',
    ),
    h(AdBannerSlot, { placement: 'breather' }),
    h(
      'button',
      { onClick: onContinue, className: 'py-4 rounded-2xl bg-indigo-600 font-bold text-lg' },
      btn || 'Continue Playing ▶',
    ),
  );
}
function Runner({ game, store, persist, mock, secs, tick, onFinish, onExit }) {
  const eng = useAdaptiveEngine(game.id, store, persist),
    [round, setRound] = useState(0),
    [fb, setFb] = useState(null),
    [open, setOpen] = useState(true),
    [bre, setBre] = useState(false),
    [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(secs),
    endAt = useRef(Date.now() + (secs || 0) * 1000),
    ps = useRef(0),
    pr = useRef(false);
  pr.current = paused;
  const setP = (v) => {
    if (v) ps.current = Date.now();
    else endAt.current += Date.now() - ps.current;
    setPaused(v);
  };
  useEffect(() => {
    if (!mock) return;
    const i = setInterval(() => {
      if (pr.current) return;
      const l = Math.ceil((endAt.current - Date.now()) / 1000);
      setLeft(Math.max(0, l));
      if (l <= 0) {
        clearInterval(i);
        onFinish(eng.stats());
      }
    }, 500);
    return () => clearInterval(i);
  }, []);
  const next = () => {
    setBre(false);
    setFb(null);
    setRound((x) => x + 1);
  };
  const done = (r) => {
    const o = eng.record(r, game),
      hype = !r.isCorrect
        ? '💪 Shake it off — check the shortcut below'
        : o.lvl === 'up'
          ? `🔥 ${eng.streak + 1}-Streak! Tier Up!`
          : r.timeMs < game.par(eng.d)
            ? '⚡ Blistering Speed! Under Par!'
            : o.ns >= 2
              ? `🔥 ${o.ns}-Streak! One more for a tier up`
              : '✅ Nailed it — keep the rhythm';
    sfx(!r.isCorrect ? 'lose' : o.lvl === 'up' ? 'lvlup' : 'win');
    setFb({ ...r, ...o, hype, br: !mock && !!tick && tick() });
    if (mock)
      setTimeout(() => {
        setFb(null);
        setRound((x) => x + 1);
      }, 800);
  };
  const st = eng.stats(),
    G = game.Component,
    mm = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'),
    acc = st.r ? Math.round((st.c / st.r) * 100) + '%' : '—';
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2 min-h-0' },
    h(
      'div',
      { className: 'flex items-center gap-2 text-sm shrink-0' },
      h('button', { onClick: onExit, className: 'px-2 py-1 rounded-lg bg-slate-800' }, '✕'),
      h(
        'button',
        {
          disabled: !!fb,
          onClick: () => setP(true),
          className: 'px-2 py-1 rounded-lg bg-slate-800 disabled:opacity-30',
        },
        '⏸',
      ),
      h('b', { className: 'flex-1 truncate' }, game.icon + ' ' + game.name),
      h('span', { className: 'px-2 rounded-lg bg-indigo-600' }, 'T' + eng.d),
      h('span', null, '🔥' + eng.streak),
      h('span', { className: 'text-amber-300' }, eng.score),
      mock && h('span', { className: 'font-mono text-emerald-300' }, mm(left)),
    ),
    h(
      'div',
      { className: 'flex-1 min-h-0 relative' },
      h(
        PauseCtx.Provider,
        { value: paused },
        fb && !mock
          ? bre
            ? h(Breather, { onContinue: next })
            : h(
                'div',
                { className: 'h-full overflow-auto flex flex-col gap-3' },
                h(
                  'div',
                  { className: 'flex items-center gap-3 rounded-2xl p-3 bg-slate-900' },
                  h('div', { className: 'text-5xl' }, fb.isCorrect ? '✅' : '❌'),
                  h(
                    'div',
                    { className: 'flex-1 text-left' },
                    h(
                      'div',
                      { className: 'text-xl font-bold' },
                      fb.isCorrect ? `+${fb.pts} pts` : 'Incorrect / timeout',
                    ),
                    h(
                      'div',
                      {
                        key: round,
                        className: 'font-bold text-amber-300',
                        style: { animation: 'pop .4s ease-out' },
                      },
                      fb.hype,
                    ),
                    fb.lvl &&
                      h(
                        'div',
                        {
                          className:
                            'text-sm ' + (fb.lvl === 'up' ? 'text-emerald-400' : 'text-red-400'),
                        },
                        fb.lvl === 'up'
                          ? `▲ Level up → Tier ${fb.nd}`
                          : `▼ Level down → Tier ${fb.nd}`,
                      ),
                  ),
                ),
                h(
                  'div',
                  { className: 'grid grid-cols-3 gap-2 text-center' },
                  [
                    ['Speed', (fb.timeMs / 1000).toFixed(1) + 's'],
                    ['Accuracy', acc],
                    ['Efficiency', Math.round(fb.moveEfficiency * 100) + '%'],
                  ].map(([a, b]) =>
                    h(
                      'div',
                      { key: a, className: 'bg-slate-900 rounded-xl p-2' },
                      h('div', { className: 'text-slate-400 text-xs' }, a),
                      h('div', { className: 'text-lg font-bold' }, b),
                    ),
                  ),
                ),
                h(
                  'button',
                  {
                    onClick: () => setOpen(!open),
                    className: 'py-2 rounded-xl bg-slate-800 text-sm',
                  },
                  (open ? 'Hide' : 'Show') + ' step-by-step breakdown',
                ),
                open && h(ExplainView, { text: fb.explain }),
                h(
                  'button',
                  {
                    onClick: () => (fb.br ? setBre(true) : next()),
                    className: 'py-4 rounded-2xl bg-indigo-600 font-bold text-lg',
                  },
                  'Next round ▶',
                ),
              )
          : fb
            ? h(
                'div',
                { className: 'h-full flex items-center justify-center text-7xl' },
                fb.isCorrect ? '✅' : '❌',
              )
            : h(G, { key: round, difficulty: eng.d, onRoundComplete: done, isMockMode: !!mock }),
      ),
      paused &&
        h(
          'div',
          {
            className:
              'absolute inset-0 z-20 backdrop-blur-xl bg-slate-950 flex flex-col gap-3 p-3 overflow-auto',
          },
          h('div', { className: 'text-center text-2xl font-bold' }, '⏸ Paused'),
          h(
            'div',
            { className: 'grid grid-cols-4 gap-2 text-center text-sm' },
            [
              ['Rounds', st.r],
              ['Accuracy', acc],
              ['Streak', eng.streak],
              ['Score', eng.score],
            ].map(([a, b]) =>
              h(
                'div',
                { key: a, className: 'bg-slate-900 rounded-lg p-2' },
                h('div', { className: 'font-bold' }, b),
                h('div', { className: 'text-[10px] text-slate-400' }, a),
              ),
            ),
          ),
          h(
            'div',
            { className: 'bg-slate-900 rounded-xl p-3 text-sm' },
            h('div', { className: 'text-xs text-slate-400 mb-1' }, 'HOW TO PLAY'),
            game.how,
          ),
          h('div', { className: 'flex-1' }),
          h(
            'button',
            { onClick: () => setP(false), className: 'py-3 rounded-xl bg-indigo-600 font-bold' },
            '▶ Resume',
          ),
          h(
            'button',
            {
              onClick: () => {
                setP(false);
                setRound((x) => x + 1);
              },
              className: 'py-3 rounded-xl bg-slate-800',
            },
            '↻ Restart Round',
          ),
          h(
            'button',
            { onClick: onExit, className: 'py-3 rounded-xl bg-slate-800' },
            '🏠 Quit to Menu',
          ),
        ),
    ),
  );
}
/* ---------- App shell ---------- */
function App() {
  const [store, setStore] = useState(() => load(GameRegistry)),
    [v, setV] = useState({ n: 'home' }),
    [tab, setTab] = useState('mock'),
    [ip, setIp] = useState(null),
    [rs, setRs] = useState(0),
    [mod, setMod] = useState('All'),
    adn = useRef(0);
  useEffect(() => {
    save(store);
  }, [store]);
  useEffect(() => {
    const f = (e) => {
      e.preventDefault();
      setIp(e);
    };
    window.addEventListener('beforeinstallprompt', f);
    return () => window.removeEventListener('beforeinstallprompt', f);
  }, []);
  const persist = useCallback(
    (id, p) =>
      setStore((s) => {
        const t = new Date().toDateString();
        let days = s.days,
          last = s.last;
        if (last !== t) {
          days = last === new Date(Date.now() - 864e5).toDateString() ? days + 1 : 1;
          last = t;
        }
        return { ...s, days, last, games: { ...s.games, [id]: { ...s.games[id], ...p } } };
      }),
    [],
  );
  setMute(store.mute);
  const pl = Object.values(store.games).filter((g) => g.max),
    pct = pl.length
      ? Math.round(cl(5 + (pl.reduce((a, g) => a + g.max, 0) / pl.length) * 9, 1, 99))
      : null;
  const shell = (c) =>
    h(
      'div',
      { className: 'mx-auto max-w-[540px] h-full flex flex-col p-3 gap-2 overflow-hidden' },
      c,
    );
  if (v.n === 'brief')
    return shell(
      h(Brief, {
        g: v.g,
        store,
        onBack: () => setV({ n: 'home' }),
        onStart: () => setV({ n: 'play', g: v.g }),
      }),
    );
  if (v.n === 'play')
    return shell(
      h(Runner, {
        key: v.g.id,
        game: v.g,
        store,
        persist,
        tick: () => ++adn.current % 5 === 0,
        onExit: () => setV({ n: 'home' }),
      }),
    );
  if (v.n === 'mock') {
    if (v.stage === 'run') {
      const it = v.list[v.i];
      return shell(
        h(Runner, {
          key: v.i,
          game: byId(it[0]),
          store,
          persist,
          mock: true,
          secs: it[1],
          onFinish: (s) =>
            setV((x) => {
              const res = [...x.res, s],
                last = x.i + 1 >= x.list.length;
              return { ...x, res, i: x.i + 1, stage: last ? 'done' : 'inter' };
            }),
          onExit: () => setV({ n: 'home' }),
        }),
      );
    }
    if (v.stage === 'inter')
      return shell(
        h(Breather, {
          title: 'Stage complete ✔',
          sub: 'Next up: ' + byId(v.list[v.i][0]).name,
          btn: 'Start ▶',
          onContinue: () => setV({ ...v, stage: 'run' }),
        }),
      );
    const tot = v.res.reduce((a, s) => a + s.s, 0);
    return shell([
      h('h2', { key: 1, className: 'text-xl font-bold' }, v.m.name + ' — Results'),
      h(
        'div',
        { key: 2, className: 'flex-1 overflow-auto flex flex-col gap-2' },
        v.res.map((s) =>
          h(
            'div',
            { key: s.id, className: 'bg-slate-900 rounded-xl p-3 text-sm' },
            h('b', null, byId(s.id).name),
            h(
              'div',
              { className: 'text-slate-400' },
              `Rounds ${s.r} · Accuracy ${s.r ? Math.round((s.c / s.r) * 100) : 0}% · Speed ${s.r ? (s.t / s.r / 1000).toFixed(1) : '–'}s · Efficiency ${s.r ? Math.round((s.e / s.r) * 100) : 0}% · ${s.s} pts`,
            ),
          ),
        ),
        h(
          'div',
          { className: 'text-center text-amber-300 font-bold text-lg' },
          'Total ' + tot + ' pts',
        ),
      ),
      h(
        'button',
        {
          key: 4,
          onClick: () => setV({ n: 'home' }),
          className: 'py-3 rounded-xl bg-indigo-600 font-bold',
        },
        'Home',
      ),
    ]);
  }
  const startMock = (m) => {
    const list = m.items.filter(([id]) => byId(id).ready).map(([id, secs]) => [id, secs]);
    if (list.length) setV({ n: 'mock', m, list, i: 0, res: [], stage: 'run' });
  };
  return shell([
    h(RankCard, { key: 0, store, onMute: () => setStore((s) => ({ ...s, mute: !s.mute })) }),
    h(
      'div',
      { key: 1, className: 'flex gap-2 shrink-0' },
      [
        ['Cognitive Percentile', pct ? pct + 'th (est.)' : '—'],
        ['Daily Streak', '🔥 ' + store.days],
      ].map(([a, b]) =>
        h(
          'div',
          { key: a, className: 'flex-1 bg-slate-900 rounded-xl p-3' },
          h('div', { className: 'text-xs text-slate-400' }, a),
          h('div', { className: 'text-xl font-bold' }, b),
        ),
      ),
    ),
    h(
      'div',
      { key: 2, className: 'flex shrink-0 rounded-xl bg-slate-900 p-1 text-sm' },
      [
        ['mock', 'Company Exam Simulators'],
        ['arc', 'Free Practice Arcade'],
      ].map(([k, l]) =>
        h(
          'button',
          {
            key: k,
            onClick: () => setTab(k),
            className:
              'flex-1 py-2 rounded-lg ' +
              (tab === k ? 'bg-indigo-600 font-bold' : 'text-slate-400'),
          },
          l,
        ),
      ),
    ),
    h(
      'div',
      { key: 3, className: 'flex-1 min-h-0 overflow-auto flex flex-col gap-2' },
      tab === 'mock'
        ? MOCKS.map((m) => {
            const ok = m.items.filter(([id]) => byId(id).ready);
            return h(
              'div',
              { key: m.id, className: 'bg-slate-900 rounded-xl p-3' },
              h('b', null, m.name),
              h(
                'div',
                { className: 'text-xs text-slate-400 my-1' },
                m.items
                  .map(
                    ([id, s]) =>
                      byId(id).name + (byId(id).ready ? '' : ' (soon)') + ' ' + s / 60 + 'm',
                  )
                  .join(' → '),
              ),
              h(
                'button',
                {
                  disabled: !ok.length,
                  onClick: () => startMock(m),
                  className:
                    'w-full py-2 rounded-lg font-bold ' +
                    (ok.length ? 'bg-indigo-600' : 'bg-slate-800 text-slate-500'),
                },
                ok.length
                  ? `Start (${ok.length} of ${m.items.length} games live)`
                  : 'Unlocks in a later phase',
              ),
            );
          }).concat([h(Builder, { key: 'bld', store, setStore, onStart: startMock })])
        : h(
            'div',
            { className: 'flex flex-col gap-2' },
            h(
              'div',
              { className: 'flex gap-1.5 overflow-x-auto shrink-0 pb-1' },
              MODS.map((m) =>
                h(
                  'button',
                  {
                    key: m,
                    onClick: () => setMod(m),
                    className:
                      'px-3 py-1 rounded-full text-xs whitespace-nowrap ' +
                      (mod === m ? 'bg-indigo-600 font-bold' : 'bg-slate-800 text-slate-400'),
                  },
                  m,
                ),
              ),
            ),
            h(
              'div',
              { className: 'grid grid-cols-2 gap-2' },
              GameRegistry.filter((g) => mod === 'All' || g.module === mod).map((g) => {
                const s = store.games[g.id] || {};
                return h(
                  'button',
                  {
                    key: g.id,
                    disabled: !g.ready,
                    onClick: () => setV({ n: 'brief', g }),
                    className:
                      'text-left rounded-2xl p-4 bg-slate-900 ' +
                      (g.ready ? 'active:bg-slate-800' : 'opacity-40'),
                  },
                  h('div', { className: 'text-4xl' }, g.icon),
                  h('div', { className: 'font-bold text-sm' }, g.name),
                  h('div', { className: 'text-[11px] text-slate-400' }, g.sub),
                  h(
                    'div',
                    { className: 'text-xs mt-1' },
                    g.ready
                      ? `Tier ${s.difficulty || 1} · High ${s.high || 0}`
                      : `Phase ${g.phase}`,
                  ),
                );
              }),
            ),
          ),
    ),

    h(
      'div',
      { key: 5, className: 'flex gap-2 shrink-0 text-xs' },
      ip &&
        h(
          'button',
          {
            onClick: () => {
              ip.prompt();
              setIp(null);
            },
            className: 'flex-1 py-2 rounded-lg bg-indigo-600',
          },
          '⬇ Install app',
        ),
      h(
        'button',
        {
          onClick: () => {
            if (rs) {
              setStore((s) => ({ ...EMPTY, customMocks: s.customMocks, mute: s.mute }));
              setRs(0);
            } else {
              setRs(1);
              setTimeout(() => setRs(0), 3000);
            }
          },
          className:
            'flex-1 py-2 rounded-lg bg-slate-800 ' + (rs ? 'text-red-400' : 'text-slate-400'),
        },
        rs ? 'Tap again to confirm' : 'Reset Stats',
      ),
    ),
  ]);
}

/* ---------- Mount + service worker ---------- */
createRoot(document.getElementById('root')).render(h(App));
// Inside the Capacitor Android shell every file is already bundled in the APK, so the service worker
// (which exists for the website/PWA build) is skipped there.
const isNativeShell = !!(
  window.Capacitor &&
  window.Capacitor.isNativePlatform &&
  window.Capacitor.isNativePlatform()
);
if (!isNativeShell && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
