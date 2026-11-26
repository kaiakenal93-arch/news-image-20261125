// news-image-20261125 — "Sum up 25 November's world news in one image"
// Fresh build. Node 22+, standard library only, no network, no dependencies.
// Own 5x7 bitmap font + own PNG encoder (node:zlib). Deterministic: two runs
// write byte-identical entry.png (1024x1024, <= 1 MiB).
// Facts ONLY from research-25nov.md (50 stories: 3 heroes + 6 mids + 41 briefs).
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 4);
let TRUNCATIONS = 0;

// ---------- palette ----------
type RGB = [number, number, number];
const PAPER: RGB = [250, 246, 238];
const CARD: RGB = [255, 255, 255];
const INK: RGB = [18, 32, 54];
const NAVY: RGB = [15, 42, 74];
const NAVY2: RGB = [23, 58, 96];
const RED: RGB = [192, 57, 43];
const RED2: RGB = [231, 76, 60];
const ORANGE: RGB = [230, 126, 34];
const GOLD: RGB = [212, 160, 23];
const GOLDL: RGB = [243, 212, 90];
const BLUE: RGB = [36, 113, 163];
const BLUE2: RGB = [93, 173, 226];
const GREEN: RGB = [30, 132, 73];
const GREENL: RGB = [88, 214, 141];
const GRAY: RGB = [93, 109, 126];
const GRAYL: RGB = [214, 219, 224];
const SKY: RGB = [214, 234, 248];
const SKYD: RGB = [174, 214, 241];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const CREAM: RGB = [253, 245, 230];
const BROWN: RGB = [120, 72, 20];

// ---------- canvas primitives ----------
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
}
function rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c); fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c); fillRect(x + w - t, y, t, h, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void { fillRect(x, y, w, t, c); }
function vline(x: number, y: number, h: number, c: RGB, t = 1): void { fillRect(x, y, t, h, c); }
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let n = 0; n < 4000; n++) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = -r; yy <= r; yy++) {
    const hw = Math.floor(Math.sqrt(r * r - yy * yy));
    fillRect(cx - hw, cy + yy, hw * 2 + 1, 1, c);
  }
}
function circleOutline(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    fillRect(Math.round(cx + r * Math.cos(rad)) - 1, Math.round(cy + r * Math.sin(rad)) - 1, t, t, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let yy = -ry; yy <= ry; yy++) {
    const hw = Math.floor(rx * Math.sqrt(1 - (yy * yy) / (ry * ry)));
    fillRect(cx - hw, cy + yy, hw * 2 + 1, 1, c);
  }
}
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
    const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
    const cc = 1 - a - b;
    if (a >= 0 && b >= 0 && cc >= 0) px(x, y, c);
  }
}
// diamond (rotated square) centred at cx,cy with radius r
function diamond(cx: number, cy: number, r: number, c: RGB): void {
  fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r, c);
  fillTriangle(cx, cy - r, cx, cy + r, cx - r, cy, c);
}

