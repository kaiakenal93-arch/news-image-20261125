// THE WEDNESDAY WIRE — v5
// Sum up Wednesday 25 November 2026 in one image. 50 stories, tariff lead.
// Fresh build: own 5x7 bitmap font + own PNG encoder, Node stdlib only.
// v5 fixes vs v4: H3 headline re-wrapped (no dangling "ORBIT"), refinery
// flare stack reads as a flare (thicker stack, bigger flame, tank context),
// Kospi chip scene strengthened (wafer + bigger chip + thicker red arrow),
// footer bottom margin tightened (~26px -> ~15px).
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

type RGBA = [number, number, number, number];
const NAVY: RGBA = [14, 27, 51, 255];
const NAVY2: RGBA = [24, 44, 78, 255];
const PAPER: RGBA = [247, 243, 232, 255];
const CREAM: RGBA = [245, 230, 200, 255];
const INK: RGBA = [20, 20, 20, 255];
const GREY: RGBA = [90, 90, 90, 255];
const WHITE: RGBA = [255, 255, 255, 255];
const YELLOW: RGBA = [255, 210, 62, 255];
const GOLD: RGBA = [255, 210, 62, 255];
const RED: RGBA = [216, 35, 42, 255];
const REDDK: RGBA = [178, 24, 30, 255];
const GREEN: RGBA = [46, 125, 50, 255];
const GREENLT: RGBA = [223, 242, 223, 255];
const BLUE: RGBA = [43, 108, 176, 255];
const BLUELT: RGBA = [207, 227, 242, 255];
const SKY: RGBA = [214, 232, 245, 255];
const ORANGE: RGBA = [240, 120, 20, 255];
const FLAMEY: RGBA = [255, 190, 40, 255];
const TEAL: RGBA = [14, 122, 107, 255];
const PURPLE: RGBA = [106, 79, 163, 255];
const BROWN: RGBA = [141, 110, 47, 255];
const WHYBG: RGBA = [255, 244, 180, 255];
const MIDGREY: RGBA = [232, 232, 232, 255];

let TRUNCATIONS = 0;

// ---------- canvas ----------
const canvas = Buffer.alloc(W * H * 4);
function px(x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  canvas[i] = c[0]; canvas[i + 1] = c[1]; canvas[i + 2] = c[2]; canvas[i + 3] = c[3];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}
function hline(x0: number, x1: number, y: number, c: RGBA): void {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) px(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: RGBA): void {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(x, y, c);
}
function fillCircle(cx: number, cy: number, r: number, c: RGBA): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    const dy = y - cy;
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
    hline(Math.ceil(cx - dx), Math.floor(cx + dx), y, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y - cy) / ry;
    const dx = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    hline(Math.ceil(cx - dx), Math.floor(cx + dx), y, c);
  }
}
function ring(cx: number, cy: number, r: number, t: number, c: RGBA): void {
  for (let y = Math.floor(cy - r - t); y <= Math.ceil(cy + r + t); y++) {
    for (let x = Math.floor(cx - r - t); x <= Math.ceil(cx + r + t); x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d >= r - t && d <= r + t) px(x, y, c);
    }
  }
}
// thick line via stamped squares
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGBA): void {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = Math.floor(w / 2);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    fillRect(x - half, y - half, w, w, c);
  }
}
function polyFill(pts: Array<[number, number]>, c: RGBA): void {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      hline(Math.ceil(xs[k]), Math.floor(xs[k + 1]), y, c);
    }
  }
}
function star(cx: number, cy: number, r: number, c: RGBA): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
  }
  polyFill(pts, c);
}
function flame(cx: number, yBase: number, w: number, h: number): void {
  // teardrop flame: outer orange, inner yellow
  polyFill([
    [cx, yBase - h],
    [cx + w * 0.55, yBase - h * 0.45],
    [cx + w * 0.42, yBase],
    [cx - w * 0.42, yBase],
    [cx - w * 0.55, yBase - h * 0.45],
  ], ORANGE);
  polyFill([
    [cx, yBase - h * 0.62],
    [cx + w * 0.3, yBase - h * 0.3],
    [cx + w * 0.22, yBase],
    [cx - w * 0.22, yBase],
    [cx - w * 0.3, yBase - h * 0.3],
  ], FLAMEY);
}

