import { PRESETS, resolvePreset, BG_SWATCHES, PAPERS } from './presets.js';
import { preload, loadFace, loadMatte, detectFaces, matte } from './ml.js';
import { avatar, heroArt, icon, EXAMPLES, scanArt } from './illustrations.js';
import { canvasToBlob, setJpegDpi, jpegUnder, layoutSheet, jpegToPdf, download, fmtKB } from './export.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DPI = 300;
const MAX_SRC = 2000;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- state
const S = {
  src: null, srcData: null, alpha: null, faces: [], face: null, processed: null,
  presetId: 'in-35x45', customW: 35, customH: 45,
  bgOn: true, bg: '#ffffff', edge: 35,
  adj: { b: 0, c: 0, s: 0, w: 0 },
  T: { x: 0, y: 0 }, s: 1, rot: 0, fitScale: 1, fitRot: 0, guideCrownY: null,
  guides: true,
  fmt: 'jpg', pxW: null, pxH: null, kbMax: null, kbMin: null,
  paperId: '4x6', copies: 0, cut: true,
  view: { k: 1, fx: 0, fy: 0, dpr: 1 },
};
const preset = () => resolvePreset(PRESETS.find((p) => p.id === S.presetId), S.customW, S.customH);

// ---------------------------------------------------------------- illustrations & icons
$$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
$('[data-ill="hero"]').innerHTML = heroArt();
$('[data-ill="scan"]').innerHTML = scanArt();
$('[data-ill="examples"]').innerHTML = EXAMPLES.map((e) =>
  `<figure class="ex ${e.ok ? 'ok' : 'no'}"><span class="ex-badge">${icon(e.ok ? 'check' : 'x')}</span>${avatar(e.o)}<b>${e.t}</b><small>${e.s}</small></figure>`).join('');

// tabs
$$('.tab').forEach((t) => t.addEventListener('click', () => {
  $$('.tab').forEach((x) => x.classList.toggle('is-on', x === t));
  $$('.tab-panel').forEach((p) => p.classList.toggle('is-on', p.dataset.panel === t.dataset.tab));
}));
$('#check-chip').addEventListener('click', () => $('#check-card').scrollIntoView({ behavior: 'smooth', block: 'center' }));