// ---------- 5x7 bitmap font (own work) ----------
// Each glyph: 7 rows of 5 chars, '#' = on.
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
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
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '£': ['00110', '01001', '01000', '11110', '01000', '01000', '01111'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '*': ['00000', '10101', '01110', '10101', '00000', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '→': ['00000', '00100', '00010', '11111', '00010', '00100', '00000'],
  '~': ['00000', '00000', '00000', '01001', '10110', '00000', '00000'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  '×': ['00000', '10001', '01010', '00100', '01010', '10001', '00000'],
};
const FALLBACK = FONT['?'];

// ---------- text ----------
function charW(scale: number): number { return 6 * scale; }
function textW(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * charW(scale) - scale;
}
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] || FALLBACK;
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === '1') fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): number {
  let cx = x;
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    drawChar(cx, y, up[i], scale, c);
    cx += charW(scale);
  }
  return cx - x - scale;
}
function textCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textW(s, scale) / 2), y, s, scale, c);
}
// Greedy word wrap. Returns lines that fit maxW. Hard-truncates an over-long
// single word and counts it (goal: TRUNCATIONS stays 0).
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur === '' ? w : cur + ' ' + w;
    if (textW(test, scale) <= maxW) { cur = test; continue; }
    if (cur !== '') lines.push(cur);
    if (textW(w, scale) > maxW) {
      let t = w;
      while (t.length > 3 && textW(t + '...', scale) > maxW) t = t.slice(0, -1);
      lines.push(t + '...');
      TRUNCATIONS++;
      cur = '';
    } else {
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
function drawLines(x: number, y: number, lines: string[], scale: number, c: RGB, lh: number): number {
  let cy = y;
  for (const ln of lines) { drawText(x, cy, ln, scale, c); cy += lh; }
  return cy;
}
// Fit text into one line of maxW at scale; shrink scale down to 1 if needed,
// then truncate (counted). Returns the scale used.
function fitLine(x: number, y: number, s: string, scale: number, maxW: number, c: RGB): number {
  let sc = scale;
  while (sc > 1 && textW(s, sc) > maxW) sc--;
  if (textW(s, sc) > maxW) {
    let t = s;
    while (t.length > 3 && textW(t + '...', sc) > maxW) t = t.slice(0, -1);
    drawText(x, y, t + '...', sc, c);
    TRUNCATIONS++;
  } else {
    drawText(x, y, s, sc, c);
  }
  return sc;
}

// ---------- PNG encoder (own, via node:zlib) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- scene helpers ----------
function chip(x: number, y: number, s: string, scale: number, bg: RGB, fg: RGB): number {
  const w = textW(s, scale) + 10 * scale;
  fillRect(x, y, w, 7 * scale + 6, bg);
  drawText(x + 5 * scale, y + 3, s, scale, fg);
  return w;
}
function tagBox(x: number, y: number, s: string, bg: RGB, fg: RGB): number {
  return chip(x, y, s, 1, bg, fg);
}

// H1 scene: tariff wall + globe + ship (area x,y,w,h)
function sceneTariffs(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  // sun
  fillCircle(x + 288, y + 26, 14, GOLDL);
  // globe (left)
  const gx = x + 66, gy = y + 88, gr = 52;
  fillCircle(gx, gy, gr, BLUE);
  fillCircle(gx - 18, gy - 14, 16, GREEN);
  fillCircle(gx + 16, gy + 8, 20, GREEN);
  fillCircle(gx + 22, gy - 24, 10, GREEN);
  circleOutline(gx, gy, gr, NAVY, 3);
  hline(gx - gr, gy, gr * 2, WHITE, 2);
  vline(gx, gy - gr, gr * 2, WHITE, 2);
  // tariff wall (right): brick wall
  const wx = x + 138, wy = y + 22, ww = w - 150, wh = 118;
  fillRect(wx, wy, ww, wh, [122, 106, 96]);
  for (let r = 0; r < 6; r++) {
    hline(wx, wy + r * 20, ww, [90, 76, 66], 2);
    for (let cix = 0; cix < 4; cix++) vline(wx + ((r % 2) * 24) + cix * 48, wy + r * 20, 20, [90, 76, 66], 2);
  }
  fillRect(wx, wy, ww, 6, RED);
  // % tags on the wall
  chip(wx + 8, wy + 16, 'CHINA 20%', 1, RED, WHITE);
  chip(wx + 8, wy + 40, 'VIETNAM 20%', 1, NAVY, WHITE);
  chip(wx + 8, wy + 64, 'INDIA 17%', 1, NAVY, WHITE);
  chip(wx + 8, wy + 88, 'EU 15%', 1, NAVY, WHITE);
  // red down arrow (top right of wall)
  fillTriangle(wx + ww - 26, wy + 118, wx + ww - 40, wy + 92, wx + ww - 12, wy + 92, RED2);
  fillRect(wx + ww - 30, wy + 78, 8, 16, RED2);
  // container ship at the foot
  const sy = y + h - 16;
  fillRect(x + 12, sy, 180, 8, [52, 73, 94]);
  fillRect(x + 12, sy - 6, 180, 6, INK);
  fillRect(x + 30, sy - 22, 26, 16, RED2);
  fillRect(x + 60, sy - 22, 26, 16, GOLD);
  fillRect(x + 90, sy - 22, 26, 16, BLUE2);
  fillRect(x + 120, sy - 22, 26, 16, GREENL);
  fillRect(x + 206, sy - 14, 22, 14, CARD);
  fillRect(x + 210, sy - 20, 4, 6, INK);
  // sea
  fillRect(x, y + h - 4, w, 4, BLUE);
}

// H2 scene: overturned tanker, wheels up, flames, burnt cars
function sceneTanker(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [250, 235, 215]);
  // smoke plume
  fillCircle(x + 70, y + 30, 16, [120, 120, 120]);
  fillCircle(x + 92, y + 18, 20, [100, 100, 100]);
  fillCircle(x + 118, y + 32, 14, [130, 130, 130]);
  fillCircle(x + 150, y + 16, 18, [110, 110, 110]);
  // city skyline (far)
  fillRect(x + 8, y + 96, 26, 40, [160, 160, 160]);
  fillRect(x + 40, y + 84, 20, 52, [150, 150, 150]);
  fillRect(x + 250, y + 90, 24, 46, [160, 160, 160]);
  fillRect(x + 280, y + 100, 30, 36, [150, 150, 150]);
  // road
  fillRect(x, y + 136, w, h - 136, [70, 70, 70]);
  hline(x, y + 136, w, WHITE, 2);
  for (let d = 0; d < 8; d++) fillRect(x + 10 + d * 42, y + 152, 22, 3, GOLDL);
  // burnt-out cars in a row
  for (let i = 0; i < 3; i++) {
    const cx0 = x + 12 + i * 46;
    fillRect(cx0, y + 118, 38, 18, [30, 30, 30]);
    fillRect(cx0 + 6, y + 110, 26, 10, [20, 20, 20]);
    fillTriangle(cx0 + 8, y + 110, cx0 + 16, y + 96, cx0 + 24, y + 110, ORANGE);
  }
  // overturned tanker body (cylinder lying on its side, wheels UP)
  const bx = x + 168, by = y + 96, bw = 138, bh = 40;
  fillRect(bx, by, bw, bh, [220, 220, 220]);
  rect(bx, by, bw, bh, INK, 2);
  // tank ribs
  for (let r = 1; r < 5; r++) vline(bx + r * 26, by, bh, GRAY, 2);
  // wheels on TOP (overturned)
  for (let i = 0; i < 4; i++) {
    fillCircle(bx + 14 + i * 36, by - 8, 9, BLACK);
    fillCircle(bx + 14 + i * 36, by - 8, 4, GRAYL);
  }
  // cab, tipped over at left end
  fillRect(bx - 34, by + 6, 34, 30, RED2);
  rect(bx - 34, by + 6, 34, 30, INK, 2);
  fillRect(bx - 28, by + 12, 12, 10, SKYD);
  // red hazard diamond on the tank
  diamond(bx + 66, by + 20, 16, RED);
  diamond(bx + 66, by + 20, 11, WHITE);
  fillRect(bx + 63, by + 13, 6, 14, RED);
  fillRect(bx + 63, by + 29, 6, 3, RED);
  // flames above the tank
  fillTriangle(bx + 10, by - 2, bx + 26, by - 44, bx + 42, by - 2, ORANGE);
  fillTriangle(bx + 46, by - 2, bx + 62, by - 52, bx + 78, by - 2, [255, 180, 40]);
  fillTriangle(bx + 82, by - 2, bx + 96, by - 40, bx + 112, by - 2, ORANGE);
  fillTriangle(bx + 116, by - 2, bx + 128, by - 34, bx + 138, by - 2, [255, 180, 40]);
  // toll tag
  chip(x + 12, y + 12, '31 DEAD · 21 HURT', 1, RED, WHITE);
}

