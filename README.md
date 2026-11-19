# Passport Photo Maker by Nishtek

Built by Nishkam Bhatia · Vibecoded using Claude.

A static website. Upload or take a photo, and it removes the background, lines up the face to the official size, checks the photo and exports a digital photo or a print sheet (4×6 in, 5×7 in or A4, JPG or PDF).

All the AI runs inside the visitor's browser. No photo is uploaded anywhere, and there is no server, no API key and no running cost.

## Host it free on GitHub Pages
1. Create a new public repository, e.g. `passport-photo`.
2. Upload **everything in this folder** (keep the `lib/`, `models/`, `js/` and `assets/` folders as they are).
3. Repo → Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / root → Save.
4. Your site is live at `https://<username>.github.io/passport-photo/` in about a minute.

It also works on Vercel or Netlify (drag and drop the folder). A custom domain can be added in Settings → Pages.

> It must be opened over http(s). Double-clicking `index.html` won't work because browsers block AI models on `file://`. To test locally run `python3 -m http.server` in this folder and open http://localhost:8000.

## What's inside
| Path | What it is |
|---|---|
| `index.html`, `assets/style.css` | The page and design |
| `js/illustrations.js` | All illustrations (hand-drawn style SVG, no real photos) |
| `js/app.js` | Editor, auto-fit, checks, exports, camera |
| `js/ml.js` | On-device AI (face landmarks + background matting) |
| `js/presets.js` | Document sizes and rules. **Edit this to add countries or forms** |
| `js/export.js` | 300-DPI JPG, KB compressor, print-sheet layout, PDF writer |
| `lib/mediapipe/` | Google MediaPipe Tasks Vision 0.10.21 (Apache-2.0) |
| `lib/ort/` | ONNX Runtime Web 1.31 (MIT) |
| `models/face_landmarker.task` | Google MediaPipe Face Landmarker, float16 (Apache-2.0) |
| `models/modnet.onnx` | MODNet portrait matting, quantized ONNX (Apache-2.0) |

Every file is under 10 MB, so you can upload through GitHub in the browser. First visit downloads about 15 MB compressed (AI runtime and models). After that the browser caches it and it's instant.

The model files were taken from npm mirrors. If you prefer the originals, replace them with:
- `face_landmarker.task` from https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- `modnet.onnx` from https://huggingface.co/Xenova/modnet/tree/main/onnx (`model_quantized.onnx`, or `model.onnx` for slightly better edges at about 25 MB)

## Adding a preset
In `js/presets.js`, add an entry like this:
```js
{ id: 'uae', group: 'International', name: 'UAE – Visa (43 × 55 mm)', short: '43 × 55 mm',
  w: 43, h: 55, head: [32, 36], target: 34, bg: '#ffffff', rules: ['White background'] }
```
- `head`: allowed chin-to-crown height in mm.
- `target`: the height auto-fit aims for.
- `eye`: optional allowed eye-line height from the bottom edge in mm.

## Disclaimer
Photo rules change. The checks are a helper, not a guarantee of acceptance, so always confirm against the latest official guidelines.
