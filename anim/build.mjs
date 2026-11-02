// Builds the animated README header: a fake README that a bug climbs out of and wrecks,
// until zack jumps down and cleans it up. Pure SMIL, so GitHub renders it in an <img>.
//
//   node anim/build.mjs   →   anim/readme-light.svg, anim/readme-dark.svg

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('.', import.meta.url));
const W = 830, H = 300, FLOOR = 292, HR = 60, FPS = 24;

const THEMES = {
  light: { fg: '#1f2328', hr: '#d1d9e0', zack: '#1f2328', bug: '#cf222e', crack: '#8c959f', burst: '#bf8700' },
  dark: { fg: '#f0f6fc', hr: '#3d444d', zack: '#f0f6fc', bug: '#ff7b72', crack: '#9198a1', burst: '#e3b341' },
};

/* ---------- text layout (Helvetica advance widths, enforced with textLength) ---------- */
const REG = { ' ': 278, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '.': 278, ',': 278, ':': 278, ';': 278, '!': 278, '?': 556, "'": 191, '’': 222, '-': 333, '—': 1000, '·': 278, '#': 556, '@': 1015, '/': 278, '(': 333, ')': 333, '&': 667, '+': 584 };
const BOLD = { ...REG, a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, A: 722, B: 722, J: 556, K: 722, L: 611, R: 722, "'": 238, '’': 278 };
const measure = (s, size, bold) => [...s].reduce((w, ch) => w + ((bold ? BOLD : REG)[ch] ?? 556), 0) * size / 1000;

const SIZE = 16;
const LINES = [
  { y: 96, tokens: [['TODO:', 'strike'], ['write', 'strike'], ['a', 'strike'], ['README', 'strike'], ['done.']] },
  { y: 128, tokens: 'I build products, AI tools, and films made entirely in code.'.split(' ').map((t) => [t]) },
  { y: 160, tokens: [['Right'], ['now:'], ['Ruhly,', 'bold', 'ruhly'], ['one'], ['passage'], ['every'], ['fajr.'], ['Launching'], ['for'], ['Ramadan.']] },
  { y: 192, tokens: [['Also:'], ['PM-OS', 0, 'pmos'], ['·'], ['#suitup', 0, 'suitup'], ['·'], ['holidaymade'], ['·'], ['crossexam']] },
];
const words = [];
for (const line of LINES) {
  let x = 2;
  for (const [text, style, id] of line.tokens) {
    const bold = style === 'bold';
    const w = measure(text, SIZE, bold);
    words.push({ text, x, y: line.y, w, bold, strike: style === 'strike', id, cx: x + w / 2, cy: line.y - SIZE * 0.34 });
    x += w + measure(' ', SIZE);
  }
}
const byId = Object.fromEntries(words.filter((w) => w.id).map((w) => [w.id, w]));