// ---------------------------------------------------------------- ui helpers
let toastTimer;
function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function busy(title, sub = '') {
  const b = $('#busy');
  if (!title) { b.hidden = true; return; }
  b.hidden = false;
  $('#busy-title').textContent = title;
  $('#busy-sub').textContent = sub;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function go(step) {
  if (step !== 'upload' && !S.src) return;
  $$('.view').forEach((v) => v.classList.toggle('is-visible', v.id === 'step-' + step));
  const order = ['upload', 'edit', 'download'];
  const idx = order.indexOf(step);
  $$('.step').forEach((b) => {
    const i = order.indexOf(b.dataset.step);
    b.classList.toggle('is-active', i === idx);
    b.classList.toggle('is-done', i < idx);
    b.disabled = !S.src && i > 0;
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (step === 'edit') requestAnimationFrame(drawStage);
  if (step === 'download') renderDownloads();
}
$$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
$$('.step').forEach((b) => b.addEventListener('click', () => go(b.dataset.step)));

// ---------------------------------------------------------------- model status
(function initModels() {
  const el = $('#model-status');
  const set = (cls, txt) => { el.className = 'model-status ' + cls; el.querySelector('.txt').textContent = txt; };
  const start = () => {
    preload();
    Promise.all([loadFace(), loadMatte()])
      .then(() => set('ready', 'AI ready · runs fully on your device'))
      .catch(() => set('err', 'AI could not load. You can still crop manually.'));
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 300);
})();

// ---------------------------------------------------------------- input
const fileInput = $('#file-input');
const fileCapture = $('#file-capture');
$('#btn-choose').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
$('#dropzone').addEventListener('click', () => fileInput.click());
$('#dropzone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });
fileCapture.addEventListener('change', () => { if (fileCapture.files[0]) loadFile(fileCapture.files[0]); fileCapture.value = ''; });
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

async function loadFile(file) {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) { toast('Please choose an image file (JPG or PNG).'); return; }
  if (file.size > 25 * 1048576) { toast('That photo is over 25 MB. Please choose a smaller one.'); return; }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    await useImage(img, img.naturalWidth, img.naturalHeight);
  } catch (e) {
    console.error(e);
    toast(/heic|heif/i.test(file.type + file.name)
      ? 'HEIC photos are not supported in this browser. On iPhone: Settings → Camera → Formats → Most Compatible, or share the photo as JPG.'
      : 'Could not open this image. Try a JPG or PNG.', 6000);
  } finally { URL.revokeObjectURL(url); }
}

async function useImage(source, w, h) {
  const r = Math.min(1, MAX_SRC / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * r); c.height = Math.round(h * r);
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(source, 0, 0, c.width, c.height);
  await analyse(c);
}

// ---------------------------------------------------------------- analysis
async function analyse(canvas) {
  S.src = canvas;
  S.srcData = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  S.faces = []; S.face = null; S.alpha = null; S.bgMap = null;
  S.adj = { b: 0, c: 0, s: 0, w: 0 }; syncAdjSliders();

  const status = $('#model-status');
  const firstTime = !status.classList.contains('ready');
  busy('Finding your face…', firstTime ? 'First time only: loading the AI on your device (about 15 MB).' : '');
  await nextFrame();
  try {
    S.faces = await detectFaces(canvas);
  } catch (e) { console.error(e); toast('Face detection could not run. You can position the photo manually.', 5000); }

  busy('Removing background…', firstTime ? 'Almost there. Next time this is instant.' : 'Takes a couple of seconds.');
  await nextFrame();
  try {
    S.alpha = await matte(canvas);
  } catch (e) { console.error(e); toast('Background removal could not run on this device.', 5000); }

  busy('Lining up your photo…');
  await nextFrame();
  S.bgMap = S.alpha ? buildBgMap() : null;
  S.face = measureFace();
  recomposite();
  autoFit();
  busy(null);
  if (!S.faces.length) toast('No face found. Drag and zoom to position it yourself.', 5000);
  $$('.step').forEach((b) => (b.disabled = false));
  go('edit');
}

function measureFace() {
  if (!S.faces.length) return null;
  const W = S.src.width, H = S.src.height;
  // Pick the largest face.
  const width = (lm) => Math.hypot(lm[454].x - lm[234].x, lm[454].y - lm[234].y);
  const lm = S.faces.slice().sort((a, b) => width(b) - width(a))[0];
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let a = mid(lm[33], lm[133]), b = mid(lm[362], lm[263]);
  if (a.x > b.x) [a, b] = [b, a];
  const roll = Math.atan2(b.y - a.y, b.x - a.x);
  const E = mid(a, b);
  const u = { x: Math.cos(roll), y: Math.sin(roll) };
  const v = { x: -Math.sin(roll), y: Math.cos(roll) };
  const proj = (p) => ({ U: (p.x - E.x) * u.x + (p.y - E.y) * u.y, V: (p.x - E.x) * v.x + (p.y - E.y) * v.y });
  const chinV = proj(lm[152]).V;
  const foreV = proj(lm[10]).V;
  const cL = proj(lm[234]).U, cR = proj(lm[454]).U;
  const faceW = Math.abs(cR - cL);
  const centerU = (cL + cR) / 2;
  const toSrc = (U, V) => ({ x: E.x + U * u.x + V * v.x, y: E.y + U * u.y + V * v.y });

  // Crown (top of hair) from the matte. Fallback: anatomical estimate.
  let crownV = foreV - 0.32 * (chinV - foreV);
  let crownFromMatte = false, cut = false;
  if (S.alpha) {
    const A = S.alpha, N = 25;
    const start = foreV - 1.4 * (chinV - foreV);
    for (let t = start; t < foreV; t += 1) {
      let hit = 0;
      for (let k = 0; k < N; k++) {
        const p = toSrc(centerU + (k / (N - 1) - 0.5) * 0.62 * faceW, t);
        const x = p.x | 0, y = p.y | 0;
        if (x >= 0 && y >= 0 && x < W && y < H && A[y * W + x] > 0.5) hit++;
      }
      if (hit / N >= 0.18) { crownV = t; crownFromMatte = true; break; }
    }
    const above = toSrc(centerU, crownV - 3);
    if (above.y < 0) cut = true;
  } else if (toSrc(centerU, crownV).y < 0) cut = true;

  // Lighting: mean luminance on both cheeks.
  const lum = (p, r) => {
    const d = S.srcData.data; let sum = 0, n = 0;
    for (let y = Math.max(0, p.y - r | 0); y < Math.min(H, p.y + r); y += 2)
      for (let x = Math.max(0, p.x - r | 0); x < Math.min(W, p.x + r); x += 2) {
        const i = (y * W + x) * 4; sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++;
      }
    return n ? sum / n : 128;
  };
  const r = Math.max(3, faceW * 0.07);
  const lumA = lum(lm[50], r), lumB = lum(lm[280], r);
  return { E, roll, u, v, chinV, foreV, crownV, faceW, centerU, cut, crownFromMatte, lumA, lumB, toSrc };
}

// ---------------------------------------------------------------- compositing
// Coarse map of the ORIGINAL background colour, used to remove colour fringes from hair edges.
function buildBgMap() {
  const W = S.src.width, H = S.src.height, d = S.srcData.data, A = S.alpha;
  const cell = Math.ceil(Math.max(W, H) / 48);
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const sum = new Float32Array(gw * gh * 3), cnt = new Float32Array(gw * gh);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = y * W + x;
    if (A[i] < 0.08) { const g = ((y / cell) | 0) * gw + ((x / cell) | 0); sum[g * 3] += d[i * 4]; sum[g * 3 + 1] += d[i * 4 + 1]; sum[g * 3 + 2] += d[i * 4 + 2]; cnt[g]++; }
  }
  const col = new Float32Array(gw * gh * 3), has = new Uint8Array(gw * gh);
  for (let g = 0; g < gw * gh; g++) if (cnt[g] > 0) { has[g] = 1; for (let k = 0; k < 3; k++) col[g * 3 + k] = sum[g * 3 + k] / cnt[g]; }
  if (!has.some((v) => v)) return null;
  for (let pass = 0; pass < gw + gh; pass++) {
    let empty = 0; const next = has.slice();
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const g = gy * gw + gx; if (has[g]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const q = ny * gw + nx; if (has[q]) { r += col[q * 3]; gg += col[q * 3 + 1]; b += col[q * 3 + 2]; n++; }
      }
      if (n) { col[g * 3] = r / n; col[g * 3 + 1] = gg / n; col[g * 3 + 2] = b / n; next[g] = 1; } else empty++;
    }
    has.set(next); if (!empty) break;
  }
  return { col, gw, cell };
}

