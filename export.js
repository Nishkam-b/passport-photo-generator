// Export helpers: JPEG with 300 DPI metadata, size-limited JPEG, print sheets, tiny PDF writer.

export const canvasToBlob = (canvas, type, q) =>
  new Promise((res) => canvas.toBlob(res, type, q));

// Write DPI into the JFIF header so print shops see the right physical size.
export async function setJpegDpi(blob, dpi = 300) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff && buf[3] === 0xe0 &&
      buf[6] === 0x4a && buf[7] === 0x46 && buf[8] === 0x49 && buf[9] === 0x46) {
    buf[13] = 1; // units: dots per inch
    buf[14] = dpi >> 8; buf[15] = dpi & 255;
    buf[16] = dpi >> 8; buf[17] = dpi & 255;
  }
  return new Blob([buf], { type: 'image/jpeg' });
}

// Find the best JPEG quality that fits under maxBytes. Returns {blob, quality}.
export async function jpegUnder(canvas, maxBytes, minBytes = 0) {
  let best = null;
  let lo = 0.3, hi = 0.97;
  const full = await canvasToBlob(canvas, 'image/jpeg', hi);
  if (full.size <= maxBytes) return { blob: full, quality: hi, fits: true };
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const b = await canvasToBlob(canvas, 'image/jpeg', q);
    if (b.size <= maxBytes) { best = { blob: b, quality: q }; lo = q; } else hi = q;
  }
  if (best) return { ...best, fits: true };
  const b = await canvasToBlob(canvas, 'image/jpeg', 0.3);
  return { blob: b, quality: 0.3, fits: b.size <= maxBytes };
}

// Lay out as many photos as fit on a paper. Returns positions in mm.
export function layoutSheet(paper, pw, ph, wantCount, cutGap) {
  const gap = cutGap ? paper.gap : 0.6;
  const tryFit = (W, H) => {
    const cols = Math.floor((W - 2 * paper.margin + gap) / (pw + gap));
    const rows = Math.floor((H - 2 * paper.margin + gap) / (ph + gap));
    return { W, H, cols: Math.max(0, cols), rows: Math.max(0, rows) };
  };
  const a = tryFit(paper.w, paper.h);
  const b = tryFit(paper.h, paper.w);
  // Prefer portrait unless landscape fits strictly more.
  const pick = b.cols * b.rows > a.cols * a.rows ? b : a;
  const max = pick.cols * pick.rows;
  const count = Math.max(0, Math.min(max, wantCount || max));
  const gridW = pick.cols * pw + (pick.cols - 1) * gap;
  const x0 = (pick.W - gridW) / 2;
  const y0 = paper.margin + (pick.W === paper.w ? 0 : 0);
  const slots = [];
  for (let r = 0; r < pick.rows; r++) {
    for (let c = 0; c < pick.cols; c++) {
      if (slots.length >= count) break;
      slots.push({ x: x0 + c * (pw + gap), y: y0 + r * (ph + gap) });
    }
  }
  return { pageW: pick.W, pageH: pick.H, cols: pick.cols, rows: pick.rows, max, slots, gap };
}

// Minimal single-page PDF with one full-page JPEG. Sizes in mm.
export async function jpegToPdf(jpegBlob, imgW, imgH, pageWmm, pageHmm) {
  const jpg = new Uint8Array(await jpegBlob.arrayBuffer());
  const pt = (mm) => (mm * 72 / 25.4).toFixed(3);
  const W = pt(pageWmm), H = pt(pageHmm);
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    push(jpg);
    push('\nendstream');
  });
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  obj(6, () => push('<< /Producer (Passport Photo Maker by Nishtek) /Title (Passport photo print sheet) >>'));
  const xref = len;
  let x = 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export const fmtKB = (b) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(2)} MB`);
