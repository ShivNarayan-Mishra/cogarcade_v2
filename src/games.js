/**
 * games.js — the 14 procedural game engines, their solvers/verifiers, the GameRegistry,
 * official mock presets (MOCKS) and the arcade module filters (MODS).
 * Every puzzle is generated at runtime; no question bank exists anywhere in the project.
 */
import { Bar, PauseCtx, useAfter, useClock, usePz } from './engine.js';
import { R, cl, h, pk, shuf, useContext, useEffect, useMemo, useRef, useState } from './runtime.js';

/* ---------- Game 1: Bubble Math ---------- */
const bn = (d) => (d <= 3 ? (d === 1 ? 3 : 4) : d <= 7 ? 5 : d < 10 ? 6 : 7);
function expr(t, d) {
  if (!Number.isInteger(t)) return `${2 * t} ÷ 2`;
  if (d >= 8) {
    const x = R(2, 9),
      y = R(2, 9),
      z = x * y - t;
    return `(${x} × ${y}) ${z < 0 ? '+ ' + -z : '− ' + z}`;
  }
  const ops = d < 4 ? ['+', '−'] : ['+', '−', '×', '÷'];
  let o = ops[R(0, ops.length - 1)];
  if (o === '×') {
    const ds = [2, 3, 4, 5, 6, 7, 8, 9].filter((k) => t % k === 0 && t / k > 1);
    if (ds.length) {
      const k = ds[R(0, ds.length - 1)];
      return `${k} × ${t / k}`;
    }
    o = '+';
  }
  if (o === '÷') {
    const k = R(2, 5);
    return `${t * k} ÷ ${k}`;
  }
  if (o === '−') {
    const b = R(1, 9);
    return `${t + b} − ${b}`;
  }
  if (t < 3) {
    const b = R(1, 9);
    return `${t + b} − ${b}`;
  }
  const a = R(1, t - 1);
  return `${a} + ${t - a}`;
}
function BubbleMath({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const n = bn(d),
      step = d < 4 ? R(2, 5) : d >= 9 ? 0.5 : 1,
      st = d >= 8 ? R(-6, 10) : R(3, d < 4 ? 20 : 30);
    const cells = shuf([...Array(12).keys()]).slice(0, n);
    const items = shuf(Array.from({ length: n }, (_, i) => st + i * step)).map((v, i) => ({
      id: i,
      v,
      text: expr(v, d),
      left: (cells[i] % 3) * 33 + R(0, 5),
      top: Math.floor(cells[i] / 3) * 25 + R(0, 4),
      dur: R(20, 40) / 10,
    }));
    return {
      items,
      time: d <= 3 ? 12 : d <= 7 ? 10 : 9,
      sorted: [...items].sort((a, b) => a.v - b.v),
    };
  }, []);
  const [done, setDone] = useState([]),
    [bad, setBad] = useState(null),
    fin = useRef(false);
  const clock = useClock(P.time * 1000, () => finish(false, 0));
  function finish(ok, delay) {
    if (fin.current) return;
    fin.current = true;
    const timeMs = clock.el();
    const explain =
      P.sorted.map((x) => `${x.text} = ${x.v}`).join('\n') +
      '\n= ' +
      P.sorted.map((x) => x.v).join(' < ') +
      '\nTip: solve the easiest bubbles first, then tap smallest → largest, crossing off as you go.';
    setTimeout(() => onRoundComplete({ isCorrect: ok, timeMs, moveEfficiency: 1, explain }), delay);
  }
  const tap = (it) => {
    if (fin.current || done.includes(it.id)) return;
    if (it.id === P.sorted[done.length].id) {
      const nd = [...done, it.id];
      setDone(nd);
      if (nd.length === P.items.length) finish(true, 250);
    } else {
      setBad(it.id);
      finish(false, 600);
    }
  };
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h('div', { className: 'text-center text-sm text-slate-400' }, 'Tap lowest → highest result'),
    h(
      'div',
      { className: 'relative flex-1 min-h-0' },
      P.items.map((it) =>
        h(
          'button',
          {
            key: it.id,
            onClick: () => tap(it),
            className:
              'absolute rounded-full aspect-square flex items-center justify-center text-center font-bold text-lg text-white shadow-lg ' +
              (done.includes(it.id)
                ? 'bg-emerald-600/40'
                : bad === it.id
                  ? 'bg-red-500'
                  : 'bg-sky-600'),
            style: {
              left: it.left + '%',
              top: it.top + '%',
              width: '27%',
              animation: d >= 8 ? `fl ${it.dur}s ease-in-out infinite alternate` : undefined,
            },
          },
          done.includes(it.id) || (fin.current && bad !== null)
            ? it.text + (fin.current && bad !== null ? '\n=' + it.v : '')
            : it.text,
        ),
      ),
    ),
  );
}

/* ---------- Game 2: Fleeting Numbers ---------- */
const fnN = (d) => (d <= 3 ? (d < 3 ? 4 : 5) : d <= 7 ? (d < 6 ? 6 : 7) : d < 10 ? 8 : 9);
function Fleeting({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const n = fnN(d),
      cells = shuf([...Array(30).keys()]);
    return {
      n,
      vis: d <= 3 ? 2000 : d <= 7 ? 1200 : 750,
      pos: cells.slice(0, n),
      dec: d >= 4 && d <= 7 ? cells.slice(n, n + 5) : [],
      rev: d >= 9 && Math.random() < 0.5,
    };
  }, []);
  const order = useMemo(() => {
    const a = Array.from({ length: P.n }, (_, i) => i + 1);
    return P.rev ? a.reverse() : a;
  }, []);
  const [ph, setPh] = useState('show'),
    [step, setStep] = useState(0),
    t0 = useRef(0),
    taps = useRef(0),
    fin = useRef(false);
  useAfter(
    () => {
      setPh('rec');
      t0.current = Date.now();
    },
    ph === 'show' ? P.vis : null,
    [ph],
  );
  usePz(t0);
  const finish = (ok, s, delay) => {
    if (fin.current) return;
    fin.current = true;
    const explain =
      P.pos
        .map((c, i) => `Tile ${i + 1} → row ${((c / 5) | 0) + 1}, col ${(c % 5) + 1}`)
        .join('\n') +
      '\n= Replay ' +
      (P.rev ? 'high → low' : '1 → ' + P.n) +
      '\nTip: chain positions into a path or shape (e.g. "top-left → down → right") instead of memorising tiles one by one.';
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: ok,
          timeMs: Date.now() - t0.current,
          moveEfficiency: taps.current ? s / taps.current : 0,
          explain,
        }),
      delay,
    );
  };
  const tap = (c) => {
    if (ph !== 'rec' || fin.current) return;
    taps.current++;
    const k = P.pos.indexOf(c);
    if (k >= 0 && k + 1 === order[step]) {
      const s = step + 1;
      setStep(s);
      if (s === P.n) finish(true, s, 300);
    } else {
      setPh('over');
      finish(false, step, 1200);
    }
  };
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      ph === 'show' ? 'Memorise…' : P.rev ? 'REVERSE: tap highest → lowest' : 'Tap 1 → ' + P.n,
    ),
    h(
      'div',
      { className: 'grid grid-cols-5 grid-rows-6 gap-1.5 flex-1 min-h-0' },
      Array.from({ length: 30 }, (_, c) => {
        const k = P.pos.indexOf(c),
          isDec = P.dec.includes(c),
          doneT = k >= 0 && order.indexOf(k + 1) < step;
        let cls = 'bg-slate-800/50',
          txt = '';
        if (ph === 'show') {
          if (k >= 0) {
            cls = 'bg-sky-500 text-white';
            txt = k + 1;
          } else if (isDec) cls = 'bg-sky-500';
        } else if (doneT) {
          cls = 'bg-emerald-600/50';
          txt = k + 1;
        } else if (k >= 0 || isDec) {
          cls = ph === 'over' && k >= 0 ? 'bg-red-500 text-white' : 'bg-slate-300';
          txt = ph === 'over' && k >= 0 ? k + 1 : '';
        }
        return h(
          'button',
          {
            key: c,
            onClick: () => tap(c),
            className: 'rounded-lg font-bold text-xl flex items-center justify-center ' + cls,
          },
          txt,
        );
      }),
    ),
  );
}

/* ---------- Game 4: Switch Challenge ---------- */
const SY = [
  ['c', '#38bdf8'],
  ['t', '#fb923c'],
  ['s', '#a3e635'],
  ['d', '#e879f9'],
  ['p', '#facc15'],
];
function Sh({ i, s = 34 }) {
  const [k, f] = SY[i],
    p = { fill: f };
  return h(
    'svg',
    { viewBox: '0 0 24 24', width: s, height: s },
    k === 'c'
      ? h('circle', { cx: 12, cy: 12, r: 10, ...p })
      : k === 't'
        ? h('polygon', { points: '12,2 22,21 2,21', ...p })
        : k === 's'
          ? h('rect', { x: 3, y: 3, width: 18, height: 18, ...p })
          : k === 'd'
            ? h('polygon', { points: '12,1 23,12 12,23 1,12', ...p })
            : h('polygon', {
                points: '12,1.5 15,9 23,9.5 17,14.5 19,22.5 12,18 5,22.5 7,14.5 1,9.5 9,9',
                ...p,
              }),
  );
}
const rperm = (n) => {
  for (let g = 0; g < 50; g++) {
    const p = shuf(Array.from({ length: n }, (_, i) => i + 1));
    if (!p.every((v, i) => v === i + 1)) return p;
  }
  return Array.from({ length: n }, (_, i) => ((i + 1) % n) + 1);
};
/**
 * Applies a switch code the Aon way: output slot i receives the symbol from input slot c[i].
 * Example: ap([A, B, C, D], [3, 1, 4, 2]) -> [C, A, D, B]. O(n).
 */