const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function adjLut() {
  const { b, c } = S.adj;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = ((v + b * 1.2) - 128) * (1 + c / 100) + 128;
  return lut;
}
function recomposite() {
  const W = S.src.width, H = S.src.height;
  if (!S.processed) S.processed = document.createElement('canvas');
  S.processed.width = W; S.processed.height = H;
  const src = S.srcData.data;
  const out = new ImageData(W, H);
  const o = out.data;
  const lut = adjLut();
  const sf = 1 + S.adj.s / 100, warm = S.adj.w;
  const [br, bgc, bb] = hexToRgb(S.bg);
  const useA = S.bgOn && S.alpha;
  const A = S.alpha;
  const lo = S.edge * 0.0035, span = 1 - 2 * lo;
  const M = useA ? S.bgMap : null;
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    let r = src[p], g = src[p + 1], b = src[p + 2];
    let a = 1;
    if (useA) {
      a = (A[i] - lo) / span; a = a < 0 ? 0 : a > 1 ? 1 : a;
      const ra = A[i];
      if (M && ra > 0.1 && ra < 0.97) {
        // un-mix the old background colour from semi-transparent edge pixels
        const x = i % W, y = (i / W) | 0;
        const q = (((y / M.cell) | 0) * M.gw + ((x / M.cell) | 0)) * 3;
        const ia = 1 / ra, ib = 1 - ra;
        r = (r - ib * M.col[q]) * ia; g = (g - ib * M.col[q + 1]) * ia; b = (b - ib * M.col[q + 2]) * ia;
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      }
    }
    r = lut[r | 0]; g = lut[g | 0]; b = lut[b | 0];
    if (sf !== 1) { const L = 0.299 * r + 0.587 * g + 0.114 * b; r = L + (r - L) * sf; g = L + (g - L) * sf; b = L + (b - L) * sf; }
    if (warm) { r += warm; b -= warm; }
    o[p] = r * a + br * (1 - a);
    o[p + 1] = g * a + bgc * (1 - a);
    o[p + 2] = b * a + bb * (1 - a);
    o[p + 3] = 255;
  }
  S.processed.getContext('2d').putImageData(out, 0, 0);
}
let recompQueued = false;
function queueRecomposite() {
  if (recompQueued) return;
  recompQueued = true;
  requestAnimationFrame(() => { recompQueued = false; recomposite(); drawStage(); });
}

// ---------------------------------------------------------------- geometry
// Frame(mm) = T + R(rot) * s * (p - c), where c = image centre.
function toFrame(p) {
  const cx = S.src.width / 2, cy = S.src.height / 2;
  const dx = (p.x - cx) * S.s, dy = (p.y - cy) * S.s;
  const co = Math.cos(S.rot), si = Math.sin(S.rot);
  return { x: S.T.x + co * dx - si * dy, y: S.T.y + si * dx + co * dy };
}
function toSource(F) {
  const dx = (F.x - S.T.x) / S.s, dy = (F.y - S.T.y) / S.s;
  const co = Math.cos(-S.rot), si = Math.sin(-S.rot);
  return { x: S.src.width / 2 + co * dx - si * dy, y: S.src.height / 2 + si * dx + co * dy };
}
function coverage(pr) {
  const inside = (F) => { const p = toSource(F); return p.x >= -1 && p.y >= -1 && p.x <= S.src.width + 1 && p.y <= S.src.height + 1; };
  const e = 0.4;
  const bottom = [e, pr.w / 2, pr.w - e].every((x) => inside({ x, y: pr.h - e }));
  const all = bottom && inside({ x: e, y: e }) && inside({ x: pr.w - e, y: e }) && inside({ x: e, y: pr.h / 2 }) && inside({ x: pr.w - e, y: pr.h / 2 });
  return { bottom, all };
}
function applyTransform(ctx) {
  ctx.translate(S.T.x, S.T.y);
  ctx.rotate(S.rot);
  ctx.scale(S.s, S.s);
  ctx.translate(-S.src.width / 2, -S.src.height / 2);
}
function placePoint(srcPt, target) {
  // Choose T so that srcPt lands on target (given s, rot).
  S.T = { x: 0, y: 0 };
  const f = toFrame(srcPt);
  S.T = { x: target.x - f.x, y: target.y - f.y };
}
function zoomAbout(factor, P) {
  S.T = { x: P.x + factor * (S.T.x - P.x), y: P.y + factor * (S.T.y - P.y) };
  S.s *= factor;
}
function rotateAbout(delta, P) {
  const co = Math.cos(delta), si = Math.sin(delta);
  const dx = S.T.x - P.x, dy = S.T.y - P.y;
  S.T = { x: P.x + co * dx - si * dy, y: P.y + si * dx + co * dy };
  S.rot += delta;
}

function autoFit() {
  const pr = preset(), f = S.face;
  if (!f) {
    S.rot = 0;
    S.s = Math.max(pr.w / S.src.width, pr.h / S.src.height);
    S.T = { x: pr.w / 2, y: pr.h / 2 };
    S.guideCrownY = (pr.h - pr.target) * 0.4;
  } else {
    S.rot = -f.roll;
    S.s = pr.target / (f.chinV - f.crownV);
    let crownY;
    if (pr.eye) {
      const eyeY = pr.h - (pr.eye[0] + pr.eye[1]) / 2;
      crownY = eyeY + f.crownV * S.s;
      if (crownY < 1.5) crownY = 1.5;
    } else crownY = (pr.h - pr.target) * 0.4;
    S.guideCrownY = crownY;
    placePoint(f.toSrc(f.centerU, f.crownV), { x: pr.w / 2, y: crownY });
  }
  S.fitScale = S.s; S.fitRot = S.rot;
  $('#zoom').value = 100; $('#rotate').value = 0;
  drawStage(); updateChecks();
}

