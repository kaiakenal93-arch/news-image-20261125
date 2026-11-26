// THE WEDNESDAY WIRE — v6 (fresh build)
// Sum up 25 November 2026's world news in one image.
// 50 stories: 3 heroes + 6 mids + 41 briefs. Tariff lead. Why-it-matters layer.
// Node stdlib only: own 5x7 bitmap font + own PNG encoder via node:zlib.
// v6 fixes vs v5:
//  - Macy's balloon highlight moved to the upper-right, clear of both eyes
//    (v5's highlight touched the left eye).
//  - H3 why-it-matters restores the docking time: "LAUNCH 00:18 UTC -
//    DOCKED 03:56 UTC" (why band grown to 3 content lines; H1/H2 gain a
//    third factual line so the band stays even).
//  - Dow mid: "RECORD" label moved to the top-left of the chart, no longer
//    clipped by the green recovery arrowhead.
//  - Houthis mid: drone drawn as a small quadcopter with the red X over it,
//    clear of the flare stack flame.
//  - H1 tariff wall: no stray white bar at the foot of the wall — every
//    container on the ship is coloured.
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');

const W = 1024, H = 1024;
const img = Buffer.alloc(W * H * 4);
let TRUNCATIONS = 0;

// ---------- palette ----------
const C = {
  navy: [14, 27, 51], ink: [16, 16, 16], cream: [250, 246, 236],
  paper: [252, 250, 244], paleYellow: [254, 244, 190], sky: [199, 227, 245],
  paleSand: [245, 233, 200], lightGreen: [216, 240, 208], lightGrey: [232, 232, 232],
  white: [255, 255, 255], black: [0, 0, 0], red: [214, 32, 32], darkRed: [178, 24, 24],
  yellow: [255, 214, 64], gold: [232, 178, 44], green: [24, 140, 60],
  darkGreen: [18, 110, 48], blue: [46, 127, 194], darkBlue: [20, 38, 63],
  brown: [168, 91, 42], darkBrown: [120, 62, 26], grey: [120, 120, 120],
  darkGrey: [64, 64, 64], midGrey: [85, 85, 85], orange: [242, 128, 32],
  lightOrange: [255, 176, 32], pink: [255, 150, 150], teal: [0, 128, 128],
  purple: [110, 70, 160], rust: [150, 84, 44],
};

// ---------- pixel buffer ----------
function px(x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = (a === undefined ? 255 : a);
}
function rect(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x0, x1, y, c, t) {
  t = t || 1;
  for (let j = 0; j < t; j++) for (let i = Math.min(x0, x1); i <= Math.max(x0, x1); i++) px(i, y + j, c);
}
function vline(x, y0, y1, c, t) {
  t = t || 1;
  for (let i = 0; i < t; i++) for (let j = Math.min(y0, y1); j <= Math.max(y0, y1); j++) px(x + i, j, c);
}
function line(x0, y0, x1, y1, c, t) {
  t = t || 1;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) px(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function disc(cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
    if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
}
function ring(cx, cy, r, th, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d <= r && d > r - th) px(cx + x, cy + y, c);
  }
}
// filled triangle (scanline)
function tri(x0, y0, x1, y1, x2, y2, c) {
  const pts = [[x0, y0], [x1, y1], [x2, y2]].sort((a, b) => a[1] - b[1]);
  const [a, b, d] = pts;
  function edge(p, q, y) { return p[1] === q[1] ? p[0] : p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]); }
  for (let y = Math.ceil(a[1]); y <= Math.floor(d[1]); y++) {
    const xa = y < b[1] ? edge(a, b, y) : edge(b, d, y);
    const xb = edge(a, d, y);
    for (let x = Math.ceil(Math.min(xa, xb)); x <= Math.floor(Math.max(xa, xb)); x++) px(x, y, c);
  }
}
// filled convex polygon (list of [x,y])
function poly(points, c) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) {
        xs.push(p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
  }
}
function star(cx, cy, rO, rI, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  poly(pts, c);
}
// down arrow: shaft + head
function arrowDown(x, y, w, h, c) {
  const sw = Math.max(3, Math.round(w * 0.45));
  rect(x + Math.floor((w - sw) / 2), y, sw, Math.floor(h * 0.55), c);
  tri(x, y + Math.floor(h * 0.55), x + w, y + Math.floor(h * 0.55), x + Math.floor(w / 2), y + h, c);
}
// up-right arrow head at end of a line
function arrowHead(x, y, angDeg, size, c) {
  const a = angDeg * Math.PI / 180;
  const x1 = x - size * Math.cos(a - 0.45), y1 = y - size * Math.sin(a - 0.45);
  const x2 = x - size * Math.cos(a + 0.45), y2 = y - size * Math.sin(a + 0.45);
  tri(x, y, x1, y1, x2, y2, c);
}