const ap = (a, c) => c.map((x) => a[x - 1]); /* Aon standard: output slot i takes input slot c[i] */
function decoys(ans, n, same) {
  const set = new Map([[ans.join('-'), ans]]);
  let g = 0;
  while (set.size < 4 && g++ < 200) {
    let p;
    if (same) {
      p = [...ans];
      const i = R(1, n - 1),
        j = R(1, n - 1);
      [p[i], p[j]] = [p[j], p[i]];
    } else p = rperm(n);
    set.set(p.join('-'), p);
  }
  for (let g = 0; g < 100 && set.size < 4; g++) {
    const p = rperm(n);
    set.set(p.join('-'), p);
  }
  return shuf([...set.values()]);
}
const swTime = (d) => (d < 5 ? 20000 : d < 8 ? 35000 : 30000);
function Switch({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const dbl = d >= 5 && d <= 7,
      n = d >= 8 ? 5 : 4,
      top = shuf([...Array(n).keys()]),
      c1 = rperm(n),
      mid = ap(top, c1);
    let c2 = null,
      bot = mid,
      ask = 1;
    if (dbl) {
      c2 = rperm(n);
      bot = ap(mid, c2);
      ask = R(1, 2);
    }
    const ans = ask === 1 ? c1 : c2;
    return { dbl, n, top, bot, c1, c2, ask, ans, opts: decoys(ans, n, d >= 8) };
  }, []);
  const [pick, setPick] = useState(null),
    fin = useRef(false),
    clock = useClock(swTime(d), () => finish(null));
  function finish(o) {
    if (fin.current) return;
    fin.current = true;
    setPick(o ? o.join('-') : 'x');
    const ok = !!o && o.join('-') === P.ans.join('-');
    const explain =
      P.ans
        .map((c, i) => `${P.dbl ? 'Switch ' + P.ask + ': ' : ''}output ${i + 1} ← input ${c}`)
        .join('\n') +
      `\n= Code ${P.ans.join('-')}\nTip: code digit i = which INPUT slot feeds output slot i. Anchor on one symbol in the bottom row and rule out options by their first digit.`;
    setTimeout(
      () => onRoundComplete({ isCorrect: ok, timeMs: clock.el(), moveEfficiency: 1, explain }),
      900,
    );
  }
  const row = (a) =>
    h(
      'div',
      { className: 'flex justify-center gap-3' },
      a.map((s, i) =>
        h(
          'div',
          { key: i, className: 'flex flex-col items-center' },
          h(Sh, { i: s }),
          h('span', { className: 'text-[10px] text-slate-500' }, i + 1),
        ),
      ),
    );
  const box = (l, c, hid) =>
    h(
      'div',
      {
        className: 'mx-auto px-4 py-2 rounded-lg border border-slate-600 bg-slate-900 text-center',
      },
      h('div', { className: 'text-[10px] text-slate-400' }, l),
      h('div', { className: 'font-mono text-lg' }, hid ? '?' : c.join('-')),
    );
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      P.dbl ? `Find the code of Switch ${P.ask}` : 'Which code matches the funnel?',
    ),
    h(
      'div',
      { className: 'flex-1 min-h-0 flex flex-col justify-around' },
      row(P.top),
      h('div', { className: 'text-center text-slate-500' }, '▼'),
      P.dbl
        ? [box('SWITCH 1', P.c1, P.ask === 1), box('SWITCH 2', P.c2, P.ask === 2)]
        : box('SWITCH', P.c1, true),
      h('div', { className: 'text-center text-slate-500' }, '▼'),
      row(P.bot),
    ),
    h(
      'div',
      { className: 'grid grid-cols-2 gap-2 shrink-0' },
      P.opts.map((o) => {
        const k = o.join('-'),
          right = k === P.ans.join('-');
        return h(
          'button',
          {
            key: k,
            onClick: () => !fin.current && finish(o),
            className:
              'py-3 rounded-xl font-mono text-lg ' +
              (pick === null
                ? 'bg-slate-800 active:bg-slate-700'
                : right
                  ? 'bg-emerald-600'
                  : pick === k
                    ? 'bg-red-600'
                    : 'bg-slate-800 opacity-50'),
          },
          k,
        );
      }),
    ),
  );
}

/* ---------- Game 3: Digit Challenge ---------- */
const DT = [
  [
    ['_ + _ − _', (a, b, c) => a + b - c],
    ['_ − _ + _', (a, b, c) => a - b + c],
    ['_ + _ + _', (a, b, c) => a + b + c],
  ],
  [
    ['_ × _ − _', (a, b, c) => a * b - c],
    ['_ × _ + _', (a, b, c) => a * b + c],
    ['_ + _ × _', (a, b, c) => a + b * c],
    ['_ − _ × _', (a, b, c) => a - b * c],
  ],
  [
    ['_ × _ − _ + _', (a, b, c, e) => a * b - c + e],
    ['(_ + _) × _ − _', (a, b, c, e) => (a + b) * c - e],
    ['_ × _ ÷ _ + _', (a, b, c, e) => (a * b) / c + e],
    ['(_ − _) × (_ + _)', (a, b, c, e) => (a - b) * (c + e)],
    ['_ × _ + _ × _', (a, b, c, e) => a * b + c * e],
  ],
];
function Digit({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const pool = d <= 3 ? DT[0] : d <= 7 ? DT[1] : DT[2];
    let t,
      f,
      ds,
      v,
      good = false;
    for (let g = 0; g < 500 && !good; g++) {
      [t, f] = pool[R(0, pool.length - 1)];
      ds = shuf([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, t.match(/_/g).length);
      v = f(...ds);
      good = Number.isInteger(v) && v >= 1;
    }
    if (!good) {
      [t, f] = DT[0][0];
      ds = [9, 5, 3];
      v = f(...ds);
    }
    return { t, f, ds, v, n: ds.length };
  }, []);
  const [sl, setSl] = useState(Array(P.n).fill(0)),
    [res, setRes] = useState(null),
    taps = useRef(0),
    fin = useRef(false),
    clock = useClock(36000, () => finish(false));
  function finish(ok) {
    if (fin.current) return;
    fin.current = true;
    setRes(ok);
    let j = 0;
    const explain = `Target → ${P.v}\nSolution → ${P.t.replace(/_/g, () => P.ds[j++])} = ${P.v}\n= Any unique digits that hit ${P.v} count\nTip: factor the target first (24 = 3×8 = 4×6), lock the big operation, then adjust with the leftover digits.`;
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: ok,
          timeMs: clock.el(),
          moveEfficiency: cl(P.n / Math.max(taps.current, P.n), 0, 1),
          explain,
        }),
      900,
    );
  }
  const place = (x) => {
    if (fin.current || sl.includes(x)) return;
    const i = sl.indexOf(0);
    if (i < 0) return;
    taps.current++;
    setSl((s) => s.map((v, k) => (k === i ? x : v)));
  };
  const clear = (i) => {
    if (fin.current || !sl[i]) return;
    taps.current++;
    setSl((s) => s.map((v, k) => (k === i ? 0 : v)));
  };
  const submit = () => finish(new Set(sl).size === P.n && Math.abs(P.f(...sl) - P.v) < 1e-9);
  let si = 0;
  return h(
    'div',
    { className: 'flex flex-col h-full gap-3' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      'Fill the slots — each digit used once (tap a slot to clear)',
    ),
    h(
      'div',
      { className: 'flex flex-wrap items-center justify-center gap-1.5 text-2xl py-4' },
      P.t.split(/(_)/).map((p, j) => {
        if (p !== '_') return h('span', { key: j, className: 'whitespace-pre text-slate-300' }, p);
        const i = si++;
        return h(
          'button',
          {
            key: j,
            onClick: () => clear(i),
            className:
              'w-11 h-12 rounded-lg border-2 font-bold ' +
              (res === null
                ? 'border-sky-500 bg-slate-900'
                : res
                  ? 'border-emerald-500 bg-emerald-900'
                  : 'border-red-500 bg-red-900'),
          },
          sl[i] || '',
        );
      }),
      h('span', null, ' = '),
      h('b', { className: 'text-amber-300' }, P.v),
    ),
    h(
      'div',
      { className: 'grid grid-cols-3 gap-2 flex-1 min-h-0 content-start' },
      Array.from({ length: 9 }, (_, i) => i + 1).map((x) =>
        h(
          'button',
          {
            key: x,
            disabled: sl.includes(x) || res !== null,
            onClick: () => place(x),
            className:
              'py-4 rounded-xl text-2xl font-bold ' +
              (sl.includes(x) ? 'bg-slate-900 text-slate-700' : 'bg-slate-800 active:bg-slate-700'),
          },
          x,
        ),
      ),
    ),
    h(
      'button',
      {
        disabled: !sl.every(Boolean) || res !== null,
        onClick: submit,
        className:
          'py-3 rounded-xl font-bold ' +
          (sl.every(Boolean) ? 'bg-indigo-600' : 'bg-slate-800 text-slate-500'),
      },
      'Check ✔',
    ),
  );
}