// ---------------------------------------------------------------- stage drawing
const stage = $('#stage');
const sc = $('#stage-canvas');
function drawStage() {
  if (!S.processed || !stage.offsetParent) return;
  const pr = preset();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(stage.clientWidth * dpr), ch = Math.round(stage.clientHeight * dpr);
  if (sc.width !== cw || sc.height !== ch) { sc.width = cw; sc.height = ch; }
  const ctx = sc.getContext('2d');
  const pad = 44 * dpr;
  const k = Math.min((cw - 2 * pad) / pr.w, (ch - 2 * pad) / pr.h);
  const fx = (cw - pr.w * k) / 2, fy = (ch - pr.h * k) / 2;
  S.view = { k, fx, fy, dpr };
  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingQuality = 'high';

  // background inside frame
  ctx.fillStyle = S.bg;
  ctx.fillRect(fx, fy, pr.w * k, pr.h * k);
  // photo
  ctx.save(); ctx.translate(fx, fy); ctx.scale(k, k); applyTransform(ctx); ctx.drawImage(S.processed, 0, 0); ctx.restore();
  // dim outside the frame
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.rect(fx, fy, pr.w * k, pr.h * k);
  ctx.fillStyle = 'rgba(246,242,233,.86)'; ctx.fill('evenodd');
  ctx.restore();
  // frame border
  ctx.strokeStyle = '#17171C'; ctx.lineWidth = 2 * dpr;
  ctx.strokeRect(fx, fy, pr.w * k, pr.h * k);
  // size labels
  ctx.fillStyle = '#44444F'; ctx.font = `600 ${11 * dpr}px DM Sans, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.fillText(`${fmtMM(pr.w)} mm`, fx + pr.w * k / 2, fy - 10 * dpr);
  ctx.save(); ctx.translate(fx - 12 * dpr, fy + pr.h * k / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${fmtMM(pr.h)} mm`, 0, 0); ctx.restore();

  if (S.guides) drawGuides(ctx, pr, k, fx, fy, dpr);
}
const fmtMM = (v) => (Math.round(v * 10) / 10).toString();

function drawGuides(ctx, pr, k, fx, fy, dpr) {
  const ok = lastChecks.headOk && lastChecks.posOk;
  const col = ok ? '#12A150' : '#FF6A13';
  const X = (mm) => fx + mm * k, Y = (mm) => fy + mm * k;
  const crownY = S.guideCrownY ?? (pr.h - pr.target) * 0.4;
  const chinY = crownY + pr.target;
  ctx.save();
  ctx.beginPath(); ctx.rect(fx, fy, pr.w * k, pr.h * k); ctx.clip();
  ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = col; ctx.setLineDash([6 * dpr, 5 * dpr]);
  // head oval
  ctx.beginPath();
  ctx.ellipse(X(pr.w / 2), Y(crownY + pr.target / 2), pr.target * 0.36 * k, pr.target / 2 * k, 0, 0, Math.PI * 2);
  ctx.stroke();
  // crown + chin lines
  ctx.globalAlpha = .9;
  [[crownY, 'Top of head'], [chinY, 'Chin']].forEach(([y, label]) => {
    ctx.beginPath(); ctx.moveTo(fx, Y(y)); ctx.lineTo(fx + pr.w * k, Y(y)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `700 ${10 * dpr}px DM Sans, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 10 * dpr;
    ctx.fillStyle = col; ctx.globalAlpha = .92;
    const ly = label === 'Chin' ? Y(y) + 3 * dpr : Y(y) - 17 * dpr;
    roundRect(ctx, fx + 6 * dpr, ly, tw, 14 * dpr, 4 * dpr); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(label, fx + 11 * dpr, ly + 10.5 * dpr);
    ctx.setLineDash([6 * dpr, 5 * dpr]); ctx.globalAlpha = .9;
  });
  // centre line
  ctx.globalAlpha = .45;
  ctx.beginPath(); ctx.moveTo(X(pr.w / 2), fy); ctx.lineTo(X(pr.w / 2), fy + pr.h * k); ctx.stroke();
  // eye band
  if (pr.eye) {
    ctx.globalAlpha = .12; ctx.fillStyle = col;
    ctx.fillRect(fx, Y(pr.h - pr.eye[1]), pr.w * k, (pr.eye[1] - pr.eye[0]) * k);
    ctx.globalAlpha = .9; ctx.setLineDash([]);
    ctx.font = `700 ${10 * dpr}px DM Sans, system-ui, sans-serif`; ctx.fillStyle = col; ctx.textAlign = 'right';
    ctx.fillText('Eyes', fx + pr.w * k - 6 * dpr, Y(pr.h - pr.eye[1]) + 12 * dpr);
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
new ResizeObserver(() => drawStage()).observe(stage);

// ---------------------------------------------------------------- gestures
const pointers = new Map();
let gesture = null;
const toMM = (cx, cy) => {
  const r = sc.getBoundingClientRect(); const { k, fx, fy, dpr } = S.view;
  return { x: ((cx - r.left) * dpr - fx) / k, y: ((cy - r.top) * dpr - fy) / k };
};
function hideHint() { $('#stage-hint').style.opacity = 0; }
stage.addEventListener('pointerdown', (e) => {
  if (!S.processed) return;
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  gesture = null; hideHint();
});
stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    const a = toMM(prev.x, prev.y), b = toMM(e.clientX, e.clientY);
    S.T.x += b.x - a.x; S.T.y += b.y - a.y;
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const m = toMM((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    if (gesture) {
      zoomAbout(d / gesture.d, m);
      S.T.x += m.x - gesture.m.x; S.T.y += m.y - gesture.m.y;
    }
    gesture = { d, m };
    syncZoomSlider();
  }
  requestDraw();
});
const endPointer = (e) => { pointers.delete(e.pointerId); gesture = null; updateChecks(); };
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', (e) => {
  if (!S.processed) return;
  e.preventDefault(); hideHint();
  zoomAbout(Math.exp(-e.deltaY * 0.0015), toMM(e.clientX, e.clientY));
  syncZoomSlider(); requestDraw(); scheduleChecks();
}, { passive: false });

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; drawStage(); });
}
let checkTimer;
function scheduleChecks() { clearTimeout(checkTimer); checkTimer = setTimeout(updateChecks, 120); }
function syncZoomSlider() { $('#zoom').value = Math.round((S.s / S.fitScale) * 100); }

$('#zoom').addEventListener('input', (e) => {
  const pr = preset();
  zoomAbout((S.fitScale * e.target.value / 100) / S.s, { x: pr.w / 2, y: pr.h * 0.45 });
  requestDraw(); scheduleChecks();
});
$('#rotate').addEventListener('input', (e) => {
  const want = S.fitRot + (e.target.value / 10) * DEG;
  const pivot = S.face ? toFrame(S.face.E) : { x: preset().w / 2, y: preset().h / 2 };
  rotateAbout(want - S.rot, pivot);
  requestDraw(); scheduleChecks();
});
$('#btn-autofit').addEventListener('click', () => { autoFit(); toast('Photo re-aligned'); });
$('#btn-rot90').addEventListener('click', async () => {
  const c = document.createElement('canvas');
  c.width = S.src.height; c.height = S.src.width;
  const cx = c.getContext('2d');
  cx.translate(c.width, 0); cx.rotate(Math.PI / 2); cx.drawImage(S.src, 0, 0);
  await analyse(c);
});
$('#toggle-guides').addEventListener('change', (e) => { S.guides = e.target.checked; drawStage(); });

// ---------------------------------------------------------------- controls
const sel = $('#preset-select');
(function buildPresets() {
  const groups = {};
  PRESETS.forEach((p) => (groups[p.group] ||= []).push(p));
  Object.entries(groups).forEach(([g, list]) => {
    const og = document.createElement('optgroup'); og.label = g;
    list.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.name}`; og.appendChild(o); });
    sel.appendChild(og);
  });
  sel.value = S.presetId;
})();
function onPresetChange() {
  const pr = preset();
  $('#custom-size').hidden = !pr.custom;
  $('#stage-title').textContent = pr.name;
  $('#stage-sub').textContent = pr.short;
  $('#preset-rules').innerHTML = pr.rules.map((r) => `<li>${r}</li>`).join('');
  S.pxW = S.pxH = null;
  if (S.bg !== pr.bg && BG_SWATCHES.some((s) => s.c === S.bg)) { S.bg = pr.bg; buildSwatches(); if (S.src) recomposite(); }
  if (S.src) autoFit();
}
sel.addEventListener('change', () => { S.presetId = sel.value; onPresetChange(); });
['#custom-w', '#custom-h'].forEach((id) => $(id).addEventListener('change', () => {
  S.customW = +$('#custom-w').value; S.customH = +$('#custom-h').value; onPresetChange();
}));