// ---------- 5x7 bitmap font ----------
const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '\u00A3': ['00110', '01000', '01000', '11110', '01000', '01000', '11111'],
  '=': ['00000', '00000', '01110', '00000', '01110', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '\u00B7': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  '\u2192': ['00000', '00100', '00010', '11111', '00010', '00100', '00000'],
  '\u2014': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  '*': ['00000', '00100', '10101', '01110', '10101', '00100', '00000'],
  'x': ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
};
function charPitch(scale, track) { return 5 * scale + (track === undefined ? scale : track); }
function textWidth(str, scale, track) {
  return str.length * charPitch(scale, track) - (track === undefined ? scale : track);
}
function drawChar(ch, x, y, scale, c) {
  const g = FONT[ch];
  if (!g) { TRUNCATIONS++; return; }
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
    if (g[r][col] === '1') rect(x + col * scale, y + r * scale, scale, scale, c);
}
// opts: {track, maxW} — counts a truncation if text exceeds maxW
function text(str, x, y, scale, c, opts) {
  opts = opts || {};
  const track = opts.track === undefined ? scale : opts.track;
  const pitch = 5 * scale + track;
  if (opts.maxW !== undefined && textWidth(str, scale, track) > opts.maxW) TRUNCATIONS++;
  for (let i = 0; i < str.length; i++) drawChar(str[i], x + i * pitch, y, scale, c);
  return x + str.length * pitch;
}
function textCentered(str, cx, y, scale, c, opts) {
  const w = textWidth(str, scale, opts && opts.track);
  return text(str, Math.round(cx - w / 2), y, scale, c, opts);
}