/* ---------- Game 5: Grid Challenge ---------- */
const gN = (d) => (d <= 3 ? 3 : d <= 6 ? 4 : d <= 9 ? 5 : 6);
const mkPat = () => {
  const A = shuf(Array.from({ length: 16 }, (_, i) => i < 6)),
    B = A.map((_, i) => A[(i >> 2) * 4 + 3 - (i & 3)]),
    match = Math.random() < 0.5;
  if (!match)
    shuf([...Array(16).keys()])
      .slice(0, R(1, 2))
      .forEach((i) => (B[i] = !B[i]));
  return { A, B, match };
};
function Grid({ difficulty: d, onRoundComplete }) {
  const N = gN(d),
    dots = useMemo(() => shuf([...Array(25).keys()]).slice(0, N), []);
  const [ph, setPh] = useState('dot'),
    [k, setK] = useState(0),
    [dd, setDd] = useState(null),
    [step, setStep] = useState(0);
  const acc = useRef({ ms: 0, miss: 0, taps: 0, good: 0 }),
    ds = useRef(0),
    t0 = useRef(0),
    fin = useRef(false),
    lk = useRef(false);
  const adv = (ans) => {
    if (fin.current || lk.current) return;
    lk.current = true;
    const a = acc.current;
    a.ms += Date.now() - ds.current;
    if (ans !== dd.match) a.miss++;
    if (k + 1 === N) {
      setPh('rec');
      t0.current = Date.now();
    } else {
      setK(k + 1);
      setPh('dot');
    }
  };
  const pz = useContext(PauseCtx);
  useEffect(() => {
    if (ph === 'dist') {
      lk.current = false;
      ds.current = Date.now();
    }
  }, [ph, k]);
  useAfter(
    () => {
      setDd(mkPat());
      setPh('dist');
    },
    ph === 'dot' ? 1400 : null,
    [ph, k],
  );
  useAfter(() => adv(null), ph === 'dist' ? 3200 : null, [ph, k]);
  usePz(ds, t0);
  function end(ok) {
    fin.current = true;
    const a = acc.current,
      timeMs = a.ms + (Date.now() - t0.current),
      eff = cl((N - a.miss) / N, 0, 1) * (a.taps ? a.good / a.taps : 0),
      ok2 = ok && a.miss <= 1;
    const explain =
      dots.map((c, i) => `Dot ${i + 1} → row ${((c / 5) | 0) + 1}, col ${(c % 5) + 1}`).join('\n') +
      `\n= You missed ${a.miss} of ${N} checks (more than 1 fails the round)\nTip: turn each dot into a path ("down 2, right 1"); for mirror checks compare the left grid's first column with the right grid's last.`;
    setTimeout(
      () => onRoundComplete({ isCorrect: ok2, timeMs, moveEfficiency: eff, explain }),
      ok ? 600 : 1200,
    );
  }
  const tap = (c) => {
    if (ph !== 'rec' || fin.current) return;
    const a = acc.current;
    a.taps++;
    if (c === dots[step]) {
      a.good++;
      const s = step + 1;
      setStep(s);
      if (s === N) end(true);
    } else {
      setPh('over');
      end(false);
    }
  };
  const mini = (g) =>
    h(
      'div',
      { className: 'grid grid-cols-4 gap-1 w-1/2' },
      g.map((on, i) =>
        h('div', {
          key: i,
          className: 'aspect-square rounded ' + (on ? 'bg-sky-400' : 'bg-slate-800'),
        }),
      ),
    );
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      ph === 'dot'
        ? `Remember this dot (${k + 1}/${N})`
        : ph === 'dist'
          ? 'Is the RIGHT grid a mirror image of the LEFT?'
          : 'Tap the dots in the order shown',
    ),
    ph === 'dist'
      ? h(
          'div',
          { className: 'h-2 rounded bg-slate-800 overflow-hidden' },
          h('div', {
            key: k,
            className: 'h-full bg-amber-400',
            style: {
              animation: 'sh 3.2s linear forwards',
              animationPlayState: pz ? 'paused' : 'running',
            },
          }),
        )
      : h('div', { className: 'h-2' }),
    ph === 'dist' && dd
      ? h(
          'div',
          { className: 'flex-1 flex flex-col justify-center gap-6' },
          h('div', { className: 'flex gap-4' }, mini(dd.A), mini(dd.B)),
          h(
            'div',
            { className: 'grid grid-cols-2 gap-2' },
            [
              [true, 'MATCH'],
              [false, 'NO MATCH'],
            ].map(([v, l]) =>
              h(
                'button',
                {
                  key: l,
                  onClick: () => adv(v),
                  className: 'py-4 rounded-xl bg-slate-800 active:bg-slate-700 font-bold',
                },
                l,
              ),
            ),
          ),
        )
      : h(
          'div',
          { className: 'flex-1 flex items-center' },
          h(
            'div',
            { className: 'grid grid-cols-5 gap-1.5 w-full max-w-[420px] mx-auto' },
            Array.from({ length: 25 }, (_, c) => {
              const di = dots.indexOf(c);
              let cls = 'bg-slate-800',
                tx = '';
              if (ph === 'dot' && c === dots[k]) cls = 'bg-sky-400';
              if (ph !== 'dot' && di >= 0 && di < step) {
                cls = 'bg-emerald-600/60';
                tx = di + 1;
              }
              if (ph === 'over' && di >= step) {
                cls = 'bg-red-500';
                tx = di + 1;
              }
              return h(
                'button',
                {
                  key: c,
                  onClick: () => tap(c),
                  className: 'aspect-square rounded-lg font-bold ' + cls,
                },
                tx,
              );
            }),
          ),
        ),
  );
}

/* ---------- Game 6: Geo-Sudoku ---------- */
const NM = ['Circle', 'Triangle', 'Square', 'Diamond', 'Star'];
function Geo({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const n = d <= 5 ? 4 : 5,
      rp = shuf([...Array(n).keys()]),
      cp = shuf([...Array(n).keys()]),
      sp = shuf([...Array(n).keys()]);
    const L = rp.map((r) => cp.map((c) => sp[(r + c) % n])),
      tr = R(0, n - 1),
      tc = R(0, n - 1),
      ans = L[tr][tc],
      cells = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (r !== tr || c !== tc) cells.push([r, c]);
    const covers = (m) => {
      const s = new Set();
      cells.forEach(([r, c], i) => {
        if (!m.has(i) && (r === tr || c === tc)) s.add(L[r][c]);
      });
      return s.size === n - 1;
    };
    let mask = new Set();
    for (let K = Math.min(n === 4 ? d + 2 : d * 2 + 2, cells.length); K >= 0; K--) {
      let ok = false;
      for (let g = 0; g < 80 && !ok; g++) {
        const m = new Set(shuf([...cells.keys()]).slice(0, K));
        if (covers(m)) {
          mask = m;
          ok = true;
        }
      }
      if (ok) break;
    }
    const hid = new Set([...mask].map((i) => cells[i][0] * n + cells[i][1]));
    return { n, L, tr, tc, ans, hid };
  }, []);
  const [pick, setPick] = useState(null),
    fin = useRef(false),
    clock = useClock(25000, () => finish(null));
  function finish(p) {
    if (fin.current) return;
    fin.current = true;
    setPick(p === null ? -1 : p);
    const { n, L, tr, tc, ans } = P;
    const explain = `Row ${tr + 1} shows → ${
      L[tr]
        .filter((_, c) => c !== tc && !P.hid.has(tr * n + c))
        .map((x) => NM[x])
        .join(', ') || 'nothing'
    }\nColumn ${tc + 1} shows → ${
      L.map((r) => r[tc])
        .filter((_, r) => r !== tr && !P.hid.has(r * n + tc))
        .map((x) => NM[x])
        .join(', ') || 'nothing'
    }\n= The ? is the ${NM[ans]}\nTip: only the ? row and column matter — name the shapes you see there and pick the missing one.`;
    setTimeout(
      () =>
        onRoundComplete({ isCorrect: p === ans, timeMs: clock.el(), moveEfficiency: 1, explain }),
      900,
    );
  }
  const { n } = P;
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      'Every row & column has each shape once — what is the ?',
    ),
    h(
      'div',
      { className: 'flex-1 flex items-center' },
      h(
        'div',
        {
          className: 'grid gap-1.5 w-full max-w-[420px] mx-auto',
          style: { gridTemplateColumns: `repeat(${n},1fr)` },
        },
        P.L.flatMap((row, r) =>
          row.map((s, c) => {
            const q = r === P.tr && c === P.tc,
              hid = P.hid.has(r * n + c);
            return h(
              'div',
              {
                key: r * n + c,
                className:
                  'aspect-square rounded-lg flex items-center justify-center ' +
                  (q
                    ? 'bg-amber-500/30 border-2 border-amber-400 text-2xl font-bold'
                    : hid
                      ? 'bg-slate-900'
                      : 'bg-slate-800'),
              },
              q ? '?' : hid ? null : h(Sh, { i: s, s: 28 }),
            );
          }),
        ),
      ),
    ),
    h(
      'div',
      { className: 'flex justify-center gap-2 shrink-0' },
      Array.from({ length: n }, (_, i) =>
        h(
          'button',
          {
            key: i,
            onClick: () => !fin.current && finish(i),
            className:
              'p-3 rounded-xl ' +
              (pick === null
                ? 'bg-slate-800 active:bg-slate-700'
                : i === P.ans
                  ? 'bg-emerald-600'
                  : pick === i
                    ? 'bg-red-600'
                    : 'bg-slate-800 opacity-50'),
          },
          h(Sh, { i, s: 32 }),
        ),
      ),
    ),
  );
}

/* ---------- Game 7: Pathfinder (BFS-verified) ---------- */
/**
 * Breadth-first shortest path on an n x n grid stored as a flat array (index = row * n + col).
 * @param {boolean[]} w  wall flags
 * @param {number} n     grid side length
 * @param {number} s     start cell index
 * @param {number} t     goal cell index
 * @returns {number} steps on a shortest 4-connected path, or -1 if the goal is unreachable.
 * Time O(n^2), space O(n^2): every cell is enqueued at most once.
 */
const bfs = (w, n, s, t) => {
  const D = Array(n * n).fill(-1);
  D[s] = 0;
  const q = [s];
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    if (u === t) return D[u];
    const r = (u / n) | 0,
      c = u % n;
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([a, b]) => {
      const y = r + a,
        x = c + b,
        v = y * n + x;
      if (y >= 0 && y < n && x >= 0 && x < n && !w[v] && D[v] < 0) {
        D[v] = D[u] + 1;
        q.push(v);
      }
    });
  }
  return -1;
};
function Pathfinder({ difficulty: d, onRoundComplete }) {
  const mem = d >= 6 && d % 2 === 0;
  const P = useMemo(() => {
    const n = d <= 5 ? 5 : 6,
      N2 = n * n,
      D = N2 - 1,
      W = Math.round(N2 * (0.12 + 0.025 * d));
    for (let tries = 0; tries < 400; tries++) {
      const K = R(1, N2 - 2),
        w = Array(N2).fill(false);
      shuf([...Array(N2).keys()].filter((i) => i && i !== D && i !== K))
        .slice(0, W)
        .forEach((i) => (w[i] = true));
      const d1 = bfs(w, n, 0, K),
        d2 = bfs(w, n, K, D);
      if (d1 > 0 && d2 > 0) return { n, D, K, w, d1, d2, opt: d1 + d2 };
    }
    const w0 = Array(N2).fill(false),
      K0 = N2 >> 1,
      e1 = bfs(w0, n, 0, K0),
      e2 = bfs(w0, n, K0, D);
    return { n, D, K: K0, w: w0, d1: e1, d2: e2, opt: e1 + e2 };
  }, []);
  const [ph, setPh] = useState(mem ? 'show' : 'play'),
    [s, setS] = useState({ p: 0, key: false, mv: 0, rev: [] }),
    [msg, setMsg] = useState(''),
    fin = useRef(false),
    t0 = useRef(Date.now());
  const clock = useClock(40000 + (mem ? 2500 : 0), () => finish(false, s.mv));
  useAfter(
    () => {
      setPh('play');
      t0.current = Date.now();
    },
    mem && ph === 'show' ? 2500 : null,
    [ph],
  );
  usePz(t0);
  function finish(ok, m) {
    if (fin.current) return;
    fin.current = true;
    const { n, w } = P;
    const walls = w
      .map((x, i) => (x ? `(${((i / n) | 0) + 1},${(i % n) + 1})` : ''))
      .filter(Boolean)
      .join(' ');
    const explain = `Start → Key = ${P.d1} steps\nKey → Door = ${P.d2} steps\nWalls (row,col) → ${walls || 'none'}\n= Optimal ${P.opt} moves, you used ${m}\nTip: plan the whole S → 🔑 → 🚪 route first and walk it without detours; in memory rounds, memorise wall clusters as lines.`;
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: ok,
          timeMs: Date.now() - t0.current,
          moveEfficiency: cl(P.opt / Math.max(m, 1), 0, 1),
          explain,
        }),
      ok ? 500 : 1000,
    );
  }
  const n = P.n;
  const mv = (dr, dc) => {
    if (fin.current || ph !== 'play') return;
    const y = ((s.p / n) | 0) + dr,
      x = (s.p % n) + dc,
      v = y * n + x;
    if (y < 0 || y >= n || x < 0 || x >= n) return;
    if (P.w[v]) {
      if (mem && !s.rev.includes(v)) setS({ ...s, rev: [...s.rev, v], mv: s.mv + 1 });
      return;
    }
    if (v === P.D && !s.key) {
      setMsg('Find the key first 🔑');
      return;
    }
    const key = s.key || v === P.K,
      m = s.mv + 1;
    setS({ ...s, p: v, key, mv: m });
    setMsg('');
    if (v === P.D && key) finish(true, m);
  };
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      (mem
        ? ph === 'show'
          ? 'Memorise the walls!'
          : 'Walls hidden — a hit costs +1 move'
        : 'Go S → 🔑 → 🚪') +
        ' · Moves ' +
        s.mv,
    ),
    h(
      'div',
      { className: 'flex-1 flex items-center' },
      h(
        'div',
        {
          className: 'grid gap-1.5 w-full max-w-[420px] mx-auto',
          style: { gridTemplateColumns: `repeat(${n},1fr)` },
        },
        Array.from({ length: n * n }, (_, i) => {
          const vis = P.w[i] && (!mem || ph === 'show');
          let cls = 'bg-slate-800',
            tx = '';
          if (vis) cls = 'bg-slate-500';
          if (s.rev.includes(i)) cls = 'bg-red-600';
          if (i === 0) tx = 'S';
          else if (i === P.D) tx = '🚪';
          else if (i === P.K && !s.key) tx = '🔑';
          if (i === s.p) {
            cls += ' ring-2 ring-amber-300';
            tx = '●';
          }
          return h(
            'button',
            {
              key: i,
              onClick: () => {
                const a = ((i / n) | 0) - ((s.p / n) | 0),
                  b = (i % n) - (s.p % n);
                if (Math.abs(a) + Math.abs(b) === 1) mv(a, b);
              },
              className: 'aspect-square rounded-lg font-bold ' + cls,
            },
            tx,
          );
        }),
      ),
    ),
    h(
      'div',
      { className: 'grid grid-cols-4 gap-2 shrink-0' },
      [
        ['◀', 0, -1],
        ['▲', -1, 0],
        ['▼', 1, 0],
        ['▶', 0, 1],
      ].map(([l, a, b]) =>
        h(
          'button',
          {
            key: l,
            onClick: () => mv(a, b),
            className: 'py-3 rounded-xl bg-slate-800 active:bg-slate-700 text-xl',
          },
          l,
        ),
      ),
    ),
    h('div', { className: 'h-4 text-center text-xs text-amber-300' }, msg),
  );
}