// H3 scene: rocket + station ring + flags (space)
function sceneRocket(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  // stars
  const stars: Array<[number, number]> = [[20, 18], [60, 40], [120, 12], [200, 26], [260, 14], [300, 44], [30, 70], [240, 70], [160, 8], [90, 60]];
  for (const [sx, sy] of stars) fillRect(x + sx, y + sy, 3, 3, WHITE);
  // station ring (upper right)
  const rx = x + 232, ry = y + 52;
  circleOutline(rx, ry, 34, GOLDL, 3);
  circleOutline(rx, ry, 22, WHITE, 2);
  fillRect(rx - 52, ry - 4, 104, 8, GOLDL);
  fillRect(rx - 8, ry - 8, 16, 16, WHITE);
  // capsule docking
  fillRect(rx - 66, ry - 6, 14, 12, CARD);
  // flags (drawn): China top-left, Pakistan top-right
  // China: red, yellow stars
  fillRect(x + 14, y + 12, 44, 28, RED);
  fillCircle(x + 24, y + 22, 4, GOLDL);
  fillCircle(x + 36, y + 18, 2, GOLDL);
  fillCircle(x + 40, y + 24, 2, GOLDL);
  fillCircle(x + 36, y + 30, 2, GOLDL);
  // Pakistan: green, white stripe + crescent
  fillRect(x + 64, y + 12, 44, 28, GREEN);
  fillRect(x + 64, y + 12, 10, 28, WHITE);
  fillCircle(x + 90, y + 26, 8, WHITE);
  fillCircle(x + 93, y + 26, 7, GREEN);
  fillCircle(x + 99, y + 20, 2, WHITE);
  // rocket (centre, rising)
  const rkx = x + 138, rky = y + 78;
  fillRect(rkx - 16, rky, 32, 78, WHITE);
  rect(rkx - 16, rky, 32, 78, INK, 2);
  fillTriangle(rkx - 16, rky, rkx, rky - 30, rkx + 16, rky, RED2);
  fillRect(rkx - 16, rky + 30, 32, 10, RED2);
  fillRect(rkx - 26, rky + 46, 10, 34, RED2);
  fillRect(rkx + 16, rky + 46, 10, 34, RED2);
  fillCircle(rkx, rky + 18, 5, BLUE);
  // flame
  fillTriangle(rkx - 12, rky + 78, rkx, rky + 118, rkx + 12, rky + 78, ORANGE);
  fillTriangle(rkx - 6, rky + 78, rkx, rky + 104, rkx + 6, rky + 78, [255, 220, 60]);
  // launch pad / ground
  fillRect(x, y + h - 10, w, 10, [60, 60, 60]);
  // three astronaut silhouettes (corner)
  for (let i = 0; i < 3; i++) {
    const ax = x + 16 + i * 22;
    fillCircle(ax + 6, y + h - 34, 6, WHITE);
    fillRect(ax, y + h - 28, 12, 16, WHITE);
  }
  chip(x + 210, y + h - 30, 'TIANGONG', 1, NAVY2, GOLDL);
}