function buildSwatches() {
  const box = $('#swatches');
  box.innerHTML = '';
  BG_SWATCHES.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'sw' + (S.bg === s.c ? ' is-on' : '');
    b.style.background = s.c; b.title = s.n; b.setAttribute('aria-label', s.n + ' background');
    b.addEventListener('click', () => { S.bg = s.c; buildSwatches(); queueRecomposite(); updateChecks(); });
    box.appendChild(b);
  });
  const custom = document.createElement('label');
  const isCustom = !BG_SWATCHES.some((s) => s.c === S.bg);
  custom.className = 'sw sw-custom' + (isCustom ? ' is-on' : '');
  custom.title = 'Custom colour';
  if (isCustom) custom.style.background = S.bg;
  custom.innerHTML = `<input type="color" value="${S.bg}" aria-label="Custom background colour">`;
  custom.querySelector('input').addEventListener('input', (e) => { S.bg = e.target.value; custom.style.background = S.bg; queueRecomposite(); });
  custom.querySelector('input').addEventListener('change', () => { buildSwatches(); updateChecks(); });
  box.appendChild(custom);
}
buildSwatches();
onPresetChange();

$('#toggle-bg').addEventListener('change', (e) => {
  S.bgOn = e.target.checked;
  if (S.bgOn && !S.alpha) toast('Background removal is not available for this photo.');
  queueRecomposite(); updateChecks();
});
$('#edge').addEventListener('input', (e) => { S.edge = +e.target.value; queueRecomposite(); });
const adjMap = { '#adj-bright': 'b', '#adj-contrast': 'c', '#adj-sat': 's', '#adj-warm': 'w' };
Object.entries(adjMap).forEach(([id, key]) => $(id).addEventListener('input', (e) => { S.adj[key] = +e.target.value; queueRecomposite(); scheduleChecks(); }));
function syncAdjSliders() { Object.entries(adjMap).forEach(([id, key]) => ($(id).value = S.adj[key])); }
$('#btn-reset-adj').addEventListener('click', () => { S.adj = { b: 0, c: 0, s: 0, w: 0 }; syncAdjSliders(); queueRecomposite(); updateChecks(); });
$('#btn-auto-light').addEventListener('click', () => {
  if (!S.face) { toast('Needs a detected face.'); return; }
  const m = (S.face.lumA + S.face.lumB) / 2;
  S.adj.b = Math.max(-60, Math.min(60, Math.round((158 - m) / 1.2)));
  S.adj.c = 6; S.adj.s = 0; S.adj.w = 0;
  syncAdjSliders(); queueRecomposite(); updateChecks();
  toast('Lighting balanced');
});