/* ---------- Game 8: Bitwise & Pseudocode Blitz ---------- */
const bin = (x) => (x < 0 ? '-' : '') + Math.abs(x).toString(2);
const OPS = { '&': (x, y) => x & y, '|': (x, y) => x | y, '^': (x, y) => x ^ y },
  OK = Object.keys(OPS);
function mcq(out, alts) {
  const s = new Set([out]);
  shuf(alts).forEach((v) => {
    if (s.size < 4 && Number.isFinite(v)) s.add(v);
  });
  for (let k = 1; s.size < 4 && k < 20; k++) {
    s.add(out + k);
    if (s.size < 4) s.add(out - k);
  }
  return shuf([...s]);
}
const lp = (x, K, sh, op, mode) => {
  let sum = 0;
  const tr = [];
  for (let i = 1; i <= K; i++) {
    const t = sh === '<<' ? x << 1 : sh === '>>' ? x >> 1 : x;
    x = mode === 'x' ? OPS[op](t, i) : t;
    if (mode === 'sum') sum += OPS[op](x, i);
    tr.push(`i=${i}: x=${bin(x)} (${x})` + (mode === 'sum' ? `, sum=${sum}` : ''));
  }
  return { v: mode === 'x' ? x : sum, tr };
};
function bwGen(d) {
  if (d <= 3) {
    const a = R(3, 15),
      b = R(3, 15),
      o1 = pk(OK),
      o2 = pk(OK),
      o3 = pk(OK.filter((o) => o !== o1)),
      pf = pk(['+', '-']),
      pg = pf === '+' ? '-' : '+';
    const ex = (p1, p2, f, old) => {
        const a1 = OPS[p1](a, b),
          b1 = OPS[p2](old ? a : a1, b);
        return { a1, b1, v: f === '+' ? a1 + b1 : a1 - b1 };
      },
      r = ex(o1, o2, pf);
    return {
      lines: [`Set a = ${a}`, `Set b = ${b}`, `a = a ${o1} b`, `b = a ${o2} b`, `Print a ${pf} b`],
      out: r.v,
      alts: [ex(o1, o2, pg).v, ex(o1, o2, pf, 1).v, ex(o3, o2, pf).v, ex(o1, o3, pf).v, a + b],
      exp: `a = ${a} (${bin(a)}), b = ${b} (${bin(b)})\na = a ${o1} b → ${bin(a)} ${o1} ${bin(b)} = ${bin(r.a1)} (${r.a1})\nb = a ${o2} b → ${bin(r.a1)} ${o2} ${bin(b)} = ${bin(r.b1)} (${r.b1}) — uses the NEW a\n= Print a ${pf} b = ${r.a1} ${pf} ${r.b1} = ${r.v}\nTip: write both numbers in binary and work one bit-column at a time — AND needs both 1, OR needs either, XOR needs exactly one.`,
    };
  }
  if (d <= 7) {
    const sh = pk(['<<', '>>']),
      x = sh === '<<' ? R(1, 9) : R(20, 99),
      K = d >= 6 ? 4 : 3,
      op = pk(OK),
      mode = pk(['sum', 'x']),
      o2 = pk(OK.filter((o) => o !== op)),
      r = lp(x, K, sh, op, mode);
    const lines =
      mode === 'sum'
        ? [
            `Set x = ${x}`,
            'Set sum = 0',
            `for i = 1 to ${K}`,
            `  x = x ${sh} 1`,
            `  sum = sum + (x ${op} i)`,
            'Print sum',
          ]
        : [`Set x = ${x}`, `for i = 1 to ${K}`, `  x = (x ${sh} 1) ${op} i`, 'Print x'];
    return {
      lines,
      out: r.v,
      alts: [
        lp(x, K - 1, sh, op, mode).v,
        lp(x, K + 1, sh, op, mode).v,
        lp(x, K, 'none', op, mode).v,
        lp(x, K, sh, o2, mode).v,
      ],
      exp:
        `Start x = ${bin(x)} (${x}); ${sh} 1 ${sh === '<<' ? 'doubles' : 'halves (floor)'}\n` +
        r.tr.join('\n') +
        `\n= Print ${r.v}\nTip: a shift by 1 is just ×2 or ÷2 (floor) — redo each pass in binary and keep a running total.`,
    };
  }
  const t = pk(['fib', 'pop', 'xr']);
  if (t === 'fib') {
    const k = R(5, d >= 10 ? 9 : 8),
      F = [0, 1];
    for (let i = 2; i <= k + 1; i++) F.push(F[i - 1] + F[i - 2]);
    return {
      lines: [
        'fun(n):',
        '  if (n <= 1) return n',
        '  return fun(n-1) + fun(n-2)',
        `Set k = ${k}`,
        'Print fun(k)',
      ],
      out: F[k],
      alts: [F[k - 1], F[k + 1], F[k] + 1, F[k - 1] + F[k - 2] + 1],
      exp:
        `Each value is the sum of the previous two\n` +
        F.slice(0, k + 1)
          .map((v, i) => `fun(${i}) = ${v}`)
          .join(' → ') +
        `\n= fun(${k}) = ${F[k]}\nTip: build the table bottom-up from fun(0) and fun(1) instead of expanding the whole call tree.`,
    };
  }
  if (t === 'pop') {
    const k = R(37, 250),
      pc = (v) => (v ? (v & 1) + pc(v >> 1) : 0),
      out = pc(k),
      bits = bin(k);
    return {
      lines: [
        'fun(n):',
        '  if (n == 0) return 0',
        '  return (n & 1) + fun(n >> 1)',
        `Set k = ${k}`,
        'Print fun(k)',
      ],
      out,
      alts: [out + 1, out - 1, bits.length, pc(k >> 1)],
      exp: `k = ${k} = ${bits}\nEach call adds the lowest bit (n & 1), then shifts right\n${bits.split('').reverse().join(' + ')} = ${out}\n= ${out} one-bits\nTip: this just counts the 1-bits — write k in binary and count them.`,
    };
  }
  const a = R(4, 7),
    b = R(1, 15),
    f = (a2, b2) => (a2 ? f(a2 - 1, b2 ^ a2) : b2),
    out = f(a, b),
    tr = [];
  let v = b;
  for (let i = a; i > 0; i--) {
    v ^= i;
    tr.push(`XOR ${i} → ${bin(v)} (${v})`);
  }
  return {
    lines: [
      'fun(a, b):',
      '  if (a == 0) return b',
      '  return fun(a - 1, b ^ a)',
      `Set x = ${a}, y = ${b}`,
      'Print fun(x, y)',
    ],
    out,
    alts: [f(a - 1, b), f(a + 1, b), out + 1, b + (a * (a + 1)) / 2],
    exp:
      `Start b = ${b} (${bin(b)})\n` +
      tr.join('\n') +
      `\n= Result ${out}\nTip: this recursion is just a loop — XOR in a, a−1, … 1 one at a time, in binary.`,
  };
}
const hl = (l) =>
  l.split(/(\b(?:Set|Print|for|to|if|return|fun)\b|\d+|[&|^+\-*<=>%]+)/).map((t, i) =>
    h(
      'span',
      {
        key: i,
        className: /^(Set|Print|for|to|if|return|fun)$/.test(t)
          ? 'text-fuchsia-400'
          : /^\d+$/.test(t)
            ? 'text-amber-300'
            : /^[&|^+\-*<=>%]+$/.test(t)
              ? 'text-sky-300'
              : '',
      },
      t,
    ),
  );
