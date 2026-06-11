const canvas = document.getElementById('circuit-canvas');
const ctx = canvas.getContext('2d');

const GRID = 20;
const TRACE = '#232323';
const PAD = '#353535';
const PULSE = '#a855f7';
const MAX = 15;

let W, H, cols, rows, dpr;
let traces = [];
let pulses = [];
let board = null;
let last = 0, wait = 0.5;

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => (a + Math.random() * (b - a)) | 0;
const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const ekey = (a, b, c, d) =>
  c < a || (c === a && d < b) ? `${c},${d}|${a},${b}` : `${a},${b}|${c},${d}`;


function layout() {
  traces = [];
  const used = new Set();
  const want = Math.max(10, (cols * rows / 6) | 0);
  let tries = want * 10;

  while (traces.length < want && tries-- > 0) {
    let c = ri(0, cols + 1), r = ri(0, rows + 1);
    const pts = [[c, r]];
    const path = [];
    let prev = null;

    for (let s = ri(3, 6); s > 0; s--) {
      const open = dirs.filter(d => {
        const x = c + d[0], y = r + d[1];
        return x >= 0 && x <= cols && y >= 0 && y <= rows && !used.has(ekey(c, r, x, y));
      });
      if (!open.length) break;

      const d = (prev && Math.random() < 0.6 &&
        open.find(o => o[0] === prev[0] && o[1] === prev[1])) || open[ri(0, open.length)];

      path.push(ekey(c, r, c + d[0], r + d[1]));
      c += d[0]; r += d[1];
      pts.push([c, r]);
      prev = d;
    }

    if (path.length < 2) continue;
    path.forEach(e => used.add(e));

    const xy = pts.map(p => [p[0] * GRID, p[1] * GRID]);
    traces.push({ xy, len: (xy.length - 1) * GRID });
  }
}


function at(tr, d) {
  if (d <= 0) return tr.xy[0];
  const segs = tr.xy.length - 1;
  const i = Math.min((d / GRID) | 0, segs - 1);
  const t = Math.min(d / GRID - i, 1);
  const a = tr.xy[i], b = tr.xy[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function seg(tr, d1, d2) {
  d1 = Math.max(0, d1); d2 = Math.min(tr.len, d2);
  if (d2 <= d1) return;
  const p0 = at(tr, d1), p1 = at(tr, d2);
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  for (let i = Math.ceil(d1 / GRID); i * GRID < d2; i++) ctx.lineTo(tr.xy[i][0], tr.xy[i][1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.stroke();
}


function paint() {
  board = document.createElement('canvas');
  board.width = canvas.width;
  board.height = canvas.height;
  const b = board.getContext('2d');
  b.setTransform(dpr, 0, 0, dpr, 0, 0);

  b.strokeStyle = TRACE;
  b.lineWidth = 1.2;
  for (const tr of traces) {
    b.beginPath();
    b.moveTo(tr.xy[0][0], tr.xy[0][1]);
    for (let i = 1; i < tr.xy.length; i++) b.lineTo(tr.xy[i][0], tr.xy[i][1]);
    b.stroke();
  }

  b.fillStyle = PAD;
  for (const tr of traces) {
    const a = tr.xy[0], z = tr.xy[tr.xy.length - 1];
    b.fillRect(a[0] - 2, a[1] - 2, 4, 4);
    b.fillRect(z[0] - 2, z[1] - 2, 4, 4);
  }
}

function spawn(seed) {
  if (pulses.length >= MAX || !traces.length) return;
  const busy = pulses.map(p => p.t);
  let i, n = 0;
  do { i = ri(0, traces.length); } while (busy.includes(i) && ++n < 10);
  pulses.push({
    t: i,
    pos: seed ? Math.random() * traces[i].len * 0.7 : 0,
    v: rnd(22, 36),
    tail: rnd(55, 85),
  });
}

function frame(ts) {
  const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0;
  last = ts;

  ctx.clearRect(0, 0, W, H);
  if (board) ctx.drawImage(board, 0, 0, W, H);

  ctx.strokeStyle = PULSE;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = PULSE;
  ctx.shadowBlur = 8;

  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.pos += p.v * dt;
    const tr = traces[p.t];
    const head = p.pos, back = head - p.tail;

    for (let s = 0; s < 6; s++) {
      ctx.globalAlpha = (s + 1) / 6;
      seg(tr, back + (head - back) * s / 6, back + (head - back) * (s + 1) / 6);
    }
    ctx.globalAlpha = 1;

    if (head <= tr.len) {
      const h = at(tr, head);
      ctx.fillStyle = PULSE;
      ctx.beginPath();
      ctx.arc(h[0], h[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (back > tr.len) pulses.splice(i, 1);
  }
  ctx.shadowBlur = 0;

  wait -= dt;
  if (wait <= 0 && pulses.length < MAX) {
    spawn();
    wait = rnd(0.4, 1.2);
  }
  requestAnimationFrame(frame);
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = canvas.parentElement.getBoundingClientRect();
  W = r.width; H = r.height;
  cols = (W / GRID) | 0;
  rows = (H / GRID) | 0;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout();
  paint();
  pulses = [];
  for (let i = 0; i < 6; i++) spawn(true);
}

let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(resize, 150);
});

resize();
requestAnimationFrame(frame);