// ---------------------------------------------------------------- checks
let lastChecks = { headOk: false, posOk: false };
function updateChecks() {
  const pr = preset(), f = S.face, items = [];
  const add = (lvl, title, sub = '') => items.push({ lvl, title, sub });
  let headOk = false, posOk = false;
  if (!S.src) return;
  if (!f) {
    add('bad', 'No face detected', 'Use a clear, front-facing photo, or place it by hand using the guides.');
  } else {
    if (S.faces.length > 1) add('warn', 'More than one face found', 'Only one person should be in the photo.');
    const head = (f.chinV - f.crownV) * S.s;
    const [mn, mx] = pr.head;
    headOk = head >= mn - 0.2 && head <= mx + 0.2;
    add(headOk ? 'ok' : 'bad', `Head size ${head.toFixed(1)} mm`, headOk ? `Required ${mn}–${mx} mm, chin to top of hair` : `Needs ${mn}–${mx} mm. Zoom ${head < mn ? 'in' : 'out'} or tap Auto-fit.`);
    const crown = toFrame(f.toSrc(f.centerU, f.crownV));
    const chin = toFrame(f.toSrc(f.centerU, f.chinV));
    const eyes = toFrame(f.toSrc(f.centerU, 0));
    const topOk = crown.y >= 1, chinOk = chin.y <= pr.h - 1.5;
    const centred = Math.abs(eyes.x - pr.w / 2) <= pr.w * 0.04;
    posOk = topOk && chinOk && centred;
    if (!topOk) add('bad', 'Head too close to the top', 'Leave a little space above the hair.');
    else if (!chinOk) add('bad', 'Chin too close to the bottom', 'Move the photo up or zoom out.');
    else add(centred ? 'ok' : 'warn', centred ? 'Face centred' : 'Face is off-centre', centred ? '' : 'Drag the photo or tap Auto-fit.');
    if (pr.eye) {
      const e = pr.h - eyes.y, ok = e >= pr.eye[0] - 0.2 && e <= pr.eye[1] + 0.2;
      posOk = posOk && ok;
      add(ok ? 'ok' : 'bad', `Eye line ${e.toFixed(1)} mm from bottom`, ok ? `Required ${pr.eye[0]}–${pr.eye[1]} mm` : `Needs ${pr.eye[0]}–${pr.eye[1]} mm`);
    }
    const tilt = (f.roll + S.rot) / DEG;
    add(Math.abs(tilt) <= 2 ? 'ok' : 'warn', Math.abs(tilt) <= 2 ? 'Head is straight' : `Head tilted ${Math.abs(tilt).toFixed(1)}°`, Math.abs(tilt) <= 2 ? '' : 'Use Straighten or Auto-fit.');
    const cover = coverage(pr);
    if (!cover.bottom) add('warn', 'Shoulders are cut off', 'Your photo ends above the bottom edge. Zoom in, or use a photo that shows your shoulders.');
    else if (!cover.all && !(S.bgOn && S.alpha)) add('warn', 'Photo does not fill the frame', 'Zoom in so there are no empty edges.');
    if (f.cut) add('warn', 'Top of head may be cut off', 'Your original photo is cropped too tight. Retake with space above your hair.');
    const lut = adjLut();
    const mean = lut[Math.round((f.lumA + f.lumB) / 2)] ?? 128;
    const ratio = Math.min(f.lumA, f.lumB) / Math.max(f.lumA, f.lumB);
    if (mean < 85) add('warn', 'Face looks dark', 'Tap Auto light, or retake facing a window.');
    else if (mean > 225) add('warn', 'Face looks overexposed', 'Lower the brightness.');
    else if (ratio < 0.72) add('warn', 'Uneven light on the face', 'One side is in shadow. Face a window for even light.');
    else add('ok', 'Good, even lighting');
    const pxPerMm = 1 / S.s, need = DPI / 25.4;
    add(pxPerMm >= need * 0.7 ? 'ok' : 'warn', pxPerMm >= need * 0.7 ? 'Sharp enough for print' : 'Low resolution', pxPerMm >= need * 0.7 ? '' : 'Print may look soft. Use the main camera from closer.');
  }
  if (!S.bgOn || !S.alpha) add('warn', 'Background not replaced', S.alpha ? 'Turn on Remove background for a plain backdrop.' : 'Shoot against a plain light wall.');
  else {
    const [r, g, b] = hexToRgb(S.bg); const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const [pr0, pg0, pb0] = hexToRgb(pr.bg); const PL = 0.299 * pr0 + 0.587 * pg0 + 0.114 * pb0;
    if (PL > 200 && L < 200) add('warn', 'Background colour', 'This document usually needs a white or light background.');
    else add('ok', 'Plain background');
  }
  lastChecks = { headOk, posOk };
  const nBad = items.filter((i) => i.lvl === 'bad').length, nWarn = items.filter((i) => i.lvl === 'warn').length;
  const chip = $('#check-chip');
  chip.className = 'check-chip ' + (nBad ? 'bad' : nWarn ? 'warn' : 'ok');
  chip.textContent = nBad + nWarn === 0 ? '✓ All checks passed' : `${nBad + nWarn} thing${nBad + nWarn > 1 ? 's' : ''} to check`;
  const icon = { ok: '✓', warn: '!', bad: '✕' };
  $('#checks').innerHTML = items.map((i) => `<li class="${i.lvl}"><span class="ic">${icon[i.lvl]}</span><div>${i.title}${i.sub ? `<small>${i.sub}</small>` : ''}</div></li>`).join('');
  requestDraw();
}