function Bitwise({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const g = bwGen(d);
    return { ...g, opts: mcq(g.out, g.alts) };
  }, []);
  const [pick, setPick] = useState(null),
    fin = useRef(false),
    clock = useClock(45000, () => finish(null));
  function finish(o) {
    if (fin.current) return;
    fin.current = true;
    setPick(o === null ? 'x' : o);
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: o === P.out,
          timeMs: clock.el(),
          moveEfficiency: 1,
          explain: P.exp,
        }),
      900,
    );
  }
  return h(
    'div',
    { className: 'flex flex-col h-full gap-3' },
    h(Bar, { f: clock.f }),
    h('div', { className: 'text-center text-sm text-slate-400' }, 'What is printed?'),
    h(
      'pre',
      {
        className:
          'flex-1 min-h-0 overflow-auto bg-slate-900 rounded-xl p-3 font-mono text-sm leading-7 whitespace-pre',
      },
      P.lines.map((l, i) => h('div', { key: i }, hl(l))),
    ),
    h(
      'div',
      { className: 'grid grid-cols-2 gap-2 shrink-0' },
      P.opts.map((o) =>
        h(
          'button',
          {
            key: o,
            onClick: () => !fin.current && finish(o),
            className:
              'py-4 rounded-xl font-mono text-xl ' +
              (pick === null
                ? 'bg-slate-800 active:bg-slate-700'
                : o === P.out
                  ? 'bg-emerald-600'
                  : pick === o
                    ? 'bg-red-600'
                    : 'bg-slate-800 opacity-50'),
          },
          o,
        ),
      ),
    ),
  );
}

/* ---------- Game 9: Path Maker ---------- */
const PD = [
    [-1, 0, 1, 4],
    [0, 1, 2, 8],
    [1, 0, 4, 1],
    [0, -1, 8, 2],
  ],
  rotM = (m) => ((m << 1) & 15) | (m >> 3);
const bitTo = (u, v, n) =>
  PD.find((q) => q[0] === ((v / n) | 0) - ((u / n) | 0) && q[1] === (v % n) - (u % n))[2];
/**
 * Pipe connectivity check for Path Maker. `t` holds one 4-bit mask per tile (N=1, E=2, S=4, W=8).
 * BFS from the start tile (which must open to the west edge); two neighbours connect only when both
 * tiles open towards each other. Solved when the goal tile is reached and opens to the east edge.
 * O(n^2) per call (it runs after every tap).
 */
function pmConn(t, n) {
  const seen = new Set();
  if (!(t[0] & 8)) return { ok: false, seen };
  const q = [0];
  seen.add(0);
  for (let i = 0; i < q.length; i++) {
    const u = q[i],
      r = (u / n) | 0,
      c = u % n;
    PD.forEach(([a, b, bit, op]) => {
      if (!(t[u] & bit)) return;
      const y = r + a,
        x = c + b,
        v = y * n + x;
      if (y < 0 || y >= n || x < 0 || x >= n || seen.has(v) || !(t[v] & op)) return;
      seen.add(v);
      q.push(v);
    });
  }
  return { ok: seen.has(n * n - 1) && !!(t[n * n - 1] & 2), seen };
}
/**
 * Carves a random self-avoiding path from the top-left to the bottom-right cell with a randomised
 * depth-first search. Bounded on purpose: at most 4000 DFS steps per attempt and 400 attempts,
 * after which a deterministic L-shaped path is returned, so the main thread can never hang.
 * @param {number} n grid side length
 * @returns {number[]} ordered cell indices (row * n + col)
 */
function carve(n) {
  for (let tries = 0; tries < 400; tries++) {
    const path = [0],
      used = new Set([0]);
    let ok = false,
      steps = 0;
    const dfs = (u) => {
      if (u === n * n - 1) {
        ok = true;
        return;
      }
      if (++steps > 4000) return;
      const r = (u / n) | 0,
        c = u % n;
      for (const [a, b] of shuf(PD)) {
        const y = r + a,
          x = c + b,
          v = y * n + x;
        if (y < 0 || y >= n || x < 0 || x >= n || used.has(v)) continue;
        used.add(v);
        path.push(v);
        dfs(v);
        if (ok) return;
        path.pop();
        used.delete(v);
      }
    };
    dfs(0);
    if (ok && path.length >= 2 * n) return path;
  }
  return [...Array(n).keys(), ...Array.from({ length: n - 1 }, (_, i) => (i + 2) * n - 1)];
}
const Tile = ({ m, on }) =>
  h(
    'svg',
    { viewBox: '0 0 24 24', className: 'w-full h-full' },
    PD.map(([a, b, bit]) =>
      m & bit
        ? h('line', {
            key: bit,
            x1: 12,
            y1: 12,
            x2: 12 + b * 12,
            y2: 12 + a * 12,
            stroke: on ? '#34d399' : '#94a3b8',
            strokeWidth: 5,
            strokeLinecap: 'round',
          })
        : null,
    ),
    h('circle', { cx: 12, cy: 12, r: 3.5, fill: on ? '#34d399' : '#94a3b8' }),
  );
function PathMaker({ difficulty: d, onRoundComplete }) {
  const n = d <= 5 ? 4 : 5;
  const P = useMemo(() => {
    const path = carve(n),
      T = Array.from({ length: n * n }, () => pk([5, 10, 6, 12, 3, 9, 7, 15]));
    path.forEach((u, k) => {
      T[u] =
        (k ? bitTo(u, path[k - 1], n) : 8) | (k < path.length - 1 ? bitTo(u, path[k + 1], n) : 2);
    });
    let S;
    for (let g = 0; g < 50; g++) {
      S = T.map((m) => {
        let x = m;
        for (let i = R(0, 3); i > 0; i--) x = rotM(x);
        return x;
      });
      if (!pmConn(S, n).ok) break;
    }
    for (let q = 0; q < 4 && pmConn(S, n).ok; q++) S[0] = rotM(S[0]);
    let opt = 0;
    path.forEach((u) => {
      let x = S[u],
        k = 0;
      while (x !== T[u] && k < 4) {
        x = rotM(x);
        k++;
      }
      opt += k;
    });
    return { path, S, opt: Math.max(1, opt) };
  }, []);
  const [t, setT] = useState(P.S),
    taps = useRef(0),
    fin = useRef(false),
    clock = useClock(45000, () => finish(false));
  function finish(ok) {
    if (fin.current) return;
    fin.current = true;
    const explain = `Route → ${P.path.length} tiles\nRotations needed → about ${P.opt}\n= You used ${taps.current} taps\nTip: start at S and rotate each tile only until it links to the next; straights have just 2 orientations, corners 4.`;
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: ok,
          timeMs: clock.el(),
          moveEfficiency: cl(P.opt / Math.max(taps.current, 1), 0, 1),
          explain,
        }),
      ok ? 500 : 900,
    );
  }
  const tap = (u) => {
    if (fin.current) return;
    taps.current++;
    const nt = [...t];
    nt[u] = rotM(nt[u]);
    setT(nt);
    if (pmConn(nt, n).ok) finish(true);
  };
  const cn = pmConn(t, n);
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      'Tap tiles to rotate · connect S → G · taps ' + taps.current,
    ),
    h(
      'div',
      { className: 'flex-1 flex items-center' },
      h(
        'div',
        {
          className: 'grid gap-1.5 w-full max-w-[420px] mx-auto',
          style: { gridTemplateColumns: `repeat(${n},1fr)` },
        },
        t.map((m, u) =>
          h(
            'button',
            {
              key: u,
              onClick: () => tap(u),
              className: 'aspect-square rounded-lg bg-slate-800 relative active:bg-slate-700',
            },
            h(Tile, { m, on: cn.seen.has(u) }),
            u === 0 &&
              h('span', { className: 'absolute top-0.5 left-1 text-[10px] text-amber-300' }, 'S ▶'),
            u === n * n - 1 &&
              h(
                'span',
                { className: 'absolute bottom-0.5 right-1 text-[10px] text-amber-300' },
                '▶ G',
              ),
          ),
        ),
      ),
    ),
  );
}

/* ---------- Game 10: Motion Challenge (BFS-verified) ---------- */
const cellsOf = (b, r, c) => (b.h ? [r * 5 + c, r * 5 + c + 1] : [r * 5 + c, (r + 1) * 5 + c]);
function occ(st, B, rocks, skip) {
  const o = Array(25).fill(0);
  rocks.forEach((i) => (o[i] = 1));
  if (skip !== -1) o[st[0] * 5 + st[1]] = 1;
  B.forEach((b, k) => {
    if (k !== skip) cellsOf(b, st[2 + 2 * k], st[3 + 2 * k]).forEach((i) => (o[i] = 1));
  });
  return o;
}
function step(st, B, rocks, hole, k, a, b) {
  if (k < 0) {
    const y = st[0] + a,
      x = st[1] + b;
    if (y < 0 || y > 4 || x < 0 || x > 4 || occ(st, B, rocks, -1)[y * 5 + x]) return null;
    const n = [...st];
    n[0] = y;
    n[1] = x;
    return n;
  }
  const bar = B[k];
  if (bar.h ? a : b) return null;
  const r = st[2 + 2 * k] + a,
    c = st[3 + 2 * k] + b;
  if (r < 0 || c < 0 || r > (bar.h ? 4 : 3) || c > (bar.h ? 3 : 4)) return null;
  const o = occ(st, B, rocks, k);
  if (cellsOf(bar, r, c).some((i) => o[i] || i === hole)) return null;
  const n = [...st];
  n[2 + 2 * k] = r;
  n[3 + 2 * k] = c;
  return n;
}
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/**
 * Solves a Motion Challenge board by BFS over the joint state space.
 * A state is a flat array [ballRow, ballCol, bar0Row, bar0Col, ...]; its string form is the
 * visited key. Each expansion tries the 4 directions for the ball and for every bar (illegal moves
 * are rejected by step()).
 * Complexity: O(S x (1 + B) x 4 x 25) with S <= 8000 states (hard cap) and B <= 5 bars.
 * @returns {number} minimum number of single-cell moves that put the ball in the hole, or -1.
 */
