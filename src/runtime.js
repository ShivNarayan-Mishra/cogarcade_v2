/**
 * runtime.js — zero-dependency UI runtime.
 * A tiny virtual-DOM renderer with keyed child reconciliation and React-style hooks
 * (useState, useRef, useMemo, useCallback, useEffect, createContext, useContext) plus the shared
 * random/array helpers used by every puzzle generator (R, cl, shuf, pk).
 */

/* ---------- Micro-UI runtime: VDOM + hooks, zero dependencies ---------- */
let currentInstance = null,
  flushId = 0,
  flushScheduled = false;
const dirtyInstances = new Set(),
  pendingEffects = [],
  SVG_NS = 'http://www.w3.org/2000/svg',
  EVENT_MAP = { onClick: 'click', onChange: 'input' };
const flatten = (a) =>
  a.reduce(
    (r, x) =>
      Array.isArray(x)
        ? r.concat(flatten(x))
        : (r.push(x == null || x === false || x === true ? null : x), r),
    [],
  );
export function h(t, p, ...c) {
  p = p || {};
  return { t, p, c: flatten(c), k: p.key };
}
const depsEqual = (a, b) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
function useHook(init) {
  const f = currentInstance,
    i = f.hi++;
  if (!(i in f.hooks)) f.hooks[i] = init();
  return [f, f.hooks[i]];
}
export function useState(v) {
  const [f, s] = useHook(() => [typeof v === 'function' ? v() : v]);
  return [
    s[0],
    (x) => {
      const n = typeof x === 'function' ? x(s[0]) : x;
      if (!Object.is(n, s[0])) {
        s[0] = n;
        dirtyInstances.add(f);
        if (!flushScheduled) {
          flushScheduled = true;
          queueMicrotask(flush);
        }
      }
    },
  ];
}
export const useRef = (v) => useHook(() => ({ current: v }))[1];
export function useMemo(fn, d) {
  const s = useHook(() => ({ i: 0 }))[1];
  if (!s.i || !depsEqual(s.d, d)) {
    s.v = fn();
    s.d = d;
    s.i = 1;
  }
  return s.v;
}
export const useCallback = (fn, d) => useMemo(() => fn, d);
export function useEffect(fn, d) {
  const [f, s] = useHook(() => ({ e: 1, i: 0 }));
  if (!s.i || !depsEqual(s.d, d)) {
    s.i = 1;
    s.d = d;
    s.f = fn;
    pendingEffects.push([f, s]);
  }
}
export function createContext(d) {
  const c = { d };
  c.Provider = (p) => p.children[0];
  return c;
}
export function useContext(c) {
  for (let i = currentInstance.par; i; i = i.par)
    if (i.v && i.v.t === c.Provider) return i.v.p.value;
  return c.d;
}
function setProp(d, k, ov, v, svg) {
  if (k[0] === 'o' && k[1] === 'n') {
    const e = EVENT_MAP[k] || k.slice(2).toLowerCase();
    d.__h = d.__h || {};
    if (!d.__h[e]) d.addEventListener(e, (x) => d.__h[e] && d.__h[e](x));
    d.__h[e] = v;
    return;
  }
  if (k === 'style') {
    const st = d.style;
    if (ov) for (const x in ov) if (!v || !(x in v)) st[x] = '';
    if (v) for (const x in v) st[x] = v[x];
    return;
  }
  if (svg) {
    const a =
      k === 'className'
        ? 'class'
        : k === 'viewBox'
          ? k
          : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    v == null || v === false ? d.removeAttribute(a) : d.setAttribute(a, v);
    return;
  }
  if (k in d) d[k] = v == null ? '' : v;
  else v == null ? d.removeAttribute(k) : d.setAttribute(k, v);
}
function patchProps(d, o, n, svg) {
  for (const k in o)
    if (!(k in n) && k !== 'key' && k !== 'ref') setProp(d, k, o[k], undefined, svg);
  for (const k in n)
    if (k !== 'key' && k !== 'ref' && n[k] !== o[k]) setProp(d, k, o[k], n[k], svg);
  if ('value' in n && !svg && d.value !== String(n.value)) d.value = n.value;
  if (n.ref) n.ref.current = d;
}
function mount(v, par) {
  if (v == null) return null;
  if (typeof v !== 'object') return { v, text: 1, dom: document.createTextNode(v), par };
  const i = { v, par, ns: par && par.ns };
  if (typeof v.t === 'function') {
    i.hooks = [];
    i.hi = 0;
    i.fid = flushId;
    renderComponent(i);
    return i;
  }
  const svg = v.t === 'svg' || i.ns;
  i.ns = svg ? 1 : 0;
  i.dom = svg ? document.createElementNS(SVG_NS, v.t) : document.createElement(v.t);
  patchProps(i.dom, {}, v.p, svg);
  i.kids = v.c.map((c) => {
    const k = mount(c, i);
    if (k) i.dom.appendChild(k.dom);
    return k;
  });
  return i;
}
function renderComponent(i) {
  const pv = currentInstance;
  currentInstance = i;
  i.hi = 0;
  let o;
  try {
    o = i.v.t({ ...i.v.p, children: i.v.c });
  } finally {
    currentInstance = pv;
  }
  const od = i.dom;
  i.kid = reconcileChild(i, i.kid, o == null ? '' : o);
  i.dom = i.kid.dom;
  if (od && od !== i.dom)
    for (let a = i.par; a && a.hooks && a.dom === od; a = a.par) a.dom = i.dom;
}
const canReuse = (o, v) =>
  typeof v !== 'object' ? !!o.text : !o.text && v.t === o.v.t && v.k == o.v.k;