// ---------------------------------------------------------------- output rendering
function renderPhoto(pxW, pxH) {
  const pr = preset();
  const c = document.createElement('canvas');
  c.width = pxW; c.height = pxH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = S.bg; ctx.fillRect(0, 0, pxW, pxH);
  // Downscale in steps for crisp results when the source is much larger.
  const kx = pxW / pr.w, ky = pxH / pr.h;
  const ratio = S.s * kx; // output px per source px
  let img = S.processed, imgScale = 1;
  if (ratio < 0.5) {
    let w = S.processed.width, h = S.processed.height, cur = S.processed;
    while (ratio * imgScale < 0.5 && w > 64) {
      const t = document.createElement('canvas');
      t.width = Math.round(w / 2); t.height = Math.round(h / 2);
      const tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high';
      tx.drawImage(cur, 0, 0, t.width, t.height);
      imgScale *= w / t.width; cur = t; w = t.width; h = t.height;
    }
    img = cur;
  }
  ctx.save();
  ctx.scale(kx, ky);
  applyTransform(ctx);
  ctx.drawImage(img, 0, 0, S.processed.width, S.processed.height);
  ctx.restore();
  return c;
}
const defaultPx = () => { const pr = preset(); return { w: Math.round(pr.w / 25.4 * DPI), h: Math.round(pr.h / 25.4 * DPI) }; };
const outPx = () => { const d = defaultPx(); return { w: S.pxW || d.w, h: S.pxH || d.h }; };

// ---------------------------------------------------------------- download step
function renderDownloads() {
  const { w, h } = outPx();
  const pr = preset();
  $('#px-w').value = w; $('#px-h').value = h;
  $('#kb-max').value = S.kbMax ?? ''; $('#kb-min').value = S.kbMin ?? '';
  const c = renderPhoto(w, h);
  const pc = $('#single-canvas');
  pc.width = w; pc.height = h;
  pc.getContext('2d').drawImage(c, 0, 0);
  const custom = S.pxW != null;
  $('#single-info').textContent = `${w} × ${h} px · ${custom ? 'custom pixels' : `${pr.short} at 300 DPI`}${S.kbMax ? ` · up to ${S.kbMax} KB` : ''}`;
  buildPaperOptions();
  renderSheet();
}
$$('.seg-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.seg-btn').forEach((x) => x.classList.toggle('is-on', x === b));
  S.fmt = b.dataset.fmt;
}));
$('#px-w').addEventListener('change', (e) => {
  const pr = preset(); const w = Math.max(50, Math.min(4000, +e.target.value || 0));
  S.pxW = w; S.pxH = Math.round(w * pr.h / pr.w); renderDownloads();
});
$('#px-h').addEventListener('change', (e) => {
  const pr = preset(); const h = Math.max(50, Math.min(4000, +e.target.value || 0));
  S.pxH = h; S.pxW = Math.round(h * pr.w / pr.h); renderDownloads();
});
$('#kb-max').addEventListener('change', (e) => { S.kbMax = +e.target.value || null; renderDownloads(); });
$('#kb-min').addEventListener('change', (e) => { S.kbMin = +e.target.value || null; renderDownloads(); });
$$('.chip').forEach((c) => c.addEventListener('click', () => {
  if (c.dataset.px === 'reset') { S.pxW = S.pxH = null; }
  else { const [mn, mx] = c.dataset.kb.split('-').map(Number); S.kbMin = mn || null; S.kbMax = mx; }
  if (S.kbMax && S.fmt === 'png') { $$('.seg-btn').forEach((x) => x.classList.toggle('is-on', x.dataset.fmt === 'jpg')); S.fmt = 'jpg'; }
  renderDownloads();
}));

// Pad a JPEG with a comment segment so it meets a minimum file size.
async function padJpeg(blob, minBytes) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let need = minBytes - buf.length;
  if (need <= 0) return blob;
  let at = 2;
  if (buf[2] === 0xff && buf[3] === 0xe0) at = 4 + (buf[4] << 8 | buf[5]);
  const segs = [];
  while (need > 0) {
    const n = Math.min(65533, Math.max(1, need - 4));
    const seg = new Uint8Array(n + 4);
    seg[0] = 0xff; seg[1] = 0xfe; seg[2] = (n + 2) >> 8; seg[3] = (n + 2) & 255;
    segs.push(seg); need -= seg.length;
  }
  return new Blob([buf.slice(0, at), ...segs, buf.slice(at)], { type: 'image/jpeg' });
}

$('#btn-dl-single').addEventListener('click', async () => {
  const { w, h } = outPx();
  const pr = preset();
  const c = renderPhoto(w, h);
  let blob, note = '';
  if (S.fmt === 'png' && !S.kbMax) {
    blob = await canvasToBlob(c, 'image/png');
  } else {
    if (S.kbMax) {
      const r = await jpegUnder(c, S.kbMax * 1024);
      blob = r.blob;
      if (!r.fits) note = ` Could not get under ${S.kbMax} KB at ${w}×${h}px. Try a smaller pixel size.`;
    } else blob = await canvasToBlob(c, 'image/jpeg', 0.95);
    blob = await setJpegDpi(blob, DPI);
    if (S.kbMin && blob.size < S.kbMin * 1024) blob = await padJpeg(blob, S.kbMin * 1024 + 512);
  }
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  download(blob, `nishtek-passport-${pr.id}-${w}x${h}.${ext}`);
  $('#single-info').textContent = `${w} × ${h} px · ${ext.toUpperCase()} · ${fmtKB(blob.size)}`;
  toast(`Downloaded (${fmtKB(blob.size)}).${note}`, note ? 6000 : 3000);
});