function mvBfs(st0, B, rocks, hole) {
  const seen = new Map([[st0.join(), 0]]),
    q = [st0];
  for (let i = 0; i < q.length && i < 8000; i++) {
    const s0 = q[i],
      dd = seen.get(s0.join());
    if (s0[0] * 5 + s0[1] === hole) return dd;
    for (let k = -1; k < B.length; k++)
      for (const [a, b] of DIRS) {
        const n = step(s0, B, rocks, hole, k, a, b);
        if (n) {
          const key = n.join();
          if (!seen.has(key)) {
            seen.set(key, dd + 1);
            q.push(n);
          }
        }
      }
  }
  return -1;
}
function mvGen(d) {
  let best = null;
  const nb = d <= 3 ? 3 : d <= 7 ? 4 : 5,
    need = 2 + Math.round(d * 1.1);
  for (let t = 0; t < 40; t++) {
    const used = new Set(),
      free = () => {
        const a = [...Array(25).keys()].filter((q) => !used.has(q)),
          c = a[R(0, a.length - 1)];
        used.add(c);
        return c;
      };
    const hole = free(),
      rocks = Array.from({ length: R(1, 2) }, free),
      bc = free(),
      B = [],
      st = [(bc / 5) | 0, bc % 5];
    for (let i = 0, g = 0; i < nb && g < 80; g++) {
      const hz = Math.random() < 0.5,
        r = R(0, hz ? 4 : 3),
        c = R(0, hz ? 3 : 4),
        cs = cellsOf({ h: hz }, r, c);
      if (cs.every((x) => !used.has(x))) {
        cs.forEach((x) => used.add(x));
        B.push({ h: hz });
        st.push(r, c);
        i++;
      }
    }
    const o = mvBfs(st, B, rocks, hole);
    if (o >= 0 && (!best || o > best.opt)) best = { B, st, rocks, hole, opt: o };
    if (best && best.opt >= need) break;
  }
  return best || { B: [], st: [0, 0], rocks: [12], hole: 1, opt: 1 };
}
function Motion({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => mvGen(d), []);
  const [st, setSt] = useState(P.st),
    [sel, setSel] = useState(-1),
    mv = useRef(0),
    fin = useRef(false),
    clock = useClock(60000, () => finish(false));
  function finish(ok) {
    if (fin.current) return;
    fin.current = true;
    const explain = `Optimal → ${P.opt} single-cell moves (BFS-verified)\nPlan → free the lane to 🕳️ first, then roll\n= You used ${mv.current} moves\nTip: work backwards from the hole — find the bar blocking its lane, slide it away first, then roll the ball down the cleared row/column.`;
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: ok,
          timeMs: clock.el(),
          moveEfficiency: cl(P.opt / Math.max(mv.current, 1), 0, 1),
          explain,
        }),
      ok ? 500 : 900,
    );
  }
  const go = (a, b) => {
    if (fin.current) return;
    const n = step(st, P.B, P.rocks, P.hole, sel, a, b);
    if (!n) return;
    mv.current++;
    setSt(n);
    if (n[0] * 5 + n[1] === P.hole) finish(true);
  };
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      'Roll 🔴 into 🕳️ — tap a piece, then use the arrows · moves ' + mv.current,
    ),
    h(
      'div',
      { className: 'flex-1 flex items-center' },
      h(
        'div',
        {
          className: 'relative w-full max-w-[420px] aspect-square mx-auto rounded-xl bg-slate-900',
        },
        Array.from({ length: 25 }, (_, i) =>
          h(
            'div',
            {
              key: i,
              className:
                'absolute border border-slate-800 flex items-center justify-center text-xl',
              style: {
                left: (i % 5) * 20 + '%',
                top: ((i / 5) | 0) * 20 + '%',
                width: '20%',
                height: '20%',
                background: P.rocks.includes(i) ? '#000' : undefined,
              },
            },
            i === P.hole ? '🕳️' : '',
          ),
        ),
        P.B.map((b, k) =>
          h(
            'button',
            {
              key: k,
              onClick: () => setSel(k),
              className:
                'absolute rounded-lg border-2 border-slate-950 text-xs text-white/70 ' +
                (b.h ? 'bg-sky-600' : 'bg-violet-600') +
                (sel === k ? ' ring-2 ring-amber-300' : ''),
              style: {
                left: st[3 + 2 * k] * 20 + '%',
                top: st[2 + 2 * k] * 20 + '%',
                width: (b.h ? 40 : 20) + '%',
                height: (b.h ? 20 : 40) + '%',
                transition: 'all .12s',
              },
            },
            b.h ? '◀ ▶' : '▲▼',
          ),
        ),
        h(
          'button',
          {
            onClick: () => setSel(-1),
            className:
              'absolute text-2xl rounded-full ' + (sel === -1 ? 'ring-2 ring-amber-300' : ''),
            style: {
              left: st[1] * 20 + '%',
              top: st[0] * 20 + '%',
              width: '20%',
              height: '20%',
              transition: 'all .12s',
            },
          },
          '🔴',
        ),
      ),
    ),
    h(
      'div',
      { className: 'grid grid-cols-4 gap-2 shrink-0' },
      [
        ['◀', 0, -1],
        ['▲', -1, 0],
        ['▼', 1, 0],
        ['▶', 0, 1],
      ].map(([l, a, b]) =>
        h(
          'button',
          {
            key: l,
            onClick: () => go(a, b),
            className: 'py-3 rounded-xl bg-slate-800 active:bg-slate-700 text-xl',
          },
          l,
        ),
      ),
    ),
  );
}

/* ---------- Rapid-fire series (shared by Tally Up & Scales e3+) ---------- */
function Rapid({ N, lim, gen, view, opts, good, explain, onRoundComplete }) {
  const items = useMemo(() => Array.from({ length: N }, () => gen()), []),
    [i, setI] = useState(0),
    a = useRef({ c: 0, ms: 0 }),
    fin = useRef(false);
  const ans = (v, ms) => {
    if (fin.current) return;
    if (good(items[i]) === v) a.current.c++;
    a.current.ms += ms;
    if (i + 1 === N) {
      fin.current = true;
      const c = a.current.c;
      onRoundComplete({
        isCorrect: c >= N - 1,
        timeMs: a.current.ms,
        moveEfficiency: c / N,
        explain: explain(items, c),
      });
    } else setI(i + 1);
  };
  return h(RapidItem, { key: i, item: items[i], lim, view, opts, onAns: ans, idx: i, N });
}
function RapidItem({ item, lim, view, opts, onAns, idx, N }) {
  const clock = useClock(lim, () => pick(null)),
    [sel, setSel] = useState(false),
    lk = useRef(false);
  function pick(v) {
    if (lk.current) return;
    lk.current = true;
    setSel(true);
    const ms = clock.el();
    setTimeout(() => onAns(v, ms), 220);
  }
  return h(
    'div',
    { className: 'flex flex-col h-full gap-3' },
    h(Bar, { f: clock.f }),
    h('div', { className: 'text-center text-sm text-slate-400' }, `${idx + 1} / ${N}`),
    h('div', { className: 'flex-1 min-h-0' }, view(item)),
    h(
      'div',
      {
        className: 'grid gap-2 shrink-0',
        style: { gridTemplateColumns: `repeat(${opts.length},1fr)` },
      },
      opts.map(([l, v]) =>
        h(
          'button',
          {
            key: l,
            onClick: () => pick(v),
            className:
              'py-4 rounded-xl font-bold ' +
              (sel ? 'bg-slate-800 opacity-60' : 'bg-slate-800 active:bg-slate-700'),
          },
          l,
        ),
      ),
    ),
  );
}

/* ---------- Game 11: Tally Up ---------- */
const split = (T, k) => {
  const p = [];
  let rest = T;
  for (let i = 0; i < k - 1; i++) {
    const left = k - 1 - i,
      lo = Math.max(1, rest - 12 * left),
      hi = Math.min(12, rest - left);
    if (lo > hi) return null;
    const v = R(lo, hi);
    p.push(v);
    rest -= v;
  }
  if (rest < 1 || rest > 12) return null;
  p.push(rest);
  return shuf(p);
};
function tallyItem(d) {
  const rel = pk([-1, 0, 1]),
    dl = d <= 3 ? R(3, 5) : d <= 7 ? R(2, 3) : R(1, 2),
    L = Array.from({ length: R(2, 3) }, () => R(1, 9)),
    S = L.reduce((x, y) => x + y, 0);
  let Rr = null;
  for (let g = 0; g < 80 && !Rr; g++) Rr = split(S - rel * dl, R(2, 3));
  if (!Rr) Rr = [Math.max(1, S - rel * dl)];
  const tk = (v) => {
    if (d >= 7 && Math.random() < 0.4) {
      const ds = [2, 3, 4].filter((a) => v % a === 0 && v / a >= 2);
      if (ds.length) {
        const a = pk(ds);
        return { t: a + '×' + v / a, v };
      }
    }
    return { t: '' + v, v };
  };
  return { L: L.map(tk), R: Rr.map(tk), rel: Math.sign(S - Rr.reduce((x, y) => x + y, 0)) };
}
const tsum = (a) => a.reduce((x, y) => x + y.v, 0);
function Tally({ difficulty: d, onRoundComplete }) {
  return h(Rapid, {
    N: 5,
    lim: 5000,
    gen: () => tallyItem(d),
    opts: [
      ['LEFT >', 'L'],
      ['= EQUAL', 'E'],
      ['< RIGHT', 'R'],
    ],
    good: (it) => (it.rel > 0 ? 'L' : it.rel === 0 ? 'E' : 'R'),
    view: (it) =>
      h(
        'div',
        { className: 'flex gap-3 h-full' },
        [it.L, it.R].map((side, j) =>
          h(
            'div',
            {
              key: j,
              className:
                'flex-1 rounded-2xl bg-slate-900 flex flex-wrap items-center justify-center content-center gap-2 p-2',
            },
            side.map((x, i) =>
              h(
                'div',
                {
                  key: i,
                  className:
                    'min-w-[3rem] h-12 px-2 rounded-full bg-sky-600 flex items-center justify-center font-bold text-xl',
                },
                x.t,
              ),
            ),
          ),
        ),
      ),
    explain: (its, c) =>
      its
        .map(
          (it) =>
            `${tsum(it.L)} vs ${tsum(it.R)} → ${it.rel > 0 ? 'LEFT >' : it.rel < 0 ? '< RIGHT' : '= EQUAL'}`,
        )
        .join('\n') +
      `\n= You got ${c}/5\nTip: add each side into one total, then compare — never compare token by token.`,
    onRoundComplete,
  });
}