// ---------- PNG encoder ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    canvas.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 5x7 bitmap font (rows as 5-bit numbers, MSB = left) ----------
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ",": [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ";": [0, 0b01100, 0, 0, 0b01100, 0b00100, 0b01000],
  ":": [0, 0b01100, 0, 0, 0b01100, 0, 0],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  "£": [0b00100, 0b01100, 0b10010, 0b11110, 0b10000, 0b10000, 0b11111],
  "$": [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  "(": [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ")": [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0],
  "&": [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  "+": [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0],
  "•": [0, 0, 0b01100, 0b01100, 0b01100, 0, 0],
  "→": [0, 0b00100, 0b00010, 0b11111, 0b00010, 0b00100, 0],
  "=": [0, 0, 0b11111, 0, 0b11111, 0, 0],
  "°": [0b01100, 0b10010, 0b10010, 0b01100, 0, 0, 0],
  "_": [0, 0, 0, 0, 0, 0, 0b11111],
  "[": [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  "]": [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
  "*": [0, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0],
  "#": [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
  "@": [0b01110, 0b10001, 0b10111, 0b10101, 0b10110, 0b10000, 0b01110],
  "^": [0b00100, 0b01010, 0b10001, 0, 0, 0, 0],
  "|": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  "\\": [0b10000, 0b01000, 0b01000, 0b00100, 0b00010, 0b00010, 0b00001],
  "<": [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
  ">": [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000],
  "×": [0, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0],
};
function drawChar(ch: string, x: number, y: number, s: number, c: RGBA): void {
  const g = FONT[ch.toUpperCase()] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row & (1 << (4 - col))) fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}
function textW(s: string, sc: number): number {
  return s.length === 0 ? 0 : s.length * 6 * sc - sc;
}
function drawText(s: string, x: number, y: number, sc: number, c: RGBA): void {
  let cx = x;
  for (const ch of s) { drawChar(ch, cx, y, sc, c); cx += 6 * sc; }
}
function drawTextC(s: string, cx: number, y: number, sc: number, c: RGBA): void {
  drawText(s, cx - Math.floor(textW(s, sc) / 2), y, sc, c);
}
function wrapText(s: string, maxW: number, sc: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur === "" ? w : cur + " " + w;
    if (textW(t, sc) <= maxW || cur === "") cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
// draw wrapped text; truncates to maxLines and counts TRUNCATIONS
function textBox(s: string, x: number, y: number, maxW: number, maxLines: number, sc: number, c: RGBA, lh: number): number {
  const lines = wrapText(s, maxW, sc);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    TRUNCATIONS++;
    let last = shown[shown.length - 1];
    while (textW(last + "...", sc) > maxW && last.length > 0) last = last.slice(0, -1);
    shown[shown.length - 1] = last + "...";
  }
  shown.forEach((ln, i) => drawText(ln, x, y + i * lh, sc, c));
  return shown.length;
}

// ---------- hero scenes (52..212) ----------
function tagChip(x: number, y: number, label: string, bg: RGBA, fg: RGBA, sc: number): void {
  const w = textW(label, sc) + 10;
  fillRect(x, y, w, 7 * sc + 6, bg);
  drawText(label, x + 5, y + 3, sc, fg);
}
function smokeCloud(x: number, y: number, s: number, c: RGBA): void {
  fillCircle(x, y, 16 * s, c); fillCircle(x + 18 * s, y - 6 * s, 20 * s, c);
  fillCircle(x + 38 * s, y, 16 * s, c); fillCircle(x + 18 * s, y + 6 * s, 18 * s, c);
}
function hero1(): void {
  // tariffs: globe + brick wall with % tags + container ship + red down arrow
  fillRect(0, 52, 341, 160, BLUELT);
  // globe
  fillCircle(88, 132, 62, BLUE);
  fillEllipse(88, 132, 28, 62, [70, 140, 200, 255]);
  fillEllipse(88, 132, 62, 24, [70, 140, 200, 255]);
  fillCircle(70, 108, 14, [76, 175, 80, 255]);
  fillCircle(108, 150, 16, [76, 175, 80, 255]);
  fillCircle(98, 100, 8, [76, 175, 80, 255]);
  // brick wall
  const wx = 168, wy = 66, ww = 140, wh = 118;
  fillRect(wx, wy, ww, wh, [165, 90, 50, 255]);
  for (let r = 0; r < 7; r++) {
    const by = wy + r * 17;
    hline(wx, wx + ww - 1, by, [120, 60, 30, 255]);
    for (let b = 0; b < 4; b++) {
      const bx = Math.max(wx, wx + ((r % 2) * 18) + b * 36 - 18);
      vline(bx, by, by + 16, [120, 60, 30, 255]);
    }
  }
  // % tags on the wall
  tagChip(wx + 8, wy + 8, "CHINA 20%", NAVY, WHITE, 1);
  tagChip(wx + 8, wy + 30, "VIETNAM 20%", NAVY, WHITE, 1);
  tagChip(wx + 8, wy + 52, "INDIA 17%", NAVY, WHITE, 1);
  tagChip(wx + 8, wy + 74, "EU 15%", NAVY, WHITE, 1);
  // red down arrow top-right
  polyFill([[312, 58], [326, 58], [326, 82], [333, 82], [319, 102], [305, 82], [312, 82]], RED);
  // container ship along the bottom
  fillRect(150, 192, 185, 16, NAVY2);
  const cols: RGBA[] = [[216, 35, 42, 255], [255, 210, 62, 255], [46, 125, 50, 255], [43, 108, 176, 255]];
  for (let i = 0; i < 5; i++) fillRect(156 + i * 34, 178, 30, 14, cols[i % 4]);
  for (let i = 0; i < 3; i++) fillRect(170 + i * 34, 166, 30, 12, cols[(i + 2) % 4]);
  fillRect(318, 160, 14, 32, WHITE);
  fillRect(0, 208, 341, 4, [90, 140, 190, 255]);
}
function hero2(): void {
  // Cairo: smoke, red toll banner, burnt cars, overturned tanker, road
  fillRect(341, 52, 341, 160, CREAM);
  smokeCloud(400, 92, 1, [150, 150, 150, 255]);
  fillRect(352, 122, 222, 20, RED);
  drawText("31 DEAD • 21 HURT", 358, 126, 2, WHITE);
  // road
  fillRect(341, 186, 341, 26, [60, 60, 60, 255]);
  for (let x = 348; x < 675; x += 24) fillRect(x, 197, 14, 3, WHITE);
  // burnt-out cars with flames
  for (const cx of [360, 425, 490]) {
    fillRect(cx, 168, 52, 18, [25, 25, 25, 255]);
    flame(cx + 12, 168, 14, 16);
    flame(cx + 36, 168, 12, 12);
  }
  // overturned tanker: body + wheels UP + hazard diamond
  fillRect(566, 152, 108, 34, [150, 150, 150, 255]);
  fillRect(566, 152, 108, 8, [110, 110, 110, 255]);
  fillRect(566, 178, 108, 8, RED);
  for (const wx of [578, 606, 634, 662]) {
    fillCircle(wx, 144, 10, [25, 25, 25, 255]);
    fillCircle(wx, 144, 4, [180, 180, 180, 255]);
  }
  // hazard diamond (red top, white bottom)
  polyFill([[620, 156], [636, 170], [620, 184], [604, 170]], RED);
  polyFill([[620, 170], [636, 170], [620, 184], [604, 170]], WHITE);
  fillRect(618, 160, 4, 18, INK);
}
function hero3(): void {
  // Shenzhou-24: flags, rocket, Tiangong ring, astronauts
  fillRect(682, 52, 342, 160, NAVY);
  for (let i = 0; i < 40; i++) {
    const sx = 690 + ((i * 53) % 320), sy = 58 + ((i * 37) % 140);
    fillRect(sx, sy, 2, 2, [255, 255, 255, 200]);
  }
  // China flag
  fillRect(694, 66, 66, 36, RED);
  star(708, 80, 8, YELLOW);
  star(730, 72, 3, YELLOW); star(738, 80, 3, YELLOW);
  star(730, 90, 3, YELLOW); star(722, 94, 3, YELLOW);
  // Pakistan flag
  fillRect(770, 66, 66, 36, [20, 90, 50, 255]);
  fillRect(770, 66, 16, 36, WHITE);
  fillCircle(812, 84, 11, WHITE);
  fillCircle(816, 84, 10, [20, 90, 50, 255]);
  star(826, 80, 4, WHITE);
  // rocket rising
  polyFill([[884, 66], [898, 66], [898, 118], [884, 118]], WHITE);
  polyFill([[884, 66], [898, 66], [891, 52]], RED);
  polyFill([[884, 108], [872, 128], [884, 118]], RED);
  polyFill([[898, 108], [910, 128], [898, 118]], RED);
  fillCircle(891, 88, 6, BLUE);
  flame(891, 146, 20, 26);
  // Tiangong ring + module
  ring(968, 118, 26, 5, [255, 190, 40, 255]);
  fillRect(940, 112, 56, 12, WHITE);
  fillRect(962, 104, 12, 28, WHITE);
  // three astronaut silhouettes
  for (const ax of [700, 736, 772]) {
    fillCircle(ax + 10, 178, 9, WHITE);
    fillRect(ax + 2, 188, 16, 16, WHITE);
    fillRect(ax + 2, 204, 6, 8, WHITE);
    fillRect(ax + 12, 204, 6, 8, WHITE);
  }
  drawText("TIANGONG", 948, 196, 1, YELLOW);
}

// ---------- mid scenes (376..448) ----------
// columns: x0 = 0, 171, 342, 513, 684, 855 ; width 170
function mid1(): void {
  // Macy's balloon held down by ropes, wind streaks
  fillRect(0, 376, 170, 72, SKY);
  fillCircle(82, 408, 26, RED);
  fillCircle(74, 400, 6, [255, 120, 120, 255]);
  fillRect(72, 402, 4, 4, INK); fillRect(88, 402, 4, 4, INK);
  // smile
  for (let a = 0; a <= 8; a++) {
    const ang = Math.PI * (0.25 + (a / 8) * 0.5);
    px(Math.round(80 + 10 * Math.cos(ang)), Math.round(410 + 8 * Math.sin(ang)), INK);
  }
  thickLine(66, 430, 56, 448, 2, INK);
  thickLine(98, 430, 108, 448, 2, INK);
  thickLine(82, 434, 82, 448, 2, INK);
  // wind streaks
  thickLine(8, 392, 40, 392, 2, [150, 190, 220, 255]);
  thickLine(14, 428, 46, 428, 2, [150, 190, 220, 255]);
  thickLine(128, 384, 162, 384, 2, [150, 190, 220, 255]);
}
function mid2(): void {
  // Kospi (STRENGTHENED): silicon wafer + bigger chip + thick red down arrow
  fillRect(171, 376, 170, 72, PAPER);
  // wafer behind chip
  fillCircle(248, 412, 30, [210, 210, 210, 255]);
  ring(248, 412, 30, 1, [160, 160, 160, 255]);
  vline(248, 384, 440, [170, 170, 170, 255]);
  hline(220, 276, 412, [170, 170, 170, 255]);
  // bigger chip, centred left
  fillRect(212, 392, 76, 42, NAVY2);
  for (let i = 0; i < 4; i++) {
    fillRect(206, 398 + i * 9, 6, 4, [120, 120, 120, 255]);
    fillRect(288, 398 + i * 9, 6, 4, [120, 120, 120, 255]);
  }
  for (let i = 0; i < 4; i++) {
    fillRect(224 + i * 14, 386, 4, 6, [120, 120, 120, 255]);
    fillRect(224 + i * 14, 434, 4, 6, [120, 120, 120, 255]);
  }
  fillRect(232, 404, 36, 18, [140, 190, 230, 255]);
  fillRect(240, 408, 20, 10, [90, 150, 210, 255]);
  // thick red down arrow, dominating the right side
  polyFill([[312, 380], [328, 380], [328, 414], [338, 414], [320, 444], [302, 414], [312, 414]], RED);
}
function mid3(): void {
  // Dow V-chart: red plunge then green recovery
  fillRect(342, 376, 170, 72, GREENLT);
  thickLine(352, 388, 420, 436, 4, RED);
  thickLine(420, 436, 500, 388, 4, GREEN);
  polyFill([[500, 388], [488, 390], [500, 402]], GREEN);
  hline(350, 504, 392, [120, 200, 120, 255]);
  drawText("RECORD", 452, 394, 1, GREEN);
}
function mid4(): void {
  // UK energy: house + bill with flame
  fillRect(513, 376, 170, 72, CREAM);
  // house
  polyFill([[528, 412], [566, 386], [604, 412]], [150, 80, 40, 255]);
  fillRect(534, 412, 64, 32, [240, 220, 180, 255]);
  fillRect(558, 424, 16, 20, [120, 70, 30, 255]);
  fillRect(540, 418, 10, 10, BLUELT);
  // bill / meter
  fillRect(616, 390, 56, 44, WHITE);
  fillRect(616, 390, 56, 3, RED);
  fillRect(616, 390, 3, 44, RED); fillRect(669, 390, 3, 44, RED); fillRect(616, 431, 56, 3, RED);
  drawText("!", 640, 398, 2, RED);
  flame(656, 428, 12, 12);
}
function mid5(): void {
  // Houthis / Ras Tanura (FIXED flare): thick stack, big flame, tank, crossed drone
  fillRect(684, 376, 170, 72, MIDGREY);
  // black smoke plume
  fillCircle(706, 392, 12, [30, 30, 30, 255]);
  fillCircle(720, 386, 14, [30, 30, 30, 255]);
  fillCircle(732, 394, 10, [30, 30, 30, 255]);
  // refinery tower
  fillRect(694, 410, 26, 34, [140, 140, 140, 255]);
  fillRect(694, 410, 26, 4, [100, 100, 100, 255]);
  fillRect(726, 420, 18, 24, [160, 160, 160, 255]);
  // round storage tank with dome
  fillRect(748, 420, 34, 24, [190, 190, 190, 255]);
  fillEllipse(765, 420, 17, 8, [190, 190, 190, 255]);
  fillRect(748, 428, 34, 3, [120, 120, 120, 255]);
  // THICK flare stack + BIG flame
  fillRect(790, 392, 18, 52, [70, 70, 70, 255]);
  fillRect(788, 388, 22, 5, [50, 50, 50, 255]);
  flame(799, 390, 30, 30);
  // crossed-out drone (intercepted)
  fillRect(824, 392, 22, 6, [25, 25, 25, 255]);
  fillCircle(826, 390, 4, [25, 25, 25, 255]); fillCircle(844, 390, 4, [25, 25, 25, 255]);
  fillCircle(826, 400, 4, [25, 25, 25, 255]); fillCircle(844, 400, 4, [25, 25, 25, 255]);
  thickLine(820, 384, 850, 408, 4, RED);
  thickLine(850, 384, 820, 408, 4, RED);
  // small oil barrel
  fillRect(836, 428, 14, 16, [30, 60, 120, 255]);
  fillRect(836, 433, 14, 2, [20, 40, 90, 255]);
}
function mid6(): void {
  // Netanyahu: courthouse + gavel
  fillRect(855, 376, 169, 72, SKY);
  polyFill([[868, 402], [916, 380], [964, 402]], NAVY);
  fillRect(874, 402, 8, 34, WHITE);
  fillRect(898, 402, 8, 34, WHITE);
  fillRect(922, 402, 8, 34, WHITE);
  fillRect(946, 402, 8, 34, WHITE);
  fillRect(868, 436, 96, 8, WHITE);
  // gavel, diagonal
  thickLine(978, 392, 1012, 420, 6, [120, 70, 30, 255]);
  thickLine(972, 402, 990, 386, 8, [150, 90, 40, 255]);
}

// ---------- mid text ----------
interface Mid { head: string; big: string; bigC: RGBA; sub: string; }
const MIDS: Mid[] = [
  { head: "MACY'S 100TH PARADE POSTPONED", big: "60 MPH", bigC: RED, sub: "GUSTS • SAT 28 NOV" },
  { head: "KOSPI CRASHES 6.2% AI FEARS RETURN", big: "-6.2%", bigC: RED, sub: "SAMSUNG -9.9% HYNIX -11.1%" },
  { head: "DOW ERASES 1,100-PT DROP RECORD CLOSE", big: "50,183", bigC: GREEN, sub: "-1,100 → +164 • +0.33%" },
  { head: "UK ENERGY CAP JUMPS 26% TO £2,166 A YEAR", big: "+26%", bigC: RED, sub: "£1,723 → £2,166 • +£443" },
  { head: "HOUTHIS CLAIM REFINERY HIT - RAS TANURA", big: "550K BPD", bigC: INK, sub: "BRENT $93.60 +2.41%" },
  { head: "JUDGES: DROP NETANYAHU BRIBERY CASE", big: "CASE 4000", bigC: INK, sub: "RECOMMEND, NOT A RULING" },
];
function midText(): void {
  for (let i = 0; i < 6; i++) {
    const x0 = i * 171 + 8;
    const m = MIDS[i];
    textBox(m.head, x0, 452, 156, 3, 2, INK, 17);
    drawText(m.big, x0, 508, 3, m.bigC);
    drawText(m.sub, x0, 536, 1, GREY);
  }
}

// ---------- briefs ----------
interface Brief { t: string; d: string; }
const COLS: Array<{ name: string; c: RGBA; x: number; w: number; items: Brief[] }> = [
  { name: "MIDDLE EAST", c: RED, x: 8, w: 192, items: [
    { t: "BOGOR GOLD MINE FLOODS", d: "9 DEAD, 17 TRAPPED, 100M SHAFT" },
    { t: "SUDAN DRONE STRIKES", d: "19 KILLED IN BLUE NILE" },
    { t: "GAZA STRIKE KILLS HAMAS", d: "OFFICIAL, WIFE, 2 DAUGHTERS" },
    { t: "US: CITIZENS LEAVE IRAN", d: "TENSIONS RISE" },
    { t: "UKRAINE HITS RUSSIAN SHIP", d: "CORVETTE OFF BENGHAZI" },
    { t: "IRAQ ORDERS TROOPS TO BORDERS", d: "OIL OVERSIGHT" },
    { t: "COALITION HITS HODEIDAH", d: "MISSILE PLATFORM DESTROYED" },
    { t: "IRAN WEAPONS CLAIM", d: "CHEMICAL ARMS ALLEGED" },
    { t: "CHEMICAL WEAPONS", d: "30+ NATIONS: RUSSIA, STOP" },
    { t: "INDIA CONDEMNS RIYADH HIT", d: "11 WOUNDED, 2 INDIANS" },
  ]},
  { name: "ASIA-PACIFIC", c: TEAL, x: 213, w: 192, items: [
    { t: "SOLOMON ISLANDS TREATY", d: "AUSTRALIA TOP SECURITY PARTNER" },
    { t: "BANGLADESH WAGE +36%", d: "17,000 TAKAS MINIMUM" },
    { t: "CHINA PROBES SHANGHAI CHIEF", d: "4TH TOP LEADER SINCE 2025" },
    { t: "N. KOREA EXPELS SWISS ENVOY", d: "OFFICE TO CLOSE IN 48H" },
    { t: "HONG KONG: 1 YEAR ON", d: "168 NAMES READ (ANNIVERSARY)" },
    { t: "JAPAN: DATA-CENTRE REVOLT", d: "AI POWER BOOM SPARKS ROW" },
    { t: "TAIWAN VOTES SATURDAY", d: "AI FAKES FEARED" },
    { t: "INDIA-MALAYSIA DRILL OPENS", d: "HARIMAU SHAKTI IN IPOH" },
    { t: "CANADA TIGHTENS STUDENT RULES", d: "FOREIGN-STUDENT CAPS" },
  ]},
  { name: "EUROPE", c: PURPLE, x: 418, w: 162, items: [
    { t: "SPAIN VOTES SUNDAY", d: "FAR RIGHT MAY ENTER GOVT" },
    { t: "MI5 WARNS RUSSIAN SABOTAGE", d: "UK FIRMS ON ALERT" },
    { t: "POLAND NO-FLY ZONE", d: "NEAR UKRAINE BORDER" },
    { t: "UK AI WARNING", d: "WATCHES VS META MUSE AI" },
    { t: "SARKOZY TO STAND TRIAL 2027", d: "WITNESS-TAMPERING CASE" },
    { t: "LONDON MUSEUM REOPENS", d: "VICTORIAN HALL SATURDAY" },
  ]},
  { name: "AMERICAS", c: GREEN, x: 593, w: 189, items: [
    { t: "MISSISSIPPI PLANE CRASH", d: "6 DEAD, FAMILY OF 6" },
    { t: "IOWA BLAST: 4,400 KG", d: "20-MILE SHELTER, NO LEAD FOUND" },
    { t: "VENEZUELA DEBT: $237.5BN", d: "242% OF GDP (DISCLOSED TUE)" },
    { t: "CIA NETWORK HACKED", d: "OSINT HIT, CHINA SUSPECTED" },
    { t: "DOJ CHARGES 800+ IN SCAMS", d: "400 CASES WORLDWIDE" },
    { t: "NSA NETWORK DOWN FOR DAYS", d: "BAD UPDATE, NOT A HACK" },
    { t: "TRUMP: FUNDING IRAN WAR PREP", d: "THROUGH JANUARY" },
    { t: "MEASLES", d: "CDC: 9 US DEATHS IN 2026" },
  ]},
  { name: "GLOBAL & SPORT", c: BROWN, x: 795, w: 213, items: [
    { t: "UKRAINE NEEDS EUR 115BN", d: "EUR 25BN GAP FOR 2027" },
    { t: "RUSSIAN WAR DEAD 490,334+", d: "LEAKED DATA, UP TO 700K" },
    { t: "LANDMINE DEATHS 5-YEAR HIGH", d: "GLOBAL TOLL RISES" },
    { t: "WHO: END CUBA FUEL BLOCKADE", d: "CHIEF URGES US" },
    { t: "MALAYSIA RETURNS REFUGEES", d: "THOUSANDS TO MYANMAR" },
    { t: "AIRPORTS COURT PRIVATE CASH", d: "EXPANSION FUNDING" },
    { t: "NBA: NETS 104, BUCKS 97", d: "RANDLE 28 PTS, CUP WIN" },
    { t: "MLB SUES PLAYERS' UNION", d: "38-PAGE LOCKOUT COMPLAINT" },
  ]},
];
function briefs(): void {
  for (const col of COLS) {
    drawText(col.name, col.x, 566, 2, col.c);
    fillRect(col.x, 582, col.w, 2, col.c);
    let y = 590;
    for (const b of col.items) {
      textBox(b.t, col.x, y, col.w, 1, 1, INK, 9);
      textBox(b.d, col.x, y + 9, col.w, 1, 1, GREY, 9);
      y += 27;
    }
  }
}

// ---------- header / heroes text / why / footer ----------
function header(): void {
  fillRect(0, 0, 1024, 52, NAVY);
  drawText("THE WEDNESDAY WIRE", 16, 4, 4, WHITE);
  drawText("WEDNESDAY 25 NOVEMBER 2026", 16, 36, 2, YELLOW);
  fillRect(830, 8, 178, 36, RED);
  drawTextC("50 STORIES", 919, 15, 3, WHITE);
}
function heroText(): void {
  // H1
  drawText("TRUMP PROPOSES", 12, 218, 3, INK);
  drawText("NEW TARIFFS ON", 12, 244, 3, INK);
  drawText("14 ECONOMIES", 12, 270, 3, INK);
  drawText("CHINA 20% (40% IF TRUCE FAILS)", 12, 300, 1, GREY);
  drawText("VIETNAM 20%/35% • INDIA 17%/25% • EU 15%", 12, 311, 1, GREY);
  // H2
  drawText("CAIRO TANKER FIRE", 353, 218, 3, INK);
  drawText("KILLS 31", 353, 244, 3, INK);
  // H3 — re-wrapped v5: no single word dangles alone
  drawText("CHINA SENDS", 694, 218, 3, INK);
  drawText("FIRST PAKISTANI", 694, 244, 3, INK);
  drawText("INTO ORBIT", 694, 270, 3, INK);
  // why-it-matters band
  fillRect(0, 330, 1024, 46, WHYBG);
  const whys: Array<[number, string, string]> = [
    [12, "US HOUSEHOLDS PAY $900 A YEAR UNDER NEW DUTIES", ""],
    [353, "27 VEHICLES BURNED, RING ROAD SHUT AFTER BLAST", "CAUSE: CAR HIT TANKER, IT OVERTURNED AND CAUGHT FIRE"],
    [694, "FIRST FOREIGNER ABOARD TIANGONG STATION", "CREW: TANG HONGBO • WU YI • ZEESHAN ALI"],
  ];
  for (const [x, line1, line2] of whys) {
    drawText("WHY IT MATTERS", x, 335, 1, RED);
    drawText(line1, x, 346, 1, INK);
    if (line2) drawText(line2, x, 358, 1, GREY);
  }
}
function footer(): void {
  fillRect(0, 866, 1024, 158, NAVY);
  drawText("CLAIMED VS CONFIRMED", 16, 880, 2, YELLOW);
  drawText("CAIRO 31/21 CONFIRMED NEXT MORNING • BOGOR 9/17 IS THE 25 NOV FIGURE", 16, 902, 1, WHITE);
  drawText("HONG KONG FIRE IS 2025 ANNIVERSARY, NOT A NEW FIRE • VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25", 16, 914, 1, WHITE);
  // date check box
  fillRect(700, 878, 308, 2, GOLD); fillRect(700, 940, 308, 2, GOLD);
  fillRect(700, 878, 2, 64, GOLD); fillRect(1006, 878, 2, 64, GOLD);
  drawText("DATE CHECK:", 720, 888, 2, YELLOW);
  drawText("WED 25 NOV 2026", 716, 910, 3, YELLOW);
  // markets strip, sources, tagline — spaced so the last line ends ~1009
  fillRect(16, 952, 992, 1, [90, 110, 150, 255]);
  drawText("DOW 50,182.95 +0.33% • S&P 7,182.78 -0.25% • NASDAQ 23,585.80 -0.62% • KOSPI -6.16% • BRENT $93.60 • GOLD $3,598.10 • BITCOIN $60,200.94 • 10-YR 4.85%", 16, 960, 1, YELLOW);
  drawText("SOURCES: REUTERS • AP • BBC • NYT • ESPN • OFGEM • PIB • AL JAZEERA • MARKETS CLOSED THU 26 NOV (THANKSGIVING); FRI HALF-DAY", 16, 980, 1, [200, 200, 200, 255]);
  drawText("50 STORIES • TARIFF LEAD • WHY IT MATTERS • EVERY STORY DATE-CHECKED FOR WED 25 NOV 2026", 16, 1002, 1, [200, 200, 200, 255]);
}

// ---------- main ----------
function main(): void {
  fillRect(0, 0, W, H, PAPER);
  header();
  hero1(); hero2(); hero3();
  heroText();
  mid1(); mid2(); mid3(); mid4(); mid5(); mid6();
  midText();
  briefs();
  footer();
  const args = process.argv.slice(2);
  let outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  const oi = args.indexOf("--output");
  if (oi >= 0 && args[oi + 1]) outDir = args[oi + 1];
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  const path = outDir + "/entry.png";
  writeFileSync(path, png);
  console.log("TRUNCATIONS: " + TRUNCATIONS);
  console.log("WROTE " + png.length + " bytes to " + path);
}
main();