// MID scenes (161x90 area)
function sceneBalloon(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  // wind lines
  for (let i = 0; i < 3; i++) {
    hline(x + 8, y + 14 + i * 12, 34, WHITE, 2);
    hline(x + w - 44, y + 30 + i * 12, 34, WHITE, 2);
  }
  // character balloon: rounded body with face, held down by ropes
  const bx = x + w / 2, by = y + 34;
  fillEllipse(bx, by, 34, 28, RED2);
  fillEllipse(bx, by - 4, 22, 16, [255, 120, 110]);
  fillCircle(bx - 10, by - 6, 3, INK);
  fillCircle(bx + 10, by - 6, 3, INK);
  fillTriangle(bx - 6, by + 4, bx + 6, by + 4, bx, by + 12, INK);
  // ropes to ground
  line(bx - 24, by + 24, bx - 34, y + h - 8, INK, 2);
  line(bx + 24, by + 24, bx + 34, y + h - 8, INK, 2);
  line(bx, by + 28, bx, y + h - 8, INK, 2);
  fillRect(x, y + h - 6, w, 6, GREEN);
}
function sceneKospi(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [253, 240, 238]);
  // chip at bottom
  fillRect(x + 18, y + h - 30, 34, 24, INK);
  for (let i = 0; i < 4; i++) {
    fillRect(x + 22 + i * 8, y + h - 36, 3, 6, GRAY);
    fillRect(x + 22 + i * 8, y + h - 6, 3, 6, GRAY);
  }
  fillRect(x + 26, y + h - 24, 18, 12, BLUE2);
  // steep falling red line
  line(x + 12, y + 10, x + 52, y + 26, RED2, 3);
  line(x + 52, y + 26, x + 92, y + 52, RED2, 3);
  line(x + 92, y + 52, x + 138, y + 76, RED2, 3);
  fillTriangle(x + 138, y + 76, x + 128, y + 70, x + 128, y + 80, RED2);
  // grid
  hline(x + 8, y + 30, w - 16, GRAYL, 1);
  hline(x + 8, y + 58, w - 16, GRAYL, 1);
}
function sceneDow(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [238, 245, 238]);
  // record dashed line
  for (let d = 0; d < 14; d++) fillRect(x + 8 + d * 11, y + 14, 6, 2, GOLD);
  // V chart: plunge red, recovery green
  line(x + 10, y + 18, x + 62, y + 74, RED2, 3);
  line(x + 62, y + 74, x + 148, y + 20, GREEN, 3);
  fillTriangle(x + 148, y + 20, x + 138, y + 16, x + 138, y + 24, GREEN);
  // baseline
  hline(x + 8, y + h - 10, w - 16, GRAY, 2);
}
function sceneEnergy(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, CREAM);
  // house
  fillRect(x + 34, y + 34, 62, 44, [190, 150, 110]);
  fillTriangle(x + 28, y + 34, x + 65, y + 12, x + 102, y + 34, RED2);
  fillRect(x + 58, y + 56, 14, 22, NAVY);
  fillRect(x + 42, y + 44, 12, 10, SKYD);
  // rising meter / bill
  fillRect(x + 108, y + 22, 34, 52, WHITE);
  rect(x + 108, y + 22, 34, 52, INK, 2);
  fillCircle(x + 125, y + 36, 8, RED2);
  line(x + 125, y + 36, x + 131, y + 30, WHITE, 2);
  hline(x + 114, y + 52, 22, GRAY, 2);
  hline(x + 114, y + 60, 22, GRAY, 2);
  hline(x + 114, y + 68, 14, GRAY, 2);
  // flame
  fillTriangle(x + 20, y + 70, x + 26, y + 52, x + 32, y + 70, ORANGE);
}
function sceneRefinery(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [240, 238, 232]);
  // black smoke column
  fillCircle(x + 120, y + 14, 12, [40, 40, 40]);
  fillCircle(x + 112, y + 26, 14, [50, 50, 50]);
  fillCircle(x + 126, y + 38, 12, [40, 40, 40]);
  fillCircle(x + 116, y + 52, 10, [60, 60, 60]);
  // towers
  fillRect(x + 16, y + 34, 16, 48, GRAY);
  fillRect(x + 40, y + 22, 18, 60, [100, 100, 100]);
  fillRect(x + 66, y + 40, 14, 42, GRAY);
  fillRect(x + 88, y + 30, 20, 52, [100, 100, 100]);
  fillTriangle(x + 40, y + 22, x + 49, y + 8, x + 58, y + 22, [100, 100, 100]);
  fillRect(x + 8, y + 82, 150, 6, INK);
  // oil barrel
  fillRect(x + 128, y + 62, 20, 20, BLUE);
  rect(x + 128, y + 62, 20, 20, INK, 1);
  // drone crossed out (intercepted)
  fillRect(x + 122, y + 18, 26, 4, INK);
  fillRect(x + 133, y + 8, 4, 24, INK);
  fillCircle(x + 122, y + 20, 3, INK);
  fillCircle(x + 148, y + 20, 3, INK);
  line(x + 116, y + 6, x + 154, y + 34, RED2, 3);
  line(x + 154, y + 6, x + 116, y + 34, RED2, 3);
}
function sceneCourt(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [238, 240, 245]);
  // courthouse
  fillTriangle(x + 30, y + 14, x + 80, y + 2, x + 130, y + 14, NAVY);
  fillRect(x + 30, y + 14, 100, 6, NAVY);
  for (let i = 0; i < 4; i++) fillRect(x + 36 + i * 26, y + 20, 8, 46, CARD);
  fillRect(x + 30, y + 66, 100, 8, NAVY);
  fillRect(x + 24, y + 74, 112, 6, GRAY);
  // gavel
  fillRect(x + 118, y + 40, 26, 10, BROWN);
  line(x + 128, y + 50, x + 140, y + 70, BROWN, 4);
  // scales
  line(x + 20, y + 30, x + 20, y + 62, INK, 2);
  line(x + 8, y + 30, x + 32, y + 30, INK, 2);
  fillTriangle(x + 6, y + 30, x + 10, y + 40, x + 14, y + 30, GOLD);
  fillTriangle(x + 26, y + 30, x + 30, y + 40, x + 34, y + 30, GOLD);
}