/* ---------- Game 12: Numbubbles ---------- */
function NumBubbles({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    const n = d <= 3 ? 8 : d <= 7 ? 9 : 10,
      k = R(2, d >= 6 ? 4 : 3),
      T = R(8, 28) + (d >= 8 ? R(0, 14) : 0),
      vals = Array(k).fill(T);
    for (let g = 0; g < 300 && vals.length < n; g++) {
      const v = T + pk([-3, -2, -1, 1, 2, 3, d >= 6 ? 10 : 2, d >= 6 ? -10 : -1]);
      if (v > 2 && v !== T) vals.push(v);
    }
    const cells = shuf([...Array(12).keys()]).slice(0, n);
    return {
      T,
      k,
      time: d <= 3 ? 16 : d <= 7 ? 14 : 12,
      items: shuf(vals).map((v, i) => ({
        id: i,
        v,
        text: expr(v, d),
        left: (cells[i] % 3) * 33 + R(0, 5),
        top: ((cells[i] / 3) | 0) * 25 + R(0, 4),
        dur: R(20, 40) / 10,
      })),
    };
  }, []);
  const [found, setFound] = useState([]),
    [bad, setBad] = useState(null),
    fin = useRef(false),
    clock = useClock(P.time * 1000, () => finish(false, 0));
  function finish(ok, delay) {
    if (fin.current) return;
    fin.current = true;
    const timeMs = clock.el();
    const explain =
      `Target → ${P.T}\n` +
      P.items
        .filter((x) => x.v === P.T)
        .map((x) => `${x.text} = ${x.v} ✓`)
        .join('\n') +
      `\n= All matching bubbles tapped, none wrong\nTip: evaluate each bubble once and watch the near-misses (±1, ±2) — they are the traps.`;
    setTimeout(() => onRoundComplete({ isCorrect: ok, timeMs, moveEfficiency: 1, explain }), delay);
  }
  const tap = (it) => {
    if (fin.current || found.includes(it.id)) return;
    if (it.v === P.T) {
      const nf = [...found, it.id];
      setFound(nf);
      if (nf.length === P.k) finish(true, 250);
    } else {
      setBad(it.id);
      finish(false, 600);
    }
  };
  return h(
    'div',
    { className: 'flex flex-col h-full gap-2' },
    h(Bar, { f: clock.f }),
    h('div', { className: 'text-center text-2xl font-bold text-amber-300' }, 'TARGET: ' + P.T),
    h(
      'div',
      { className: 'text-center text-xs text-slate-400' },
      'Tap EVERY bubble that equals the target — no wrong taps',
    ),
    h(
      'div',
      { className: 'relative flex-1 min-h-0' },
      P.items.map((it) =>
        h(
          'button',
          {
            key: it.id,
            onClick: () => tap(it),
            className:
              'absolute rounded-full aspect-square flex items-center justify-center font-bold text-lg text-white shadow-lg ' +
              (found.includes(it.id)
                ? 'bg-emerald-600/50'
                : bad === it.id
                  ? 'bg-red-500'
                  : 'bg-sky-600'),
            style: {
              left: it.left + '%',
              top: it.top + '%',
              width: '27%',
              animation: d >= 6 ? `fl ${it.dur}s ease-in-out infinite alternate` : undefined,
            },
          },
          it.text,
        ),
      ),
    ),
  );
}

/* ---------- Game 13: Resemble (mental rotation) ---------- */
const rotG = (g, t) => {
  const o = Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] =
        t === 'cw'
          ? g[(2 - c) * 3 + r]
          : t === 'ccw'
            ? g[c * 3 + (2 - r)]
            : t === '180'
              ? g[(2 - r) * 3 + (2 - c)]
              : t === 'flip'
                ? g[r * 3 + (2 - c)]
                : g[r * 3 + c];
  return o;
};
const Pat = ({ g, s }) =>
  h(
    'div',
    { className: 'grid grid-cols-3 gap-1 p-1.5 bg-slate-900 rounded-lg', style: { width: s } },
    g.map((v, i) =>
      h('div', {
        key: i,
        className: 'aspect-square rounded ' + ['bg-slate-800', 'bg-sky-400', 'bg-amber-400'][v],
      }),
    ),
  );
function Resemble({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    let g, combos;
    for (let t = 0; t < 300; t++) {
      g = Array.from({ length: 9 }, () => R(0, 2));
      const ks = new Set();
      combos = [];
      let ok = g.filter((v) => v).length >= 4;
      for (const rot of ['0', 'cw', 'ccw', '180'])
        for (const f of [0, 1]) {
          const x = rotG(g, rot),
            y = f ? rotG(x, 'flip') : x,
            k = y.join('');
          if (ks.has(k)) ok = false;
          ks.add(k);
          combos.push({ rot, f, g: y });
        }
      if (ok) break;
    }
    const flipOn = d >= 7 && Math.random() < 0.5,
      rot = pk(['cw', 'ccw', '180']),
      ans = combos.find((c) => c.rot === rot && c.f === (flipOn ? 1 : 0)),
      pool = combos.filter((c) => c !== ans && (d >= 7 || !c.f));
    return { g, ans, rot, flipOn, opts: shuf([ans, ...shuf(pool).slice(0, 3)]) };
  }, []);
  const [pick, setPick] = useState(null),
    fin = useRef(false),
    clock = useClock(25000, () => finish(-1));
  const txt =
    { cw: '90° CW', ccw: '90° CCW', 180: '180°' }[P.rot] +
    (P.flipOn ? ' then flip horizontally' : '');
  function finish(i) {
    if (fin.current) return;
    fin.current = true;
    setPick(i);
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: i >= 0 && P.opts[i] === P.ans,
          timeMs: clock.el(),
          moveEfficiency: 1,
          explain: `Prompt → Rotate ${txt}\nLandmark → under 90° CW the top-left goes to top-right, cell (r,c) → (c, 2−r)\n= Match the transformed pattern\nTip: track one landmark cell through the turn and discard options that are only mirrored or unrotated.`,
        }),
      900,
    );
  }
  return h(
    'div',
    { className: 'flex flex-col h-full gap-3' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'flex items-center justify-center gap-4' },
      h(Pat, { g: P.g, s: 110 }),
      h('div', { className: 'text-amber-300 font-bold text-center' }, 'Rotate', h('br'), txt),
    ),
    h(
      'div',
      { className: 'text-center text-xs text-slate-400' },
      'Which option matches the result?',
    ),
    h(
      'div',
      { className: 'grid grid-cols-2 gap-3 flex-1 content-center' },
      P.opts.map((o, i) =>
        h(
          'button',
          {
            key: i,
            onClick: () => finish(i),
            className:
              'flex justify-center p-1 rounded-xl ' +
              (pick === null
                ? 'active:bg-slate-800'
                : o === P.ans
                  ? 'bg-emerald-600/60'
                  : pick === i
                    ? 'bg-red-600/60'
                    : 'opacity-50'),
          },
          h(Pat, { g: o.g, s: 104 }),
        ),
      ),
    ),
  );
}

/* ---------- Game 14: Scales (ix odd tiers / e3+ even tiers) ---------- */
const RULES = [
  () => {
    const x = R(0, 3),
      c = R(1, 3);
    return {
      txt: `exactly ${c} ${NM[x]}${c > 1 ? 's' : ''}`,
      f: (m) => m.filter((v) => v === x).length === c,
    };
  },
  () => {
    const c = R(2, 4);
    return { txt: `exactly ${c} empty cells`, f: (m) => m.filter((v) => v < 0).length === c };
  },
  () => {
    const x = R(0, 3);
    return { txt: `a ${NM[x]} in the centre`, f: (m) => m[4] === x };
  },
  () => {
    const x = R(0, 3),
      y = (x + R(1, 3)) % 4;
    return {
      txt: `as many ${NM[x]}s as ${NM[y]}s (at least one)`,
      f: (m) =>
        m.some((v) => v === x) &&
        m.filter((v) => v === x).length === m.filter((v) => v === y).length,
    };
  },
];
const Mat = ({ m, s }) =>
  h(
    'div',
    { className: 'grid grid-cols-3 gap-1 p-1.5 bg-slate-900 rounded-lg' },
    m.map((v, i) =>
      h(
        'div',
        {
          key: i,
          className: 'aspect-square rounded bg-slate-800 flex items-center justify-center',
        },
        v >= 0 ? h(Sh, { i: v, s }) : null,
      ),
    ),
  );
function ScalesIx({ difficulty: d, onRoundComplete }) {
  const P = useMemo(() => {
    for (let tries = 0; tries < 400; tries++) {
      const rl = pk(RULES.slice(0, d < 5 ? 3 : 4))(),
        smp = (ok) => {
          for (let g = 0; g < 3000; g++) {
            const m = Array.from({ length: 9 }, () => R(-1, 3));
            if (rl.f(m) === ok) return m;
          }
          return null;
        };
      const A = smp(true),
        B = smp(true),
        C = smp(true),
        X = [smp(false), smp(false), smp(false)];
      if (A && B && C && X.every(Boolean))
        return { rl, A, B, opts: shuf([{ m: C, ok: 1 }, ...X.map((m) => ({ m, ok: 0 }))]) };
    }
    return {
      rl: { txt: 'a Circle in the centre', f: (m) => m[4] === 0 },
      A: [1, 2, 3, 1, 0, 2, 3, -1, 1],
      B: [2, 1, -1, 3, 0, 1, 2, 3, 1],
      opts: [
        { m: [3, 2, 1, 2, 0, 1, -1, 3, 2], ok: 1 },
        { m: [0, 1, 2, 3, 1, 2, 3, -1, 0], ok: 0 },
        { m: [1, 1, 2, 2, 2, 3, 3, 0, 1], ok: 0 },
        { m: [-1, 0, 1, 2, 3, 0, 1, 2, 3], ok: 0 },
      ],
    };
  }, []);
  const [pick, setPick] = useState(null),
    fin = useRef(false),
    clock = useClock(25000, () => finish(-1));
  function finish(i) {
    if (fin.current) return;
    fin.current = true;
    setPick(i);
    setTimeout(
      () =>
        onRoundComplete({
          isCorrect: i >= 0 && P.opts[i].ok === 1,
          timeMs: clock.el(),
          moveEfficiency: 1,
          explain: `Hidden rule → ${P.rl.txt}\n= Choose the grid that obeys it\nTip: test one property at a time across both examples (counts of a shape, the centre cell, empty cells).`,
        }),
      900,
    );
  }
  return h(
    'div',
    { className: 'flex flex-col h-full gap-3' },
    h(Bar, { f: clock.f }),
    h(
      'div',
      { className: 'text-center text-sm text-slate-400' },
      'Both grids follow one hidden rule. Which option follows it too?',
    ),
    h(
      'div',
      { className: 'flex gap-3 justify-center' },
      [P.A, P.B].map((m, i) => h('div', { key: i, className: 'w-[44%]' }, h(Mat, { m, s: 22 }))),
    ),
    h(
      'div',
      { className: 'grid grid-cols-2 gap-3 flex-1 content-center' },
      P.opts.map((o, i) =>
        h(
          'button',
          {
            key: i,
            onClick: () => finish(i),
            className:
              'p-1 rounded-xl ' +
              (pick === null
                ? 'active:bg-slate-800'
                : o.ok
                  ? 'bg-emerald-600/60'
                  : pick === i
                    ? 'bg-red-600/60'
                    : 'opacity-50'),
          },
          h(Mat, { m: o.m, s: 20 }),
        ),
      ),
    ),
  );
}
const SHP = [
    ['Triangle', '12,2 22,21 2,21', 3],
    ['Square', '3,3 21,3 21,21 3,21', 4],
    ['Diamond', '12,1 23,12 12,23 1,12', 4],
    ['Pentagon', '12,2 22,9.5 18,21 6,21 2,9.5', 5],
  ],
  COL = [
    ['Blue', '#3b82f6'],
    ['Orange', '#fb923c'],
    ['Green', '#4ade80'],
    ['Pink', '#f472b6'],
  ];
