// Original hand-drawn style SVG illustrations (thick ink outline, flat colour, sticker shadow).
// No photos of real people are used anywhere in the site.

const INK = '#17171C';

// A friendly flat avatar inside a passport-photo frame.
// opts: { bg, shirt, skin, hair, glasses, tilt, shadow, teeth, hairStyle, cropTight, eyesClosed }
export function avatar(o = {}) {
  const bg = o.bg || '#D6E8FF', shirt = o.shirt || '#2F5BFF', skin = o.skin || '#E9A97F', hair = o.hair || '#2B2220';
  const id = 'a' + Math.random().toString(36).slice(2, 8);
  const tilt = o.tilt || 0;
  const hairPath = o.hairStyle === 'long'
    ? `<path d="M30 70c-4-30 10-48 30-48s34 18 30 48l4 46H26z" fill="${hair}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    : `<path d="M33 62c-3-24 9-38 27-38 20 0 31 14 27 38-3-9-9-14-14-15-6 6-18 8-30 6-4 2-8 5-10 9z" fill="${hair}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const mouth = o.teeth
    ? `<path d="M50 84q10 10 20 0z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`
    : `<path d="M53 85q7 3 14 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  const eyes = o.eyesClosed
    ? `<path d="M45 67q4 3 8 0M67 67q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
    : `<circle cx="49" cy="66" r="3.2" fill="${INK}"/><circle cx="71" cy="66" r="3.2" fill="${INK}"/>`;
  const glasses = o.glasses
    ? `<g fill="rgba(255,255,255,.35)" stroke="${INK}" stroke-width="2.5"><circle cx="49" cy="66" r="9"/><circle cx="71" cy="66" r="9"/><path d="M58 66h4M40 64l-6-2M80 64l6-2" fill="none"/></g>`
    : '';
  const shade = o.shadow
    ? `<clipPath id="${id}c"><ellipse cx="60" cy="68" rx="25" ry="30"/></clipPath><rect x="60" y="30" width="40" height="80" fill="rgba(23,23,28,.38)" clip-path="url(#${id}c)"/>`
    : '';
  return `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <rect x="2" y="2" width="116" height="146" rx="6" fill="${bg}"/>
  <g transform="rotate(${tilt} 60 112)">${o.hairStyle === 'long' ? hairPath : ''}</g>
  <path d="M51 98h18v20q-9 7-18 0z" fill="${skin}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M14 150c2-24 18-36 46-36s44 12 46 36z" fill="${shirt}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M51 116q9 8 18 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <g transform="rotate(${tilt} 60 112)">
    <ellipse cx="34" cy="70" rx="5" ry="8" fill="${skin}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="86" cy="70" rx="5" ry="8" fill="${skin}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="60" cy="68" rx="25" ry="30" fill="${skin}" stroke="${INK}" stroke-width="3"/>
    ${o.hairStyle === 'long' ? `<path d="M36 60c2-16 12-26 24-26s22 10 24 26c-10-2-20-8-24-16-5 9-14 14-24 16z" fill="${hair}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` : hairPath}
    <path d="M43 58q6-3 12 0M65 58q6-3 12 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    ${eyes}
    <path d="M60 68q-2 8 0 10q2 1 4 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    ${mouth}
    <circle cx="44" cy="80" r="4" fill="#F28B82" opacity=".35"/><circle cx="76" cy="80" r="4" fill="#F28B82" opacity=".35"/>
    ${glasses}
    ${shade}
  </g>
  <rect x="2" y="2" width="116" height="146" rx="6" fill="none" stroke="${INK}" stroke-width="3"/>
</svg>`;
}

export function heroArt() {
  const face = avatar({ bg: '#ffffff', shirt: '#2F5BFF' });
  const small = avatar({ bg: '#ffffff', shirt: '#2F5BFF' });
  return `<div class="hero-art" aria-hidden="true">
    <div class="ha-sheet">${Array.from({ length: 6 }, () => `<div class="ha-mini">${small}</div>`).join('')}</div>
    <div class="ha-card">
      <span class="pin"></span>
      <div class="ha-photo">${face}
        <i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>
      </div>
      <div class="ha-dim ha-w"><span>35 mm</span></div>
      <div class="ha-dim ha-h"><span>45 mm</span></div>
    </div>
    <div class="ha-sticker s1">${icon('sparkle')} Background removed</div>
    <div class="ha-sticker s2">${icon('check')} Head size 34 mm</div>
    <div class="ha-scribble">no studio<br>needed!</div>
  </div>`;
}

export function icon(name) {
  const s = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  switch (name) {
    case 'upload': return s('<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>');
    case 'camera': return s('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>');
    case 'sparkle': return s('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>');
    case 'check': return s('<path d="m5 12 4.5 4.5L19 7"/>');
    case 'x': return s('<path d="M6 6l12 12M18 6 6 18"/>');
    case 'shield': return s('<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>');
    case 'printer': return s('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>');
    case 'globe': return s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>');
    case 'wand': return s('<path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>');
    case 'fit': return s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>');
    case 'rotate': return s('<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>');
    case 'ruler': return s('<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>');
    case 'sun': return s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>');
    case 'layers': return s('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>');
    case 'move': return s('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>');
    case 'download': return s('<path d="M12 4v12m0 0-5-5m5 5 5-5"/><path d="M4 20h16"/>');
    case 'arrow': return s('<path d="M5 12h14m0 0-5-5m5 5-5 5"/>');
    case 'back': return s('<path d="M19 12H5m0 0 5-5m-5 5 5 5"/>');
    default: return '';
  }
}

// Do / don't examples for the home page.
export const EXAMPLES = [
  { ok: true, t: 'Look straight', s: 'Eyes open, face the lens', o: { bg: '#E3F6EA', shirt: '#2F5BFF' } },
  { ok: true, t: 'Neutral face', s: 'Mouth closed, no big smile', o: { bg: '#E3F6EA', shirt: '#7C5CFF', hairStyle: 'long', hair: '#3A2A22' } },
  { ok: false, t: 'No glasses', s: 'Most passports reject them', o: { bg: '#FFE6E0', shirt: '#FF6A13', glasses: true } },
  { ok: false, t: 'No head tilt', s: 'Keep your chin level', o: { bg: '#FFE6E0', shirt: '#12A150', tilt: 12, hairStyle: 'long', hair: '#1E1A18' } },
  { ok: false, t: 'No shadows', s: 'Face a window for even light', o: { bg: '#FFE6E0', shirt: '#2F5BFF', shadow: true } },
  { ok: false, t: 'No teeth', s: 'A big smile can be rejected', o: { bg: '#FFE6E0', shirt: '#E0407B', teeth: true, hairStyle: 'long', hair: '#2B2220' } },
];

// Small looping scan animation used while the AI works.
export function scanArt() {
  return `<div class="scan">${avatar({ bg: '#ffffff', shirt: '#2F5BFF' })}<i class="scan-bar"></i></div>`;
}