/* ---------- tiny seeded rng so every build is identical ---------- */
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- stickman rig ---------- */
const D2R = Math.PI / 180;
const POSES = {
  stand: { lean: 0, af: [10, 8], ab: [-10, 8], lf: [7, 0], lb: [-7, 0] },
  guard: { lean: 10, af: [35, 110], ab: [10, 120], lf: [22, -12], lb: [-22, -6] },
  punch: { lean: 18, af: [95, -5], ab: [5, 125], lf: [26, -14], lb: [-28, -4] },
  upper: { lean: -8, af: [172, 0], ab: [-20, 60], lf: [15, -10], lb: [-20, -10] },
  kick: { lean: -18, af: [60, 40], ab: [-60, 60], lf: [100, -5], lb: [-6, 0] },
  jumpkick: { lean: -12, af: [120, 30], ab: [-70, 40], lf: [96, 0], lb: [-20, -95] },
  tuck: { lean: 12, af: [70, -60], ab: [-40, -50], lf: [70, -120], lb: [40, -110] },
  crouch: { lean: 30, af: [40, -50], ab: [-20, -40], lf: [75, -125], lb: [35, -110] },
  duck: { lean: 48, af: [30, 120], ab: [10, 120], lf: [80, -130], lb: [40, -115] },
  hurt: { lean: -28, af: [140, 30], ab: [-150, -20], lf: [25, -10], lb: [-15, 0] },
  fly: { lean: -60, af: [160, 20], ab: [-160, 10], lf: [40, -30], lb: [-40, -20] },
  victory: { lean: -5, af: [165, 10], ab: [-165, -10], lf: [12, 0], lb: [-12, 0] },
  point: { lean: 0, af: [100, 0], ab: [-10, 8], lf: [8, 0], lb: [-8, 0] },
  wave: (t) => ({ lean: 0, af: [160, 25 + 30 * Math.sin(t * 14)], ab: [-10, 8], lf: [7, 0], lb: [-7, 0] }),
  run: (t) => {
    const p = t * Math.PI * 2 * 2.4, s = Math.sin(p);
    return { lean: 16, af: [-45 * s, 75], ab: [45 * s, 75], lf: [38 * s, -(20 + 45 * (1 - s) / 2)], lb: [-38 * s, -(20 + 45 * (1 + s) / 2)] };
  },
};
const poseAt = (name, t) => (typeof POSES[name] === 'function' ? POSES[name](t) : POSES[name]);
const mixPose = (a, b, u) => {
  const m = (p, q) => p + (q - p) * u;
  const arr = (k) => [m(a[k][0], b[k][0]), m(a[k][1], b[k][1])];
  return { lean: m(a.lean, b.lean), af: arr('af'), ab: arr('ab'), lf: arr('lf'), lb: arr('lb') };
};

// joints in "facing space": +x is the way the figure faces, +y is down, origin at the hip
const TORSO = 17, HEAD = 7, ARM = 9, LEG = 11;
const skeleton = (p) => {
  const L = p.lean * D2R, up = (d) => [Math.sin(L) * d, -Math.cos(L) * d];
  const neck = up(TORSO), sh = up(TORSO - 2), head = up(TORSO + HEAD);
  const limb = (o, [a1, a2], len, rel) => {
    const A1 = (a1 + (rel ? p.lean : 0)) * D2R, A2 = A1 + a2 * D2R;
    const j = [o[0] + Math.sin(A1) * len, o[1] + Math.cos(A1) * len];
    return [j, [j[0] + Math.sin(A2) * len, j[1] + Math.cos(A2) * len]];
  };
  return { neck, head, sh, af: limb(sh, p.af, ARM, true), ab: limb(sh, p.ab, ARM, true), lf: limb([0, 0], p.lf, LEG), lb: limb([0, 0], p.lb, LEG), lean: L };
};
const legReach = (p, s = 1, rot = 0) => {
  const k = skeleton(p), r = rot * D2R;
  return Math.max(...[k.lf[1], k.lb[1]].map(([x, y]) => (x * Math.sin(r) + y * Math.cos(r)) * s));
};

const ease = { lin: (u) => u, io: (u) => u * u * (3 - 2 * u), out: (u) => 1 - (1 - u) ** 2, in: (u) => u * u };

// keyframes: { t, x, y?, f, pose, arc?, s?, rot?, ease? } — no y means standing on the floor
const stateAt = (kfs, t) => {
  kfs.sort((a, b) => a.t - b.t);
  let i = kfs.findIndex((k, j) => t >= k.t && (j === kfs.length - 1 || t < kfs[j + 1].t));
  if (i < 0) i = 0;
  const a = kfs[i], b = kfs[Math.min(i + 1, kfs.length - 1)];
  const u = b === a ? 0 : Math.min(1, (t - a.t) / (b.t - a.t));
  const e = ease[b.ease || 'io'](u);
  const pose = mixPose(poseAt(a.pose, t), poseAt(b.pose, t), Math.min(1, u * 3));
  const s = (a.s ?? 1) + ((b.s ?? 1) - (a.s ?? 1)) * u;
  const rot = (a.rot ?? 0) + ((b.rot ?? 0) - (a.rot ?? 0)) * u;
  const grounded = a.y == null && b.y == null;
  let y;
  if (grounded) y = FLOOR - legReach(pose, s, rot);
  else {
    const ya = a.y ?? FLOOR - legReach(poseAt(a.pose, t), s, rot);
    const yb = b.y ?? FLOOR - legReach(poseAt(b.pose, t), s, rot);
    y = ya + (yb - ya) * e - (b.arc || 0) * 4 * u * (1 - u);
  }
  return { x: a.x + (b.x - a.x) * e, y, f: a.f, pose, s, rot };
};