function ScalesE({ difficulty: d, onRoundComplete }) {
  const Rl = useMemo(() => {
    const ci = R(0, 3),
      sd = pk([3, 4, 5]),
      x = d >= 6;
    return {
      txt: x
        ? `Tap YES if the shape is ${COL[ci][0]} OR has ${sd} sides — but NOT both`
        : `Tap YES only if the shape is ${COL[ci][0]} AND has ${sd} sides`,
      f: (c) => (x ? (c.c === ci) !== (SHP[c.s][2] === sd) : c.c === ci && SHP[c.s][2] === sd),
    };
  }, []);
  const gen = () => {
    const want = Math.random() < 0.5;
    for (let g = 0; g < 200; g++) {
      const c = { s: R(0, 3), c: R(0, 3) };
      if (Rl.f(c) === want) return c;
    }
    return { s: 0, c: 0 };
  };
  return h(Rapid, {
    N: 6,
    lim: d <= 4 ? 4000 : 3000,
    gen,
    opts: [
      ['YES ✓', true],
      ['NO ✗', false],
    ],
    good: Rl.f,
    view: (it) =>
      h(
        'div',
        { className: 'h-full flex flex-col items-center justify-center gap-4' },
        h('div', { className: 'text-center text-amber-300 font-bold px-2' }, Rl.txt),
        h(
          'svg',
          { viewBox: '0 0 24 24', width: 140, height: 140 },
          h('polygon', { points: SHP[it.s][1], fill: COL[it.c][1] }),
        ),
      ),
    explain: (its, c) =>
      `Rule → ${Rl.txt}\n= You got ${c}/6\nTip: check colour first, then count sides (triangle 3, square & diamond 4, pentagon 5).`,
    onRoundComplete,
  });
}
const Scales = (p) => h(p.difficulty % 2 ? ScalesIx : ScalesE, p);

/* ---------- Registry: every game plugs in here ---------- */
/** `ready:false` hides a game from the arcade and from mocks. */
export const GameRegistry = [
  {
    id: 'bubble',
    name: 'Bubble Math',
    sub: 'Quick-Fire Numerosity',
    icon: '🫧',
    module: 'Numerical',
    co: 'Accenture',
    how: 'Each bubble hides a small sum. Tap them from the lowest result to the highest before the bar runs out. One wrong tap ends the round.',
    tip: "Don't solve in screen order: find the smallest and biggest first, then fill the middle. Compare close values by their last digits.",
    Component: BubbleMath,
    par: (d) => bn(d) * 1800,
    ready: true,
  },
  {
    id: 'fleeting',
    name: 'Fleeting Numbers',
    sub: 'Flash Memory Recall',
    icon: '🧠',
    module: 'Working Memory',
    co: 'Accenture, IBM',
    how: 'Numbered tiles flash on a 5×6 grid, then hide. Tap them in order 1→N (or high→low when prompted). One wrong tap ends the round.',
    tip: 'Chunk positions into a path or shape instead of memorising tiles one by one. Decoy blanks flash too — only numbered tiles matter.',
    Component: Fleeting,
    par: (d) => fnN(d) * 800,
    ready: true,
  },
  {
    id: 'switch',
    name: 'Switch Challenge',
    sub: 'Input-Output Funnel',
    icon: '🔀',
    module: 'Concentration',
    co: 'Capgemini, Cognizant, Deloitte',
    how: 'Symbols pass through a switch box. Code 3-1-4-2 means output slot 1 takes input slot 3, slot 2 takes input 1, and so on. Pick the matching code; double-layer rounds chain two switches.',
    tip: 'Anchor on one symbol: find it in the output and read the input slot it came from. Rule out options by their first digit.',
    Component: Switch,
    par: (d) => (d < 5 ? 7000 : d < 8 ? 12000 : 11000),
    ready: true,
  },
  {
    id: 'digit',
    name: 'Digit Challenge',
    sub: 'Reverse Equation',
    icon: '🔢',
    module: 'Numerical',
    co: 'Capgemini, Cognizant, Deloitte',
    how: 'Fill the blanks with digits 1–9, each used at most once, so the equation hits the target. Any valid combination counts.',
    tip: 'Factor the target first, lock the big operation, then use leftover digits to adjust. Check unit digits of products.',
    Component: Digit,
    par: () => 12000,
    ready: true,
  },
  {
    id: 'grid',
    name: 'Grid Challenge',
    sub: 'Dual-Task Spatial',
    icon: '🔲',
    module: 'Working Memory',
    co: 'Capgemini, Cognizant, Deloitte',
    how: 'Remember each highlighted dot, answer a mirror-image check between dots, then tap all dots in order. More than one missed check fails the round.',
    tip: 'Turn each dot into a path ("down 2, right 1"). For mirror checks compare the left grid\'s first column with the right grid\'s last.',
    Component: Grid,
    par: (d) => gN(d) * 2400,
    ready: true,
  },
  {
    id: 'geo',
    name: 'Geo-Sudoku',
    sub: 'Deductive Matrix',
    icon: '🔷',
    module: 'Deductive & Inductive',
    co: 'Capgemini, Cognizant, Deloitte',
    how: 'Every row and column holds each shape once. Pick the shape that belongs in the ? cell.',
    tip: 'Only the ? row and column matter: name the shapes you can see there and pick the missing one.',
    Component: Geo,
    par: (d) => (d <= 5 ? 8000 : 12000),
    ready: true,
  },
  {
    id: 'pathfinder',
    name: 'Pathfinder',
    sub: 'Route & Key Maze',
    icon: '🗝️',
    module: 'Spatial & Planning',
    co: 'Accenture, IBM',
    how: 'Walk S → key → door around the walls; the door needs the key. On even tiers from 6, walls vanish after 2.5 s and bumping one costs a move.',
    tip: 'Plan the whole route before the first tap: fewest turns, no backtracking, and swing wide of wall clusters.',
    Component: Pathfinder,
    par: () => 14000,
    ready: true,
  },
  {
    id: 'bitwise',
    name: 'Bitwise Blitz',
    sub: 'Pseudocode Output',
    icon: '💻',
    module: 'Numerical',
    co: 'Accenture',
    how: 'Trace the pseudocode and choose the printed value. Tiers progress from AND/OR/XOR to shift loops to recursion.',
    tip: 'Write values in binary under each line. << 1 doubles, >> 1 halves (floor). For recursion, list the base cases first.',
    Component: Bitwise,
    par: () => 18000,
    ready: true,
  },
  {
    id: 'pathmaker',
    name: 'Path Maker',
    sub: 'Pipe Rotation',
    icon: '🧩',
    module: 'Spatial & Planning',
    co: 'Accenture',
    how: 'Tap any tile to rotate it 90° clockwise. Build one continuous pipe from the left of the top-left tile to the right of the bottom-right tile.',
    tip: 'Work outward from Start. Straights have only 2 orientations, corners 4 — rotate each tile only as far as needed, since extra taps cost efficiency.',
    Component: PathMaker,
    par: (d) => (d <= 5 ? 10000 : 15000),
    ready: true,
  },
  {
    id: 'motion',
    name: 'Motion Challenge',
    sub: 'Sliding Block Planning',
    icon: '🔴',
    module: 'Spatial & Planning',
    co: 'Capgemini, Cognizant, Deloitte',
    how: 'Slide bars (horizontal ones left/right, vertical ones up/down) to clear a lane, then roll the red ball into the hole. Black rocks never move.',
    tip: 'Plan backwards from the hole: find the bar blocking the final lane, free it, then roll. Fewer moves = higher efficiency.',
    Component: Motion,
    par: (d) => 10000 + d * 2000,
    ready: true,
  },
  {
    id: 'tally',
    name: 'Tally Up',
    sub: 'Rapid Quantity Comparison',
    icon: '⚖️',
    module: 'Numerical',
    co: 'IBM',
    how: 'Each side shows a cluster of numbers. Decide if the LEFT total is greater, EQUAL, or the RIGHT total is greater before the 5 s shot clock ends. Five comparisons per round.',
    tip: 'Add each side to one total, then compare. Equal cases are as common as the others — never assume one side wins.',
    Component: Tally,
    par: () => 11000,
    ready: true,
  },
  {
    id: 'numbubbles',
    name: 'Numbubbles',
    sub: 'Target Bubble Pop',
    icon: '🎯',
    module: 'Numerical',
    co: 'IBM',
    how: 'A target number is shown. Tap EVERY bubble whose expression equals it, and nothing else, before time runs out.',
    tip: 'Evaluate each bubble once and ignore near-misses (±1, ±2). Know your factor pairs for the target.',
    Component: NumBubbles,
    par: () => 9000,
    ready: true,
  },
  {
    id: 'resemble',
    name: 'Resemble',
    sub: 'Mental Rotation',
    icon: '🔄',
    module: 'Spatial & Planning',
    co: 'IBM',
    how: 'Rotate the left pattern as instructed (and flip it at higher tiers), then pick the option that matches the result.',
    tip: 'Track one landmark cell through the turn: under 90° CW, top-left moves to top-right. Discard options that are merely mirrored or unrotated.',
    Component: Resemble,
    par: (d) => (d <= 3 ? 8000 : 12000),
    ready: true,
  },
  {
    id: 'scales',
    name: 'Scales e3+ / ix',
    sub: 'Rule & Concentration Blitz',
    icon: '🧮',
    module: 'Concentration',
    co: 'Capgemini, Cognizant, Deloitte',
    how: 'Odd tiers (ix): two grids share a hidden rule — pick the candidate that follows it. Even tiers (e3+): six rapid YES/NO cards under a two-part rule.',
    tip: 'Test one property at a time (counts, centre cell, blanks). For colour+shape rules, check colour first, then sides.',
    Component: Scales,
    par: () => 10000,
    ready: true,
  },
];
export const byId = (id) => GameRegistry.find((g) => g.id === id);

/* ---------- Official mock presets: [gameId, seconds] ---------- */
export const MOCKS = [
  {
    id: 'acc',
    name: 'Accenture 20-Min Cognitive Mock',
    items: [
      ['pathfinder', 360],
      ['pathmaker', 420],
      ['bubble', 420],
    ],
  },
  {
    id: 'cap',
    name: 'Capgemini / Aon Official Mock (33m)',
    items: [
      ['grid', 540],
      ['motion', 360],
      ['switch', 360],
      ['digit', 360],
      ['geo', 360],
    ],
  },
  {
    id: 'ibm',
    name: 'IBM 25-Min Cognitive Games Mock',
    items: [
      ['tally', 300],
      ['numbubbles', 300],
      ['resemble', 300],
      ['pathfinder', 300],
      ['fleeting', 300],
    ],
  },
];

/* ---------- Arcade module filter pills ---------- */
export const MODS = [
  'All',
  'Working Memory',
  'Spatial & Planning',
  'Numerical',
  'Deductive & Inductive',
  'Concentration',
];
