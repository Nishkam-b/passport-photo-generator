// On-device AI: face landmarks (MediaPipe) + portrait matting (MODNet via ONNX Runtime Web).
// Everything runs in the browser. No image ever leaves the device.

const BASE = new URL('../', import.meta.url).href;
const PATHS = {
  ort: BASE + 'lib/ort/ort.wasm.min.mjs',
  ortWasmDir: BASE + 'lib/ort/',
  mediapipe: BASE + 'lib/mediapipe/vision_bundle.mjs',
  mediapipeWasm: BASE + 'lib/mediapipe/wasm',
  faceModel: BASE + 'models/face_landmarker.task',
  matteModel: BASE + 'models/modnet.onnx',
};

let facePromise = null;
let mattePromise = null;
let ortMod = null;

export function loadFace() {
  if (!facePromise) {
    facePromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import(PATHS.mediapipe);
      const fileset = await FilesetResolver.forVisionTasks(PATHS.mediapipeWasm);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: PATHS.faceModel, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 3,
        minFaceDetectionConfidence: 0.4,
      });
    })().catch((e) => { facePromise = null; throw e; });
  }
  return facePromise;
}

export function loadMatte() {
  if (!mattePromise) {
    mattePromise = (async () => {
      ortMod = await import(PATHS.ort);
      const ort = ortMod.default || ortMod;
      ort.env.wasm.wasmPaths = PATHS.ortWasmDir;
      // The runtime is stored in two parts so every file stays under 10 MB (easy GitHub upload).
      const parts = await Promise.all(['ort-wasm.part0', 'ort-wasm.part1'].map((f) =>
        fetch(PATHS.ortWasmDir + f).then((r) => { if (!r.ok) throw new Error('Missing ' + f); return r.arrayBuffer(); })));
      const bin = new Uint8Array(parts.reduce((n, b) => n + b.byteLength, 0));
      let off = 0; for (const b of parts) { bin.set(new Uint8Array(b), off); off += b.byteLength; }
      ort.env.wasm.wasmBinary = bin;
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      return ort.InferenceSession.create(PATHS.matteModel, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })().catch((e) => { mattePromise = null; throw e; });
  }
  return mattePromise;
}

export function preload() {
  loadFace().catch(() => {});
  loadMatte().catch(() => {});
}

// Returns array of faces; each face = array of {x,y} in source pixels.
export async function detectFaces(canvas) {
  const fl = await loadFace();
  const res = fl.detect(canvas);
  const W = canvas.width, H = canvas.height;
  return (res.faceLandmarks || []).map((lm) => lm.map((p) => ({ x: p.x * W, y: p.y * H })));
}

// Returns Float32Array alpha (0..1) at source resolution.
export async function matte(canvas) {
  const session = await loadMatte();
  const ort = ortMod.default || ortMod;
  const W = canvas.width, H = canvas.height;
  // MODNet: shortest edge 512, both sides multiple of 32.
  const ref = 512;
  let sw, sh;
  if (W <= H) { sw = ref; sh = Math.round((H / W) * ref); } else { sh = ref; sw = Math.round((W / H) * ref); }
  sw = Math.max(32, Math.round(sw / 32) * 32);
  sh = Math.max(32, Math.round(sh / 32) * 32);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(canvas, 0, 0, sw, sh);
  const px = cx.getImageData(0, 0, sw, sh).data;
  const n = sw * sh;
  const data = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    data[i] = px[i * 4] / 127.5 - 1;
    data[n + i] = px[i * 4 + 1] / 127.5 - 1;
    data[2 * n + i] = px[i * 4 + 2] / 127.5 - 1;
  }
  const input = new ort.Tensor('float32', data, [1, 3, sh, sw]);
  const out = await session.run({ [session.inputNames[0]]: input });
  const m = out[session.outputNames[0]].data;

  // Upscale mask to source size via canvas (bilinear).
  const mc = document.createElement('canvas');
  mc.width = sw; mc.height = sh;
  const mx = mc.getContext('2d');
  const mid = mx.createImageData(sw, sh);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(m[i] * 255)));
    mid.data[i * 4] = v; mid.data[i * 4 + 1] = v; mid.data[i * 4 + 2] = v; mid.data[i * 4 + 3] = 255;
  }
  mx.putImageData(mid, 0, 0);
  const big = document.createElement('canvas');
  big.width = W; big.height = H;
  const bx = big.getContext('2d', { willReadFrequently: true });
  bx.imageSmoothingQuality = 'high';
  bx.drawImage(mc, 0, 0, W, H);
  const bd = bx.getImageData(0, 0, W, H).data;
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = bd[i * 4] / 255;
  return alpha;
}