// ---------------------------------------------------------------- print sheet
const paperSel = $('#paper-select');
const copiesSel = $('#copies-select');
PAPERS.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; paperSel.appendChild(o); });
paperSel.value = S.paperId;
function currentLayout() {
  const pr = preset();
  const paper = PAPERS.find((p) => p.id === S.paperId);
  return { paper, ...layoutSheet(paper, pr.w, pr.h, S.copies, S.cut) };
}
function buildPaperOptions() {
  const L = currentLayout();
  copiesSel.innerHTML = '';
  const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; copiesSel.appendChild(o); };
  add(0, `Fill sheet (${L.max} photos)`);
  for (let i = 1; i < L.max; i++) add(i, `${i} photo${i > 1 ? 's' : ''}`);
  if (S.copies >= L.max) S.copies = 0;
  copiesSel.value = S.copies;
}
paperSel.addEventListener('change', () => { S.paperId = paperSel.value; S.copies = 0; buildPaperOptions(); renderSheet(); });
copiesSel.addEventListener('change', () => { S.copies = +copiesSel.value; renderSheet(); });
$('#toggle-cut').addEventListener('change', (e) => { S.cut = e.target.checked; buildPaperOptions(); renderSheet(); });

function buildSheetCanvas() {
  const pr = preset();
  const L = currentLayout();
  const k = DPI / 25.4;
  const W = Math.round(L.pageW * k), H = Math.round(L.pageH * k);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const tw = Math.round(pr.w * k), th = Math.round(pr.h * k);
  const tile = renderPhoto(tw, th);
  L.slots.forEach((s) => {
    const x = Math.round(s.x * k), y = Math.round(s.y * k);
    ctx.drawImage(tile, x, y);
    if (S.cut) { ctx.strokeStyle = '#B9C0D0'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, tw + 2, th + 2); }
  });
  // footer note if there is room
  const used = L.paper.margin + L.rows * pr.h + (L.rows - 1) * L.gap;
  if (L.pageH - used > 9) {
    ctx.fillStyle = '#8A90A8';
    ctx.font = `600 ${Math.round(2.6 * k)}px DM Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${pr.name} · ${pr.short} · Print at Actual size / 100% · Passport Photo Maker by Nishtek`, W / 2, H - Math.round(L.paper.margin * k * 0.6));
  }
  return { c, L };
}
function renderSheet() {
  if (!S.processed) return;
  const { c, L } = buildSheetCanvas();
  const pc = $('#sheet-canvas');
  const scale = Math.min(1, 900 / Math.max(c.width, c.height));
  pc.width = Math.round(c.width * scale); pc.height = Math.round(c.height * scale);
  const ctx = pc.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, pc.width, pc.height);
  $('#sheet-info').textContent = `${L.slots.length} photos · ${L.paper.name} (${fmtMM(L.pageW)} × ${fmtMM(L.pageH)} mm) · 300 DPI`;
}
async function sheetBlob() {
  const { c, L } = buildSheetCanvas();
  const jpg = await setJpegDpi(await canvasToBlob(c, 'image/jpeg', 0.95), DPI);
  return { jpg, c, L };
}
$('#btn-dl-sheet-jpg').addEventListener('click', async () => {
  const { jpg, L } = await sheetBlob();
  download(jpg, `nishtek-passport-sheet-${preset().id}-${L.paper.id}.jpg`);
  toast('Print sheet downloaded. Print at Actual size / 100%.', 4000);
});
$('#btn-dl-sheet-pdf').addEventListener('click', async () => {
  const { jpg, c, L } = await sheetBlob();
  const pdf = await jpegToPdf(jpg, c.width, c.height, L.pageW, L.pageH);
  download(pdf, `nishtek-passport-sheet-${preset().id}-${L.paper.id}.pdf`);
  toast('PDF downloaded. Print at Actual size / 100%.', 4000);
});

// ---------------------------------------------------------------- camera
let stream = null, facing = 'user';
const camEl = $('#camera'), video = $('#cam-video');
async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { fileCapture.click(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
  } catch (e) {
    console.warn(e); fileCapture.click(); return;
  }
  video.srcObject = stream;
  camEl.hidden = false;
  $('.cam-view').classList.toggle('rear', facing !== 'user');
}
function closeCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; camEl.hidden = true; $('#cam-count').hidden = true;
}
$('#btn-camera').addEventListener('click', (e) => { e.stopPropagation(); openCamera(); });
$('#cam-close').addEventListener('click', closeCamera);
$('#cam-flip').addEventListener('click', async () => { facing = facing === 'user' ? 'environment' : 'user'; closeCamera(); await openCamera(); });
let shooting = false;
$('#cam-shoot').addEventListener('click', async () => {
  if (shooting || !stream) return;
  shooting = true;
  const cnt = $('#cam-count');
  cnt.hidden = false;
  for (let i = 3; i > 0; i--) { cnt.textContent = i; await new Promise((r) => setTimeout(r, 800)); }
  cnt.hidden = true;
  const w = video.videoWidth, h = video.videoHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(video, 0, 0, w, h);
  closeCamera();
  shooting = false;
  await useImage(c, w, h);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !camEl.hidden) closeCamera(); });

// expose for debugging
window.__passprint = S;