const r1 = (n) => Math.round(n * 10) / 10;
const drawFigure = (st, antennae) => {
  const k = skeleton(st.pose), r = st.rot * D2R;
  const P = ([x, y]) => {
    const xr = x * Math.cos(r) - y * Math.sin(r), yr = x * Math.sin(r) + y * Math.cos(r);
    return `${r1(st.x + xr * st.s * st.f)} ${r1(st.y + yr * st.s)}`;
  };
  let d = `M${P(k.neck)}L${P([0, 0])}M${P(k.sh)}L${P(k.ab[0])}L${P(k.ab[1])}M${P(k.sh)}L${P(k.af[0])}L${P(k.af[1])}` +
    `M${P([0, 0])}L${P(k.lb[0])}L${P(k.lb[1])}M${P([0, 0])}L${P(k.lf[0])}L${P(k.lf[1])}`;
  if (antennae) {
    const h = k.head, L = k.lean, rotp = ([x, y]) => [h[0] + x * Math.cos(L) - y * Math.sin(L), h[1] + x * Math.sin(L) + y * Math.cos(L)];
    d += `M${P(rotp([-2, -4]))}L${P(rotp([-5, -11]))}M${P(rotp([2, -4]))}L${P(rotp([4, -11]))}`;
  }
  const hx = k.head[0] * Math.cos(r) - k.head[1] * Math.sin(r), hy = k.head[0] * Math.sin(r) + k.head[1] * Math.cos(r);
  return { d, hx: r1(st.x + hx * st.s * st.f), hy: r1(st.y + hy * st.s), hr: r1(5.5 * st.s) };
};

/* ---------- choreography ---------- */
const HOLE = { x: 706, y: 142 };
const RUN = 420;
const bug = [], zack = [], kicks = [], bursts = [];
const zackHr = (pose = 'stand') => HR - legReach(POSES[pose]);
const kf = (arr, k) => { arr.push(k); return k.t; };

// the bug climbs out and kicks three words off the page
let t = 0;
kf(bug, { t: 0, x: HOLE.x, y: HOLE.y, f: -1, pose: 'tuck', s: 0 });
kf(bug, { t: 2.7, x: HOLE.x, y: HOLE.y, f: -1, pose: 'tuck', s: 0.15 });
kf(bug, { t: 3.5, x: 650, f: -1, pose: 'tuck', arc: 70, ease: 'lin' });
kf(bug, { t: 3.68, x: 650, f: -1, pose: 'crouch' });
t = kf(bug, { t: 3.85, x: 650, f: -1, pose: 'stand' });
// it runs to the far left first, so the words get kicked right and scatter across the floor
let bx = 650;
['pmos', 'ruhly', 'suitup'].forEach((id, i) => {
  const w = byId[id];
  const to = w.cx - 34, dir = to < bx ? -1 : 1;
  t = kf(bug, { t: t + 0.05, x: bx, f: dir, pose: 'run' });
  t = kf(bug, { t: t + Math.abs(bx - to) / RUN, x: to, f: dir, pose: 'run', ease: 'lin' });
  t = kf(bug, { t: t + 0.12, x: to, f: 1, pose: 'crouch' });
  t = kf(bug, { t: t + 0.28, x: w.cx - 20, y: w.cy + 1, f: 1, pose: 'jumpkick', ease: 'out' });
  kicks.push({ w, t, vx: 170 + i * 75 + rnd() * 30, vy: -300 - rnd() * 120, spin: 500 + rnd() * 400 });
  bursts.push({ t, x: w.cx - 8, y: w.cy });
  t = kf(bug, { t: t + 0.08, x: w.cx - 18, y: w.cy + 3, f: 1, pose: 'jumpkick', ease: 'lin' });
  t = kf(bug, { t: t + 0.3, x: w.cx - 8, f: 1, pose: 'crouch', ease: 'in' });
  t = kf(bug, { t: t + 0.12, x: w.cx - 8, f: 1, pose: 'stand' });
  bx = w.cx - 8;
});
t = kf(bug, { t: t + 0.15, x: bx, f: 1, pose: 'victory' });
t = kf(bug, { t: t + 0.5, x: bx, f: 1, pose: 'victory' });
const tankStart = t;
t = kf(bug, { t: t + 0.05, x: bx, f: 1, pose: 'run' });
const B0 = 440;
const bugArrive = kf(bug, { t: t + (B0 - bx) / RUN, x: B0, f: 1, pose: 'run', ease: 'lin' });