function update(o, v) {
  if (o.text) {
    if (o.v !== v) {
      o.v = v;
      o.dom.nodeValue = v;
    }
    return o;
  }
  const op = o.v.p;
  o.v = v;
  if (o.hooks) {
    o.fid = flushId;
    renderComponent(o);
  } else {
    patchProps(o.dom, op, v.p, o.ns);
    diffChildren(o, v.c);
  }
  return o;
}
function reconcileChild(ow, o, v) {
  if (o && canReuse(o, v)) return update(o, v);
  const n = mount(v, ow);
  if (o) {
    if (o.dom.parentNode) o.dom.parentNode.replaceChild(n.dom, o.dom);
    unmount(o);
  }
  return n;
}
/**
 * Keyed child reconciliation. Children with a key are matched by key, the rest by position;
 * unmatched old children are unmounted, then the DOM is re-ordered with a single forward pass of
 * insertBefore. O(n) per element.
 */
function diffChildren(i, nk) {
  const d = i.dom,
    old = i.kids,
    km = new Map(),
    used = new Set(),
    res = [];
  old.forEach((o) => {
    if (o && !o.text && o.v.k != null) km.set(o.v.k, o);
  });
  nk.forEach((v, x) => {
    if (v == null) {
      res.push(null);
      return;
    }
    const k = typeof v === 'object' ? v.k : null;
    let o = k != null ? km.get(k) : old[x];
    if (o && (used.has(o) || (k == null && !o.text && o.v.k != null) || !canReuse(o, v))) o = null;
    if (o) {
      used.add(o);
      res.push(update(o, v));
    } else res.push(mount(v, i));
  });
  old.forEach((o) => {
    if (o && !used.has(o)) {
      if (o.dom.parentNode === d) d.removeChild(o.dom);
      unmount(o);
    }
  });
  let r = d.firstChild;
  res.forEach((n) => {
    if (!n) return;
    if (n.dom === r) r = r.nextSibling;
    else d.insertBefore(n.dom, r);
  });
  i.kids = res;
}
function unmount(i) {
  if (!i) return;
  i.dead = 1;
  if (i.hooks)
    i.hooks.forEach((s) => {
      if (s && s.e && s.c)
        try {
          s.c();
        } catch (e) {}
    });
  unmount(i.kid);
  if (i.kids) i.kids.forEach(unmount);
}
const depthOf = (i) => (i ? 1 + depthOf(i.par) : 0);
function flush() {
  flushScheduled = false;
  flushId++;
  const l = [...dirtyInstances].sort((a, b) => depthOf(a) - depthOf(b));
  dirtyInstances.clear();
  l.forEach((i) => {
    if (!i.dead && i.fid !== flushId) renderComponent(i);
  });
  runEffects();
}
function runEffects() {
  const q = pendingEffects.splice(0);
  q.forEach(([f, s]) => {
    if (!f.dead && s.c) {
      try {
        s.c();
      } catch (e) {
        console.error(e);
      }
      s.c = null;
    }
  });
  q.forEach(([f, s]) => {
    if (!f.dead) {
      try {
        const r = s.f();
        s.c = typeof r === 'function' ? r : null;
      } catch (e) {
        console.error(e);
      }
    }
  });
}
export function createRoot(el) {
  return {
    render(v) {
      flushId++;
      const root = { dom: el },
        inst = mount(v, root);
      el.appendChild(inst.dom);
      runEffects();
    },
  };
}
export const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  cl = (x, a, b) => Math.min(b, Math.max(a, x));
export const shuf = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = R(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const pk = (a) => a[R(0, a.length - 1)];