// ---------- layout ----------
const HERO_X = [8, 346, 684];
const HERO_W = 330;
const MID_X = [8, 172, 336, 500, 664, 828];
const MID_W = 161;
const BRIEF_X = [8, 210, 412, 614, 816];
const BRIEF_W = 196;

function heroCard(idx: number, accent: RGB, kicker: string, scene: (x: number, y: number, w: number, h: number) => void,
  headline: string[], why: string[], info: string[]): void {
  const x = HERO_X[idx];
  fillRect(x, 66, HERO_W, 314, CARD);
  fillRect(x, 66, HERO_W, 5, accent);
  rect(x, 66, HERO_W, 314, GRAYL, 1);
  // kicker
  chip(x + 8, 74, kicker, 1, accent, WHITE);
  // scene
  scene(x + 8, 100, HERO_W - 16, 140);
  // headline
  drawLines(x + 10, 250, headline, 2, INK, 18);
  // why it matters
  drawText(x + 10, 312, 'WHY IT MATTERS', 1, RED);
  drawLines(x + 10, 324, why, 1, INK, 10);
  // info strip
  drawLines(x + 10, 352, info, 1, GRAY, 10);
}

function midCard(idx: number, accent: RGB, scene: (x: number, y: number, w: number, h: number) => void,
  headline: string[], big: string, subs: string[]): void {
  const x = MID_X[idx];
  fillRect(x, 388, MID_W, 184, CARD);
  fillRect(x, 388, MID_W, 4, accent);
  rect(x, 388, MID_W, 184, GRAYL, 1);
  scene(x + 6, 396, MID_W - 12, 88);
  drawLines(x + 8, 490, headline, 1, INK, 10);
  drawText(x + 8, 512, big, 2, accent);
  subs.forEach((s, i) => fitLine(x + 8, 532 + i * 10, s, 1, MID_W - 16, GRAY));
}