// zack notices, drops off the header and runs in
const Z0 = 250;
kf(zack, { t: 0, x: Z0, y: zackHr(), f: 1, pose: 'stand' });
const notice = tankStart + 0.1;
kf(zack, { t: notice, x: Z0, y: zackHr(), f: 1, pose: 'stand' });
kf(zack, { t: notice + 0.7, x: Z0, y: zackHr('crouch'), f: 1, pose: 'crouch' });
const zl = kf(zack, { t: notice + 1.3, x: 320, f: 1, pose: 'tuck', arc: 40, ease: 'lin' });
kf(zack, { t: zl + 0.15, x: 320, f: 1, pose: 'crouch' });
const F = Math.max(bugArrive, zl + 0.25) + 0.2;
kf(bug, { t: bugArrive + 0.15, x: B0, f: -1, pose: 'guard' });
kf(zack, { t: F, x: 320, f: 1, pose: 'guard' });
// the fight; every hit gets a burst
const fight = (arr, steps) => steps.forEach(([dt, x, f, pose, e]) => kf(arr, { t: F + dt, x, f, pose, ease: e }));
const ZA = 408;
fight(zack, [[0.25, ZA, 1, 'run', 'lin'], [0.32, ZA, 1, 'guard'], [0.45, ZA, 1, 'punch'], [0.62, ZA, 1, 'guard'],
  [1.0, ZA, 1, 'hurt'], [1.2, ZA - 20, 1, 'hurt'], [1.45, ZA - 20, 1, 'guard'],
  [1.72, ZA - 20, 1, 'duck'], [2.1, ZA - 20, 1, 'duck'], [2.25, ZA - 20, 1, 'guard'],
  [2.4, ZA, 1, 'punch'], [2.55, ZA, 1, 'guard'], [2.7, ZA + 22, 1, 'punch'], [2.85, ZA + 22, 1, 'guard'],
  [3.05, ZA + 26, 1, 'crouch']]);
fight(bug, [[0.32, B0, -1, 'guard'], [0.45, B0, -1, 'guard'], [0.6, B0 + 22, -1, 'hurt'], [0.85, B0 + 22, -1, 'guard'],
  [0.9, B0 + 10, -1, 'guard'], [1.02, B0 + 4, -1, 'punch'], [1.25, B0 + 4, -1, 'guard'],
  [1.5, ZA + 14, -1, 'guard'], [1.8, ZA + 18, -1, 'kick'], [2.05, ZA + 18, -1, 'guard'],
  [2.4, ZA + 18, -1, 'guard'], [2.55, ZA + 40, -1, 'hurt'], [2.7, ZA + 40, -1, 'hurt'], [2.85, ZA + 62, -1, 'hurt'],
  [3.2, ZA + 62, -1, 'hurt']]);
bursts.push({ t: F + 0.45, x: B0 - 6, y: FLOOR - 46 }, { t: F + 1.02, x: ZA + 10, y: FLOOR - 46 },
  { t: F + 2.4, x: ZA + 26, y: FLOOR - 46 }, { t: F + 2.7, x: ZA + 48, y: FLOOR - 44 }, { t: F + 3.22, x: ZA + 52, y: FLOOR - 56 });
