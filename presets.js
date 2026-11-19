// Document presets. All sizes in millimetres.
// head: allowed chin-to-crown height range; target: what auto-fit aims for.
// eye: optional allowed range for eye-line height measured from the bottom edge.
// Rules change - always double-check the latest official guidelines before submitting.

export const PRESETS = [
  {
    id: 'in-35x45', group: 'India', name: 'India – Passport size photo', short: '35 × 45 mm',
    w: 35, h: 45, head: [32, 36], target: 34, bg: '#ffffff',
    rules: ['Plain white background', 'Face covers about 80% of the photo', 'Both ears visible, eyes open, mouth closed', 'No shadows on face or background'],
  },
  {
    id: 'in-2x2', group: 'India', name: 'India – Visa / OCI (2 × 2 in)', short: '51 × 51 mm',
    w: 50.8, h: 50.8, head: [25.4, 35], target: 30, eye: [28, 35], bg: '#ffffff',
    rules: ['Square 2 × 2 inch photo', 'Plain white or light background', 'Full face, front view, eyes open', 'Head between 1 and 1⅜ inch'],
  },
  {
    id: 'us-2x2', group: 'International', name: 'US – Passport / Visa (2 × 2 in)', short: '51 × 51 mm',
    w: 50.8, h: 50.8, head: [25.4, 35], target: 31, eye: [28.6, 34.9], bg: '#ffffff',
    rules: ['White or off-white background', 'Head 1 to 1⅜ inch (chin to top of hair)', 'Eyes 1⅛ to 1⅜ inch from the bottom', 'No glasses'],
  },
  {
    id: 'uk', group: 'International', name: 'UK – Passport (35 × 45 mm)', short: '35 × 45 mm',
    w: 35, h: 45, head: [29, 34], target: 31.5, bg: '#ededed',
    rules: ['Plain light grey or cream background', 'Head 29–34 mm (chin to crown)', 'Neutral expression, mouth closed', 'No glasses, no shadows'],
  },
  {
    id: 'schengen', group: 'International', name: 'Schengen visa (35 × 45 mm)', short: '35 × 45 mm',
    w: 35, h: 45, head: [32, 36], target: 34, bg: '#f2f2f2',
    rules: ['Light, plain background', 'Face 32–36 mm (70–80% of photo)', 'Front view, neutral expression', 'Taken within the last 6 months'],
  },
  {
    id: 'canada', group: 'International', name: 'Canada – Passport (50 × 70 mm)', short: '50 × 70 mm',
    w: 50, h: 70, head: [31, 36], target: 33.5, bg: '#ffffff',
    rules: ['Plain white or light background', 'Face 31–36 mm (chin to crown)', 'Neutral expression, eyes open', 'Uniform lighting, no shadows'],
  },
  {
    id: 'australia', group: 'International', name: 'Australia – Passport (35 × 45 mm)', short: '35 × 45 mm',
    w: 35, h: 45, head: [32, 36], target: 34, bg: '#f2f2f2',
    rules: ['Plain white or light grey background', 'Face 32–36 mm (chin to crown)', 'Neutral expression, mouth closed', 'No glasses'],
  },
  {
    id: 'china', group: 'International', name: 'China – Visa (33 × 48 mm)', short: '33 × 48 mm',
    w: 33, h: 48, head: [28, 33], target: 30.5, bg: '#ffffff',
    rules: ['White background', 'Head 28–33 mm (chin to crown)', 'Ears visible, no accessories', 'Neutral expression'],
  },
  {
    id: 'stamp', group: 'Other', name: 'Stamp size (20 × 25 mm)', short: '20 × 25 mm',
    w: 20, h: 25, head: [15, 19], target: 17.5, bg: '#ffffff',
    rules: ['Used on many Indian forms', 'Plain light background', 'Full face, front view'],
  },
  {
    id: 'custom', group: 'Other', name: 'Custom size', short: 'Custom',
    w: 35, h: 45, head: null, target: null, bg: '#ffffff', custom: true,
    rules: ['Enter the size required by your form', 'Head is auto-sized to ~75% of the height'],
  },
];

// Derive head range for custom sizes.
export function resolvePreset(p, customW, customH) {
  if (!p.custom) return p;
  const w = Math.max(10, Math.min(150, customW || 35));
  const h = Math.max(10, Math.min(150, customH || 45));
  const target = +(h * 0.74).toFixed(1);
  return { ...p, w, h, head: [+(h * 0.66).toFixed(1), +(h * 0.82).toFixed(1)], target, short: `${w} × ${h} mm` };
}

export const BG_SWATCHES = [
  { c: '#ffffff', n: 'White' },
  { c: '#f2f2f2', n: 'Off-white' },
  { c: '#ededed', n: 'Light grey' },
  { c: '#dcebfa', n: 'Light blue' },
  { c: '#2f6fdb', n: 'Blue' },
  { c: '#d92b2b', n: 'Red' },
];

export const PAPERS = [
  { id: '4x6', name: '4 × 6 in photo paper', w: 101.6, h: 152.4, margin: 3, gap: 2 },
  { id: 'a4', name: 'A4 sheet', w: 210, h: 297, margin: 8, gap: 3 },
  { id: '5x7', name: '5 × 7 in photo paper', w: 127, h: 177.8, margin: 4, gap: 2 },
];