type Brief = [string, string];
function briefCol(idx: number, title: string, items: Brief[]): void {
  const x = BRIEF_X[idx];
  drawText(x, 586, title, 2, NAVY);
  hline(x, 604, BRIEF_W, NAVY, 2);
  let cy = 612;
  for (const [h, d] of items) {
    if (h.startsWith('#')) {
      drawText(x, cy + 2, h.slice(1), 1, RED);
      cy += 13;
      continue;
    }
    fitLine(x, cy, h, 1, BRIEF_W, INK);
    fitLine(x, cy + 9, d, 1, BRIEF_W, GRAY);
    cy += 24;
  }
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);

  // ===== HEADER =====
  fillRect(0, 0, W, 62, NAVY);
  fillRect(0, 58, W, 4, GOLD);
  drawText(14, 8, 'THE WEDNESDAY WIRE', 3, WHITE);
  drawText(14, 36, 'WEDNESDAY 25 NOVEMBER 2026', 2, GOLDL);
  // 50 stories badge
  const bw = textW('50 STORIES', 3) + 24;
  fillRect(W - 14 - bw, 8, bw, 46, RED);
  drawText(W - 14 - bw + 12, 20, '50 STORIES', 3, WHITE);
  drawText(W - 14 - bw + 12, 40, '', 1, WHITE);

  // ===== HEROES =====
  heroCard(0, RED, 'LEAD · TARIFFS', sceneTariffs,
    ['TRUMP PROPOSES NEW', 'TARIFFS ON 14', 'ECONOMIES'],
    ['US HOUSEHOLDS PAY ~$900 A YEAR', 'UNDER THE NEW DUTIES'],
    ['CHINA 20% (40% IF TRUCE FAILS)', 'VIETNAM 20%/35% · INDIA 17%/25% · EU 15%']);
  heroCard(1, ORANGE, 'CAIRO', sceneTanker,
    ['CAIRO TANKER FIRE', 'KILLS 31'],
    ['27 VEHICLES BURNED, RING ROAD', 'SHUT AFTER THE BLAST'],
    ['CAUSE: CAR HIT TANKER, IT', 'OVERTURNED AND CAUGHT FIRE']);
  heroCard(2, BLUE, 'SPACE', sceneRocket,
    ['CHINA SENDS FIRST', 'PAKISTANI INTO ORBIT'],
    ['FIRST FOREIGNER ABOARD', 'TIANGONG STATION'],
    ['CREW: TANG HONGBO · WU YI', 'ZEESHAN ALI · DOCKED 03:56 UTC']);

  // ===== MIDS =====
  midCard(0, RED2, sceneBalloon,
    ["MACY'S 100TH PARADE", 'POSTPONED — FIRST TIME'], '60 MPH', ['GUSTS · SAT 28 NOV']);
  midCard(1, RED2, sceneKospi,
    ['KOSPI CRASHES 6.2%', 'AI FEARS RETURN'], '-6.2%', ['SAMSUNG -9.9%', 'SK HYNIX -11.1%']);
  midCard(2, GREEN, sceneDow,
    ['DOW ERASES 1,100-PT', 'PLUNGE, RECORD CLOSE'], '50,183', ['-1,100 → +164 · +0.33%']);
  midCard(3, ORANGE, sceneEnergy,
    ['UK ENERGY CAP +26%', 'TO £2,166 A YEAR'], '+26%', ['£1,723 → £2,166 · +£443']);
  midCard(4, INK, sceneRefinery,
    ['HOUTHIS CLAIM REFINERY', 'STRIKE — RAS TANURA'], '550K BPD', ['BRENT $93.60 +2.41%']);
  midCard(5, NAVY, sceneCourt,
    ['JUDGES: DROP NETANYAHU', 'BRIBERY CASE'], 'CASE 4000', ['RECOMMEND, NOT A RULING']);

  // ===== BRIEFS =====
  const me: Brief[] = [
    ['BOGOR GOLD MINE FLOODS', '9 DEAD, 17 TRAPPED, 100M SHAFT'],
    ['SUDAN DRONE STRIKES', '19 KILLED IN BLUE NILE'],
    ['GAZA STRIKE KILLS HAMAS', 'OFFICIAL, WIFE, 2 DAUGHTERS'],
    ['US: CITIZENS, LEAVE IRAN', 'TENSIONS RISE'],
    ['UKRAINE HITS RUSSIAN SHIP', 'CORVETTE OFF BENGHAZI'],
    ['IRAQ ORDERS TROOPS TO BORDERS', 'OIL OVERSIGHT ROW'],
    ['COALITION HITS HODEIDAH', 'MISSILE PLATFORM DESTROYED'],
    ['IRAN WEAPONS CLAIM', 'CHEMICAL ARMS ALLEGED'],
    ['30+ NATIONS: RUSSIA, STOP', 'CHEMICAL AGENTS IN UKRAINE'],
    ['INDIA CONDEMNS RIYADH HIT', '11 WOUNDED, 2 INDIANS'],
  ];
  const ap: Brief[] = [
    ['SOLOMON ISLANDS TREATY', 'AUSTRALIA TOP SECURITY PARTNER'],
    ['BANGLADESH WAGE +36%', 'MINIMUM 17,000 TAKAS'],
    ['CHINA PROBES SHANGHAI CHIEF', '4TH TOP LEADER SINCE 2025'],
    ['N. KOREA EXPELS SWISS ENVOY', 'OFFICE TO CLOSE IN 48H'],
    ['HONG KONG: 1 YEAR ON', '168 NAMES READ (ANNIVERSARY)'],
    ['JAPAN: DATA-CENTRE REVOLT', 'AI POWER BOOM SPARKS ROW'],
    ['TAIWAN VOTES SATURDAY', 'AI FAKES FEARED'],
    ['CANADA TIGHTENS STUDENT RULES', 'FOREIGN-STUDENT CAPS'],
    ['INDIA-MALAYSIA DRILL OPENS', 'HARIMAU SHAKTI IN IPOH'],
  ];
  const eu: Brief[] = [
    ['SPAIN VOTES SUNDAY', 'FAR RIGHT MAY ENTER GOVT'],
    ['MI5 WARNS OF RUSSIAN SABOTAGE', 'UK FIRMS ON ALERT'],
    ['POLAND NO-FLY ZONE', 'NEAR UKRAINE BORDER'],
    ['UK AI WARNING', 'WATCHDOG VS META MUSE AI'],
    ['SARKOZY TO STAND TRIAL 2027', 'WITNESS-TAMPERING CASE'],
    ['LONDON MUSEUM REOPENS', 'VICTORIAN HALL SATURDAY'],
  ];
  const sport: Brief[] = [
    ['NBA: NETS 104, BUCKS 97', 'RANDLE 28 PTS, CUP WIN'],
    ['MLB SUES PLAYERS\' UNION', '38-PAGE LOCKOUT COMPLAINT'],
  ];
  const am: Brief[] = [
    ['MISSISSIPPI PLANE CRASH', '6 DEAD, FAMILY OF 6'],
    ['IOWA BLAST: 4,400 KG', 'LEAD AZIDE, ZERO LEAD FOUND'],
    ['VENEZUELA DEBT $237.5BN', '242% OF GDP (DISCLOSED TUE)'],
    ['CIA NETWORK HACKED', 'OSINT HIT, CHINA SUSPECTED'],
    ['DOJ CHARGES 800+ IN SCAMS', '400 CASES WORLDWIDE'],
    ['NSA NETWORK DOWN FOR DAYS', 'BAD UPDATE, NOT A HACK'],
    ['TRUMP: FUNDING IRAN WAR PREP', 'THROUGH JANUARY'],
    ['MEASLES: 9 US DEATHS IN 2026', 'CDC REPORT'],
  ];
  const gl: Brief[] = [
    ['UKRAINE NEEDS EUR 115BN', 'EUR 25BN GAP FOR 2027'],
    ['RUSSIAN WAR DEAD 490,334+', 'LEAKED DATA, UP TO 700K'],
    ['LANDMINE DEATHS 5-YEAR HIGH', 'GLOBAL TOLL RISES'],
    ['WHO: END CUBA FUEL BLOCKADE', 'CHIEF URGES US'],
    ['MALAYSIA RETURNS REFUGEES', 'THOUSANDS TO MYANMAR'],
    ['AIRPORTS COURT PRIVATE CASH', 'EXPANSION FUNDING'],
  ];
  briefCol(0, 'MIDDLE EAST', me);
  briefCol(1, 'ASIA-PACIFIC', ap);
  briefCol(2, 'EUROPE', [...eu, ['#SPORT', ''], ...sport]);
  briefCol(3, 'AMERICAS', am);
  briefCol(4, 'GLOBAL', gl);

  // ===== FOOTER =====
  fillRect(0, 920, W, 104, NAVY);
  fillRect(0, 920, W, 3, GOLD);
  drawText(14, 930, 'CLAIMED vs CONFIRMED', 2, GOLDL);
  drawText(560, 930, 'DATE CHECK: WED 25 NOV 2026', 2, GREENL);
  drawText(14, 950, 'CAIRO 31/21 CONFIRMED NEXT MORNING · BOGOR 9/17 IS THE 25 NOV FIGURE', 1, WHITE);
  drawText(14, 962, 'HONG KONG FIRE = 2025 ANNIVERSARY, NOT A NEW FIRE · VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25', 1, WHITE);
  drawText(14, 980, 'DOW 50,182.95 +0.33% · S&P 7,182.78 -0.25% · NASDAQ 23,585.80 -0.62% · KOSPI -6.16% · BRENT $93.60 · GOLD $3,598.10 · BITCOIN $60,200.94 · 10-YR 4.85%', 1, GOLDL);
  drawText(14, 998, 'SOURCES: REUTERS · AP · BBC · NYT · ESPN · OFGEM · PIB · AL JAZEERA · MARKETS CLOSED THU 26 NOV (THANKSGIVING), FRI HALF-DAY', 1, WHITE);

  // ===== write PNG =====
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  fs.writeFileSync(path.join(outDir, 'entry.png'), png);
  console.log(`TRUNCATIONS: ${TRUNCATIONS}`);
  console.log(`WROTE ${png.length} bytes to ${path.join(outDir, 'entry.png')}`);
}

main();