// uppercut: the bug goes back where it came from
const U = F + 3.2;
kf(zack, { t: U, x: ZA + 30, y: FLOOR - 48, f: 1, pose: 'upper', ease: 'out' });
kf(zack, { t: U + 0.35, x: ZA + 34, f: 1, pose: 'crouch', ease: 'in' });
kf(zack, { t: U + 0.6, x: ZA + 34, f: 1, pose: 'stand' });
kf(bug, { t: U + 0.02, x: ZA + 62, f: -1, pose: 'fly' });
kf(bug, { t: U + 0.62, x: HOLE.x - 20, y: HOLE.y - 50, f: -1, pose: 'fly', rot: -400, ease: 'lin' });
kf(bug, { t: U + 0.85, x: HOLE.x, y: HOLE.y, f: -1, pose: 'tuck', rot: -720, s: 0.05, ease: 'lin' });
const gone = kf(bug, { t: U + 0.9, x: HOLE.x, y: HOLE.y, f: -1, pose: 'tuck', s: 0 });

// zack puts the words back, waves, and climbs back onto the header
const ZX = ZA + 34;
const R0 = gone + 0.6;
kf(zack, { t: R0 - 0.2, x: ZX, f: -1, pose: 'stand' });
kf(zack, { t: R0, x: ZX, f: -1, pose: 'point' });
const returns = kicks.map((k, i) => ({ ...k, rt: R0 + 0.15 + i * 0.6 }));
const R1 = R0 + 0.15 + kicks.length * 0.6 + 0.2;
kf(zack, { t: R1, x: ZX, f: -1, pose: 'point' });
kf(zack, { t: R1 + 0.2, x: ZX, f: 1, pose: 'wave' });
kf(zack, { t: R1 + 1.3, x: ZX, f: 1, pose: 'wave' });
kf(zack, { t: R1 + 1.45, x: ZX, f: -1, pose: 'run' });
const zb = kf(zack, { t: R1 + 1.45 + (ZX - Z0) / RUN, x: Z0, f: -1, pose: 'run', ease: 'lin' });
kf(zack, { t: zb + 0.12, x: Z0, f: 1, pose: 'crouch' });
const zu = kf(zack, { t: zb + 0.62, x: Z0, y: zackHr('crouch'), f: 1, pose: 'tuck', arc: 60, ease: 'lin' });
kf(zack, { t: zu + 0.15, x: Z0, y: zackHr('crouch'), f: 1, pose: 'crouch' });
const done = kf(zack, { t: zu + 0.4, x: Z0, y: zackHr(), f: 1, pose: 'stand' });

const T = Math.ceil(done + 3);
const N = T * FPS;
const frames = Array.from({ length: N + 1 }, (_, i) => i / FPS);

/* ---------- words: ballistic flight, settle, then fly home ---------- */
const flights = returns.map((k) => {
  const { w } = k;
  const out = [];
  let x = w.cx, y = w.cy, vx = k.vx, vy = k.vy, rot = 0, spin = k.spin, settled = false, rest = null;
  const hh = SIZE * 0.4, dt = 1 / 240;
  let sim = k.t, landed = { x, y, rot };
  for (const ft of frames) {
    if (ft < k.t) { out.push([0, 0, 0]); continue; }
    while (sim < Math.min(ft, k.rt)) {
      if (!settled) {
        vy += 1500 * dt; x += vx * dt; y += vy * dt; rot += spin * dt;
        const half = (Math.abs(Math.cos(rot * D2R)) * hh + Math.abs(Math.sin(rot * D2R)) * w.w / 2);
        const halfW = Math.abs(Math.cos(rot * D2R)) * w.w / 2 + Math.abs(Math.sin(rot * D2R)) * hh;
        if (x < halfW + 2) { x = halfW + 2; vx = Math.abs(vx) * 0.5; }
        if (x > W - halfW - 2) { x = W - halfW - 2; vx = -Math.abs(vx) * 0.5; }
        if (y + half > FLOOR) {
          y = FLOOR - half; vy = -vy * 0.35; vx *= 0.6; spin *= 0.5;
          if (Math.abs(vy) < 90) { settled = true; rest = Math.round(rot / 180) * 180; }
        }
      } else {
        rot += (rest - rot) * Math.min(1, dt * 14);
        const half = (Math.abs(Math.cos(rot * D2R)) * hh + Math.abs(Math.sin(rot * D2R)) * w.w / 2);
        y = FLOOR - half; vx *= 0.9; x += vx * dt;
      }
      sim += dt;
      landed = { x, y, rot };
    }
    if (ft < k.rt) { out.push([x - w.cx, y - w.cy, rot]); continue; }
    const u = Math.min(1, (ft - k.rt) / 0.6), e = ease.io(u);
    const homeRot = Math.round(landed.rot / 360) * 360;
    out.push([
      (landed.x - w.cx) * (1 - e),
      (landed.y - w.cy) * (1 - e) - 70 * 4 * u * (1 - u),
      landed.rot + (homeRot - landed.rot) * e - (u >= 1 ? homeRot : 0),
    ]);
  }
  return { w, out };
});