// ---------- PNG encoder ----------
const CRC_TABLE = [];
(function () {
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c >>> 0;
  }
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    img.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- layout ----------
const HDR_H = 70;                 // header 0..70
const SCENE_Y0 = HDR_H, SCENE_Y1 = 290;   // hero scenes
const HEAD_Y = 294;               // hero headlines (scale 3, 3 lines, pitch 24)
const SUB_Y = 368;                // hero sub-lines (scale 1)
const WHY_Y = 390, WHY_H = 46;    // why-it-matters band (3 content lines)
const MID_SCENE_Y0 = 438, MID_SCENE_Y1 = 510;
const MID_HEAD_Y = 514;           // mid headlines (scale 2, 3 lines, pitch 16)
const MID_NUM_Y = 564;            // mid big numbers (scale 3)
const MID_SUB_Y = 592;            // mid sub-lines (scale 1)
const BRIEF_HDR_Y = 604;          // briefs region headers
const BRIEF_Y0 = 626, BRIEF_Y1 = 876;
const HON_Y = 882, HON_H = 68;    // honesty band
const MKT_Y = 954;                // markets strip
const SRC_Y = 974;                // sources line
const FTR_Y = 992;                // footer line

const HERO_W = 341;               // hero column width (341, 341, 342)
const MID_W = 170;                // mid column width (6 cols)
const COL_W = 200;                // briefs column width (5 cols)
const COL_X = [8, 212, 416, 620, 824];

// ---------- background ----------
rect(0, 0, W, H, C.paper);

// ---------- header ----------
rect(0, 0, W, HDR_H, C.navy);
text('THE WEDNESDAY WIRE', 16, 6, 6, C.white, { track: 6 });
text('WEDNESDAY 25 NOVEMBER 2026', 18, 52, 2, C.yellow, { track: 2 });
// red badge, top right
rect(826, 10, 182, 46, C.red);
textCentered('50 STORIES', 917, 20, 3, C.white, { track: 1 });

// ---------- HERO 1: tariffs (x 0..341) ----------
rect(0, SCENE_Y0, HERO_W, SCENE_Y1 - SCENE_Y0, C.sky);
// globe
disc(95, 178, 78, C.blue);
disc(70, 152, 22, C.green);
disc(122, 202, 26, C.green);
disc(108, 130, 14, C.green);
disc(60, 205, 12, C.green);
// brick wall
rect(176, 100, 144, 150, C.brown);
for (let y = 116; y < 250; y += 16) hline(176, 320, y, C.darkBrown, 2);
for (let y = 100; y < 250; y += 16) {
  const off = ((y - 100) / 16) % 2 === 0 ? 18 : 36;
  for (let x = 176 + off; x < 320; x += 36) vline(x, y, Math.min(y + 16, 250), C.darkBrown, 2);
}
// % tags on the wall
function tag(x, y, s) {
  const w = textWidth(s, 1, 1) + 12;
  rect(x, y, w, 16, C.darkBlue);
  text(s, x + 6, y + 4, 1, C.white, { track: 1 });
}
tag(186, 110, 'CHINA 20%');
tag(186, 140, 'VIETNAM 20%');
tag(186, 170, 'INDIA 17%');
tag(186, 200, 'EU 15%');
// red down arrow, right of the wall
arrowDown(322, 104, 16, 42, C.red);
// container ship at the foot of the wall — every container coloured
rect(176, 252, 146, 16, C.darkBlue);
rect(182, 232, 26, 20, C.red);
rect(210, 232, 26, 20, C.yellow);
rect(238, 232, 26, 20, C.green);
rect(266, 232, 26, 20, C.blue);
rect(294, 232, 26, 20, C.red);
rect(196, 214, 26, 18, C.green);
rect(224, 214, 26, 18, C.blue);
rect(252, 214, 26, 18, C.yellow);

// ---------- HERO 2: Cairo tanker fire (x 341..682) ----------
rect(HERO_W, SCENE_Y0, HERO_W, SCENE_Y1 - SCENE_Y0, C.paleSand);
// smoke cloud
disc(428, 108, 20, C.grey);
disc(452, 100, 24, C.grey);
disc(476, 110, 18, C.grey);
disc(448, 118, 20, C.grey);
// red toll banner
rect(352, 148, 216, 24, C.red);
textCentered('31 DEAD \u00B7 21 HURT', 460, 154, 2, C.white, { track: 1 });
// burnt-out cars with flames
function burntCar(x) {
  rect(x, 234, 46, 16, C.black);
  tri(x + 8, 234, x + 14, 218, x + 20, 234, C.orange);
  tri(x + 12, 234, x + 16, 224, x + 20, 234, C.yellow);
  tri(x + 26, 234, x + 32, 218, x + 38, 234, C.orange);
  tri(x + 30, 234, x + 34, 224, x + 38, 234, C.yellow);
}
burntCar(358); burntCar(428); burntCar(498);
// overturned tanker: wheels up, hazard diamond — body sits on the road
rect(576, 216, 96, 34, C.grey);
rect(576, 238, 96, 12, C.red);
disc(590, 208, 9, C.darkGrey); disc(590, 208, 4, C.grey);
disc(612, 208, 9, C.darkGrey); disc(612, 208, 4, C.grey);
disc(634, 208, 9, C.darkGrey); disc(634, 208, 4, C.grey);
disc(656, 208, 9, C.darkGrey); disc(656, 208, 4, C.grey);
// hazard diamond (white diamond, red border, red bar)
poly([[624, 217], [640, 233], [624, 249], [608, 233]], C.white);
poly([[624, 220], [637, 233], [624, 246], [611, 233]], C.red);
rect(621, 225, 6, 12, C.white);
rect(621, 239, 6, 4, C.white);
// ring road
rect(HERO_W, 252, HERO_W, 38, C.darkGrey);
for (let x = 352; x < 672; x += 28) rect(x, 268, 16, 4, C.white);

// ---------- HERO 3: Shenzhou-24 (x 682..1024) ----------
rect(682, SCENE_Y0, 342, SCENE_Y1 - SCENE_Y0, C.navy);
// stars (fixed pseudo-random positions)
for (let i = 0; i < 26; i++) {
  const sx = 692 + ((i * 137) % 320), sy = 78 + ((i * 89) % 200);
  rect(sx, sy, 2, 2, C.white);
}
// China flag
rect(700, 82, 64, 40, C.red);
star(714, 96, 8, 3, C.yellow);
star(732, 88, 4, 2, C.yellow); star(738, 100, 4, 2, C.yellow);
star(732, 112, 4, 2, C.yellow); star(722, 116, 4, 2, C.yellow);
// Pakistan flag
rect(780, 82, 64, 40, C.green);
rect(780, 82, 14, 40, C.white);
disc(822, 102, 11, C.white);
disc(826, 100, 9, C.green);
star(834, 100, 5, 2, C.white);
// rocket, flame contained in the scene
rect(902, 108, 26, 64, C.white);
tri(902, 108, 928, 108, 915, 84, C.red);
disc(915, 128, 6, C.blue);
tri(902, 172, 890, 190, 902, 178, C.red);
tri(928, 172, 940, 190, 928, 178, C.red);
tri(904, 172, 926, 172, 915, 196, C.orange);
tri(908, 172, 922, 172, 915, 188, C.yellow);
// Tiangong ring station
ring(968, 128, 30, 8, C.gold);
rect(938, 124, 60, 8, C.white);
rect(964, 98, 8, 60, C.white);
text('TIANGONG', 936, 268, 1, C.yellow, { track: 1 });
// three astronaut silhouettes
function astronaut(x) {
  disc(x + 7, 240, 7, C.white);
  rect(x, 248, 14, 30, C.white);
  rect(x - 3, 250, 4, 18, C.white);
  rect(x + 13, 250, 4, 18, C.white);
}
astronaut(716); astronaut(760); astronaut(804);

// ---------- hero headlines ----------
function heroHead(col, lines) {
  const x = col * HERO_W + 12;
  for (let i = 0; i < lines.length; i++) text(lines[i], x, HEAD_Y + i * 24, 3, C.ink, { track: 1, maxW: HERO_W - 24 });
}
heroHead(0, ['TRUMP PROPOSES', 'NEW TARIFFS ON', '14 ECONOMIES']);
heroHead(1, ['CAIRO TANKER FIRE', 'KILLS 31']);
heroHead(2, ['CHINA SENDS', 'FIRST PAKISTANI', 'INTO ORBIT']);
// hero sub-lines
text('CHINA 20% (40% IF TRUCE FAILS)', 12, SUB_Y, 1, C.midGrey, { track: 1, maxW: HERO_W - 24 });
text('VIETNAM 20%/35% \u00B7 INDIA 17%/25% \u00B7 EU 15%', 12, SUB_Y + 9, 1, C.midGrey, { track: 1, maxW: HERO_W - 24 });

// ---------- why-it-matters band ----------
rect(0, WHY_Y, W, WHY_H, C.paleYellow);
vline(HERO_W, WHY_Y, WHY_Y + WHY_H, C.cream, 2);
vline(682, WHY_Y, WHY_Y + WHY_H, C.cream, 2);
function why(col, lines) {
  const x = col * HERO_W + 12;
  text('WHY IT MATTERS', x, WHY_Y + 4, 1, C.red, { track: 1 });
  for (let i = 0; i < lines.length; i++)
    text(lines[i], x, WHY_Y + 15 + i * 10, 1, C.ink, { track: 1, maxW: HERO_W - 24 });
}
why(0, [
  'US HOUSEHOLDS PAY $900 A YEAR UNDER NEW DUTIES',
  'HEARING 25 JAN \u00B7 TRUCE EXPIRES 10 JAN',
  '16 PARTNERS PROBED \u00B7 MEXICO, NORWAY EXCLUDED',
]);
why(1, [
  '27 VEHICLES BURNED, RING ROAD SHUT AFTER BLAST',
  'CAUSE: CAR HIT TANKER; IT OVERTURNED, CAUGHT FIRE',
  'RING ROAD, GIZA \u00B7 WED NIGHT',
]);
why(2, [
  'FIRST FOREIGNER ABOARD TIANGONG STATION',
  'CREW: TANG HONGBO \u00B7 WU YI \u00B7 ZEESHAN ALI',
  'LAUNCH 00:18 UTC \u00B7 DOCKED 03:56 UTC',
]);

// ---------- MIDS (6 columns, x = i*171) ----------
const MID_X = [0, 171, 342, 513, 684, 855];
// M1: Macy's balloon — highlight moved to the upper-right, clear of the eyes
rect(MID_X[0], MID_SCENE_Y0, MID_W, MID_SCENE_Y1 - MID_SCENE_Y0, C.sky);
hline(10, 70, 448, [168, 200, 224], 2);
hline(100, 160, 462, [168, 200, 224], 2);
hline(20, 80, 486, [168, 200, 224], 2);
disc(85, 472, 30, C.red);
disc(73, 464, 2, C.black); disc(93, 464, 2, C.black); // eyes (4x4 via rect below)
rect(71, 462, 4, 4, C.black); rect(91, 462, 4, 4, C.black);
line(78, 478, 82, 481, C.black, 1); line(82, 481, 88, 482, C.black, 1);
line(88, 482, 94, 481, C.black, 1); line(94, 481, 98, 478, C.black, 1);
disc(106, 450, 7, C.pink); // highlight, upper-right — clear of both eyes
line(72, 500, 66, 510, C.black, 2);
line(85, 502, 85, 510, C.black, 2);
line(98, 500, 104, 510, C.black, 2);
// M2: Kospi chip + red down arrow
rect(MID_X[1], MID_SCENE_Y0, MID_W, MID_SCENE_Y1 - MID_SCENE_Y0, C.paper);
for (let y = 452; y <= 488; y += 8) { rect(194, y, 6, 4, C.grey); rect(270, y, 6, 4, C.grey); }
rect(200, 448, 70, 44, C.darkBlue);
rect(222, 460, 26, 20, C.blue);
rect(228, 465, 14, 10, C.sky);
arrowDown(300, 440, 16, 62, C.red);
// M3: Dow V-chart — RECORD label top-left, clear of the arrow
rect(MID_X[2], MID_SCENE_Y0, MID_W, MID_SCENE_Y1 - MID_SCENE_Y0, C.lightGreen);
hline(350, 505, 480, [180, 200, 180], 1);
text('RECORD', 352, 442, 1, C.darkGreen, { track: 1 });
line(362, 458, 425, 496, C.red, 3);
line(425, 496, 492, 446, C.green, 3);
arrowHead(492, 446, -37, 13, C.green);
// M4: UK house + bill
rect(MID_X[3], MID_SCENE_Y0, MID_W, MID_SCENE_Y1 - MID_SCENE_Y0, C.paleSand);
tri(520, 470, 600, 470, 560, 440, C.brown);
rect(528, 470, 64, 36, C.cream);
rect(555, 488, 14, 18, C.brown);
rect(536, 478, 12, 12, C.sky);
rect(614, 444, 52, 46, C.red);
rect(616, 446, 48, 42, C.white);
text('!', 634, 452, 2, C.red, { track: 1 });
tri(640, 482, 656, 482, 648, 470, C.orange);
// M5: Houthis refinery + drone with red X, clear of the flare
rect(MID_X[4], MID_SCENE_Y0, MID_W, MID_SCENE_Y1 - MID_SCENE_Y0, C.lightGrey);
disc(712, 452, 10, C.black); disc(726, 446, 12, C.black); disc(740, 454, 9, C.black);
rect(700, 470, 34, 36, C.grey);
rect(740, 478, 28, 28, C.grey);
rect(776, 452, 12, 54, C.darkGrey);
rect(800, 446, 10, 60, C.darkGrey);
tri(794, 446, 816, 446, 805, 430, C.orange);
tri(799, 446, 811, 446, 805, 436, C.yellow);
rect(830, 458, 16, 8, C.black); // drone body, bigger so it reads under the X
rect(824, 454, 5, 2, C.black); rect(847, 454, 5, 2, C.black);
rect(824, 468, 5, 2, C.black); rect(847, 468, 5, 2, C.black);
line(832, 452, 846, 472, C.red, 2);
line(846, 452, 832, 472, C.red, 2);
// M6: Netanyahu courthouse + gavel
rect(MID_X[5], MID_SCENE_Y0, MID_W, MID_SCENE_Y1 - MID_SCENE_Y0, C.sky);
tri(885, 462, 995, 462, 940, 438, C.navy);
rect(894, 462, 10, 40, C.white);
rect(935, 462, 10, 40, C.white);
rect(976, 462, 10, 40, C.white);
rect(885, 502, 110, 6, C.white);
rect(986, 440, 24, 10, C.brown);
line(998, 450, 1008, 468, C.brown, 3);
// mid dividers
for (let i = 1; i < 6; i++) vline(MID_X[i] - 1, MID_SCENE_Y0, MID_SCENE_Y1, C.paper, 1);

// mid headlines / big numbers / sub-lines
const MIDS = [
  { head: ["MACY'S 100TH", 'PARADE', 'POSTPONED'], num: '60 MPH', numC: C.red, sub: 'GUSTS \u00B7 SAT 28 NOV' },
  { head: ['KOSPI CRASHES', '6.2% AI FEARS', 'RETURN'], num: '-6.2%', numC: C.red, sub: 'SAMSUNG -9.9% HYNIX -11.1%' },
  { head: ['DOW ERASES', '1,100-PT DROP', 'RECORD CLOSE'], num: '50,183', numC: C.green, sub: '-1,100 \u2192 +164 \u00B7 +0.33%' },
  { head: ['UK ENERGY CAP', 'JUMPS 26% TO', '\u00A32,166 A YEAR'], num: '+26%', numC: C.red, sub: '\u00A31,723 \u2192 \u00A32,166 \u00B7 +\u00A3443' },
  { head: ['HOUTHIS CLAIM', 'REFINERY HIT', '- RAS TANURA'], num: '550K BPD', numC: C.ink, sub: 'BRENT $93.60 +2.41%' },
  { head: ['JUDGES: DROP', 'NETANYAHU', 'BRIBERY CASE'], num: 'CASE 4000', numC: C.ink, sub: 'RECOMMEND, NOT A RULING' },
];
for (let i = 0; i < 6; i++) {
  const x = MID_X[i] + 8;
  for (let j = 0; j < 3; j++)
    text(MIDS[i].head[j], x, MID_HEAD_Y + j * 16, 2, C.ink, { track: 1, maxW: MID_W - 16 });
  text(MIDS[i].num, x, MID_NUM_Y, 3, MIDS[i].numC, { track: 1, maxW: MID_W - 16 });
  text(MIDS[i].sub, x, MID_SUB_Y, 1, C.midGrey, { track: 1, maxW: MID_W - 12 });
}

// ---------- BRIEFS (41, 5 region columns) ----------
const BRIEFS = [
  { name: 'MIDDLE EAST', color: C.red, items: [
    ['BOGOR GOLD MINE FLOODS', '9 DEAD, 17 TRAPPED, 100M SHAFT'],
    ['SUDAN DRONE STRIKES', '19 KILLED IN BLUE NILE'],
    ['GAZA STRIKE KILLS HAMAS', 'OFFICIAL, WIFE, 2 DAUGHTERS'],
    ['US: CITIZENS LEAVE IRAN', 'TENSIONS RISE'],
    ['UKRAINE HITS RUSSIAN SHIP', 'CORVETTE OFF BENGHAZI'],
    ['IRAQ ORDERS TROOPS TO BORDERS', 'OIL OVERSIGHT'],
    ['COALITION HITS HODEIDAH', 'MISSILE PLATFORM DESTROYED'],
    ['IRAN WEAPONS CLAIM', 'CHEMICAL ARMS ALLEGED'],
    ['CHEMICAL WEAPONS', '30+ NATIONS: RUSSIA, STOP'],
    ['INDIA CONDEMNS RIYADH HIT', '11 WOUNDED, 2 INDIANS'],
  ]},
  { name: 'ASIA-PACIFIC', color: C.teal, items: [
    ['SOLOMON ISLANDS TREATY', 'AUSTRALIA TOP SECURITY PARTNER'],
    ['BANGLADESH WAGE +36%', '17,000 TAKAS MINIMUM'],
    ['CHINA PROBES SHANGHAI CHIEF', '4TH TOP LEADER SINCE 2025'],
    ['N. KOREA EXPELS SWISS ENVOY', 'OFFICE TO CLOSE IN 48H'],
    ['HONG KONG: 1 YEAR ON', '168 NAMES READ (ANNIVERSARY)'],
    ['JAPAN: DATA-CENTRE REVOLT', 'AI POWER BOOM SPARKS ROW'],
    ['TAIWAN VOTES SATURDAY', 'AI FAKES FEARED'],
    ['INDIA-MALAYSIA DRILL OPENS', 'HARIMAU SHAKTI IN IPOH'],
    ['CANADA TIGHTENS STUDENT RULES', 'FOREIGN-STUDENT CAPS'],
  ]},
  { name: 'EUROPE', color: C.purple, items: [
    ['SPAIN VOTES SUNDAY', 'FAR RIGHT MAY ENTER GOVT'],
    ['MI5 WARNS RUSSIAN SABOTAGE', 'UK FIRMS ON ALERT'],
    ['POLAND NO-FLY ZONE', 'NEAR UKRAINE BORDER'],
    ['UK AI WARNING', 'WATCHES VS META MUSE AI'],
    ['SARKOZY TO STAND TRIAL 2027', 'WITNESS-TAMPERING CASE'],
    ['LONDON MUSEUM REOPENS', 'VICTORIAN HALL SATURDAY'],
  ]},
  { name: 'AMERICAS', color: C.green, items: [
    ['MISSISSIPPI PLANE CRASH', '6 DEAD; FAMILY OF 6'],
    ['IOWA BLAST: 4,400 KG', 'NO LEAD FOUND'],
    ['VENEZUELA DEBT: $237.5BN', '242% OF GDP (DISCLOSED TUE)'],
    ['CIA NETWORK HACKED', 'OSINT HIT, CHINA SUSPECTED'],
    ['DOJ CHARGES 800+ IN SCAMS', '400 CASES WORLDWIDE'],
    ['NSA NETWORK DOWN FOR DAYS', 'BAD UPDATE, NOT A HACK'],
    ['TRUMP: FUNDING IRAN WAR PREP', 'THROUGH JANUARY'],
    ['MEASLES', 'CDC: 9 US DEATHS IN 2026'],
  ]},
  { name: 'GLOBAL & SPORT', color: C.rust, items: [
    ['UKRAINE NEEDS EUR 115BN', 'EUR 25BN GAP FOR 2027'],
    ['RUSSIAN WAR DEAD 490,334+', 'LEAKED DATA, UP TO 700K'],
    ['LANDMINE DEATHS 5-YEAR HIGH', 'GLOBAL TOLL RISES'],
    ['WHO: END CUBA FUEL BLOCKADE', 'CHIEF URGES US'],
    ['MALAYSIA RETURNS REFUGEES', 'THOUSANDS TO MYANMAR'],
    ['AIRPORTS COURT PRIVATE CASH', 'EXPANSION FUNDING'],
    ['NBA: NETS 104, BUCKS 97', 'RANDLE 28 PTS, CUP WIN'],
    ['MLB SUES PLAYERS\' UNION', '38-PAGE LOCKOUT COMPLAINT'],
  ]},
];
for (let c = 0; c < 5; c++) {
  const col = BRIEFS[c], x = COL_X[c];
  text(col.name, x, BRIEF_HDR_Y, 2, col.color, { track: 1, maxW: COL_W - 4 });
  hline(x, x + COL_W - 8, BRIEF_HDR_Y + 16, col.color, 2);
  const n = col.items.length;
  const pitch = Math.min(30, Math.floor((BRIEF_Y1 - BRIEF_Y0 - 18) / (n - 1)));
  for (let i = 0; i < n; i++) {
    const y = BRIEF_Y0 + i * pitch;
    text(col.items[i][0], x, y, 1, C.ink, { track: 1, maxW: COL_W - 4 });
    text(col.items[i][1], x, y + 9, 1, C.midGrey, { track: 1, maxW: COL_W - 4 });
  }
}

// ---------- honesty band + date check (navy runs to the bottom edge) ----------
rect(0, HON_Y, W, H - HON_Y, C.navy);
text('CLAIMED VS CONFIRMED', 12, HON_Y + 8, 2, C.yellow, { track: 1 });
text('CAIRO 31/21 CONFIRMED NEXT MORNING \u00B7 BOGOR 9/17 IS THE 25 NOV FIGURE', 12, HON_Y + 30, 1, C.white, { track: 1, maxW: 740 });
text('HONG KONG FIRE IS 2025 ANNIVERSARY, NOT A NEW FIRE \u00B7 VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25', 12, HON_Y + 39, 1, C.white, { track: 1, maxW: 740 });
// date-check box
rect(770, HON_Y + 8, 242, 52, C.yellow);
rect(772, HON_Y + 10, 238, 48, C.navy);
textCentered('DATE CHECK:', 891, HON_Y + 14, 2, C.yellow, { track: 1 });
textCentered('WED 25 NOV 2026', 891, HON_Y + 32, 2, C.yellow, { track: 1 });

// ---------- markets strip / sources / footer ----------
text('DOW 50,182.95 +0.33% \u00B7 S&P 7,182.78 -0.25% \u00B7 NASDAQ 23,585.80 -0.62% \u00B7 KOSPI -6.16% \u00B7 BRENT $93.60 \u00B7 GOLD $3,598.10 \u00B7 BITCOIN $60,200.94 \u00B7 10-YR 4.85%', 12, MKT_Y, 1, C.white, { track: 1, maxW: W - 24 });
text('SOURCES: REUTERS \u00B7 AP \u00B7 BBC \u00B7 NYT \u00B7 ESPN \u00B7 OFGEM \u00B7 PIB \u00B7 AL JAZEERA \u00B7 MARKETS CLOSED THU 26 NOV (THANKSGIVING) \u00B7 FRI HALF-DAY', 12, SRC_Y, 1, [190, 190, 190], { track: 1, maxW: W - 24 });
textCentered('50 STORIES \u00B7 TARIFF LEAD \u00B7 WHY IT MATTERS \u00B7 EVERY STORY DATE-CHECKED FOR WED 25 NOV 2026', 512, FTR_Y, 1, [160, 160, 160], { track: 1 });

// ---------- run ----------
function main() {
  let outDir = '/output';
  const ai = process.argv.indexOf('--output');
  if (ai >= 0 && process.argv[ai + 1]) outDir = process.argv[ai + 1];
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  const p = path.join(outDir, 'entry.png');
  fs.writeFileSync(p, png);
  console.log('TRUNCATIONS: ' + TRUNCATIONS);
  console.log('WROTE ' + png.length + ' bytes to ' + p);
}
main();