/* ---------- sampled tracks ---------- */
const join = (arr) => arr.join(';');
const anim = (attr, vals) => `<animate attributeName="${attr}" dur="${T}s" repeatCount="indefinite" values="${join(vals)}"/>`;
const animT = (type, vals, discrete) => `<animateTransform attributeName="transform" type="${type}" dur="${T}s" repeatCount="indefinite"${discrete ? ' calcMode="discrete"' : ''} values="${join(vals)}"/>`;
const window01 = (t0, t1, fade = 0.08) => frames.map((ft) => {
  if (ft < t0 - fade || ft > t1 + fade) return 0;
  if (ft < t0) return r1((ft - (t0 - fade)) / fade);
  if (ft > t1) return r1(1 - (ft - t1) / fade);
  return 1;
});

const zackFrames = frames.map((ft) => drawFigure(stateAt(zack, ft), false));
const bugFrames = frames.map((ft) => drawFigure(stateAt(bug, ft), true));
const bugVis = window01(2.7, gone - 0.02, 0.02);
const holeOpen = 2.0, holeClose = gone + 0.05;
const holeScale = frames.map((ft) => {
  if (ft < holeOpen || ft > holeClose + 0.45) return 0;
  if (ft < holeOpen + 0.5) { const u = (ft - holeOpen) / 0.5; return r1(Math.min(1.12, ease.out(u) * 1.12) - Math.max(0, u - 0.8) * 0.6); }
  if (ft > holeClose) return r1(1 - ease.io((ft - holeClose) / 0.45));
  return 1;
});
const shake = frames.map((ft) => {
  const hit = (ft > holeOpen && ft < holeOpen + 0.55) || bursts.some((b) => ft > b.t && ft < b.t + 0.12);
  return hit ? `${r1((rnd() - 0.5) * 3)} ${r1((rnd() - 0.5) * 2)}` : '0 0';
});
const bang = (() => {
  const st = frames.map((ft) => stateAt(zack, ft));
  return { vis: window01(notice + 0.05, notice + 0.65, 0.05), x: st.map((s) => r1(s.x)), y: st.map((s) => r1(s.y - 40)) };
})();

/* ---------- static art ---------- */
const holePoly = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2, r = 28 + rnd() * 9;
  return `${r1(Math.cos(a) * r * 1.15)},${r1(Math.sin(a) * r)}`;
}).join(' ');
const cracks = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + rnd() * 0.5;
  let r = 30, pts = [];
  while (r < 62 + rnd() * 30) {
    const j = (rnd() - 0.5) * 0.35;
    pts.push(`${r1(Math.cos(a + j) * r * 1.15)},${r1(Math.sin(a + j) * r)}`);
    r += 10 + rnd() * 12;
  }
  return pts.join(' ');
});

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const build = (name) => {
  const c = THEMES[name];
  const ff = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
  const wordEl = (w) => `<text x="${r1(w.x)}" y="${w.y}" textLength="${r1(w.w)}" lengthAdjust="spacingAndGlyphs"${w.bold ? ' font-weight="600"' : ''}>${esc(w.text)}</text>`;
  const flying = new Set(flights.map((f) => f.w));
  const strike = words.filter((w) => w.strike);
  const sx0 = strike[0].x, sx1 = strike.at(-1).x + strike.at(-1).w;

  const burstEl = (b) => {
    const rays = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      return `M${r1(b.x + Math.cos(a) * 5)} ${r1(b.y + Math.sin(a) * 5)}L${r1(b.x + Math.cos(a) * 11)} ${r1(b.y + Math.sin(a) * 11)}`;
    }).join('');
    return `<path d="${rays}" stroke="${c.burst}" stroke-width="2" stroke-linecap="round" opacity="0">${anim('opacity', window01(b.t, b.t + 0.12, 0.03))}</path>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ff}">
<title>Hi, I'm Zack. A bug climbs out of this README and kicks the words off the page until Zack jumps down, knocks it back into its hole, and puts everything back.</title>
<defs><radialGradient id="hole"><stop offset="0" stop-color="#000"/><stop offset=".7" stop-color="#0b0a1f"/><stop offset="1" stop-color="#2b2754"/></radialGradient></defs>
<g fill="${c.fg}">${animT('translate', shake)}
  <text x="2" y="44" font-size="30" font-weight="600">Hi, I’m Zack <tspan>👋</tspan></text>
  <g font-size="${SIZE}">
    ${words.filter((w) => !flying.has(w)).map(wordEl).join('\n    ')}
    <path d="M${r1(sx0)} ${96 - 5.2}H${r1(sx1)}" stroke="${c.fg}" stroke-width="1.3"/>
  </g>
</g>
<path d="M0 ${HR}H${W}" stroke="${c.hr}" stroke-width="1"/>
<g transform="translate(${HOLE.x} ${HOLE.y})"><g>${animT('scale', holeScale)}
  <g fill="none" stroke="${c.crack}" stroke-width="1.2" stroke-linejoin="round">${cracks.map((p) => `<polyline points="${p}"/>`).join('')}</g>
  <polygon points="${holePoly}" fill="url(#hole)" stroke="${c.crack}" stroke-width="1.5"/>
</g></g>
<g fill="${c.fg}" font-size="${SIZE}">
${flights.map(({ w, out }) => `<g>${animT('translate', out.map(([x, y]) => `${r1(x)} ${r1(y)}`))}<g>${animT('rotate', out.map(([, , r]) => `${r1(r)} ${r1(w.cx)} ${r1(w.cy)}`), true)}${wordEl(w)}</g></g>`).join('\n')}
</g>
${bursts.map(burstEl).join('\n')}
<g stroke="${c.bug}" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0">${anim('opacity', bugVis)}
  <path d="${bugFrames[0].d}">${anim('d', bugFrames.map((f) => f.d))}</path>
  <circle r="5.5" fill="${c.bug}" stroke="none">${anim('cx', bugFrames.map((f) => f.hx))}${anim('cy', bugFrames.map((f) => f.hy))}${anim('r', bugFrames.map((f) => f.hr))}</circle>
</g>
<g stroke="${c.zack}" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="${zackFrames[0].d}">${anim('d', zackFrames.map((f) => f.d))}</path>
  <circle r="5.5" fill="${c.zack}" stroke="none" cx="${zackFrames[0].hx}" cy="${zackFrames[0].hy}">${anim('cx', zackFrames.map((f) => f.hx))}${anim('cy', zackFrames.map((f) => f.hy))}</circle>
</g>
<text font-size="18" font-weight="700" fill="${c.bug}" text-anchor="middle" opacity="0">!${anim('opacity', bang.vis)}${anim('x', bang.x)}${anim('y', bang.y)}</text>
</svg>
`;
};

for (const name of Object.keys(THEMES)) {
  const svg = build(name);
  writeFileSync(`${OUT}readme-${name}.svg`, svg);
  console.log(`readme-${name}.svg  ${(svg.length / 1024).toFixed(0)} KB  ${T}s loop`);
}
