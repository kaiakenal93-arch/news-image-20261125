// THE WEDNESDAY WIRE — v2
// Sum up 25 November 2026's world news in one image.
// 50 stories: 3 heroes + 6 mids + 41 briefs. Tariff lead, why-it-matters layer.
// Written fresh from research-25nov.md. Node stdlib only.
// Own 5x7 bitmap font + own PNG encoder (node:zlib).
// v2 fixes (found inspecting v1): EU 15% tag overlapped by the ship;
// Cairo road dashes bled into the headline; Shenzhou rocket flame crossed
// into the headline. All three scenes are re-laid-out so no scene element
// leaves its scene box. Hero scenes made bigger and simpler so they read
// at ~300px. Why-it-matters lines sharpened and highlighted.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const W = 1024, H = 1024;
const OUT = "/output/entry.png";

// ---------- PNG encoder (own) ----------
function crc32(buf: Buffer): number {
  let table: number[] | null = (crc32 as any)._t;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    (crc32 as any)._t = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgba: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- canvas ----------
const px = new Uint8Array(W * H * 4);
type RGB = [number, number, number];
function rgb(c: RGB): [number, number, number, number] { return [c[0], c[1], c[2], 255]; }
function fill(x: number, y: number, w: number, h: number, c: RGB): void {
  const [r, g, b, a] = rgb(c);
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 4;
    for (let xx = x0; xx < x1; xx++, o += 4) {
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
    }
  }
}
function dot(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (Math.floor(y) * W + Math.floor(x)) * 4;
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void { fill(x, y, w, h, c); }
function hline(x: number, y: number, w: number, c: RGB, t = 1): void { fill(x, y, w, t, c); }
function vline(x: number, y: number, h: number, c: RGB, t = 1): void { fill(x, y, t, h, c); }
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (dx * i) / n), y = Math.round(y0 + (dy * i) / n);
    fill(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
    if (x * x + y * y <= r * r) dot(cx + x, cy + y, c);
}
function ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++)
      dot(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
    const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
    const g = 1 - a - b;
    if (a >= 0 && b >= 0 && g >= 0) dot(x, y, c);
  }
}

// ---------- palette ----------
const NAVY: RGB = [15, 42, 74];
const NAVY2: RGB = [20, 58, 96];
const PAPER: RGB = [250, 247, 240];
const INK: RGB = [18, 28, 40];
const MUTED: RGB = [90, 100, 112];
const RED: RGB = [200, 40, 32];
const REDDK: RGB = [160, 28, 22];
const ORANGE: RGB = [232, 110, 24];
const GOLD: RGB = [232, 180, 40];
const GREEN: RGB = [32, 140, 70];
const GREENLT: RGB = [120, 200, 120];
const BLUE: RGB = [40, 110, 190];
const BLUELT: RGB = [170, 205, 235];
const SKY: RGB = [200, 225, 245];
const GREY: RGB = [150, 155, 160];
const GREYDK: RGB = [90, 95, 100];
const WHITE: RGB = [255, 255, 255];
const CREAM: RGB = [252, 240, 210];
const YELLOW: RGB = [255, 214, 64];
const BROWN: RGB = [140, 100, 70];

// ---------- 5x7 bitmap font ----------
// Each glyph: 7 rows of 5 bits, "1" = on.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "£": ["00110", "01001", "01000", "11110", "01000", "01000", "11111"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  "·": ["00000", "00000", "00000", "01100", "00000", "00000", "00000"],
  "→": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "~": ["00000", "00000", "01001", "10110", "00000", "00000", "00000"],
  "×": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
};
let truncations = 0;
function textW(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") fill(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 6 * scale;
  }
}
// Draw text fitted into maxW by shrinking scale; counts a truncation if it still overflows.
function drawTextFit(x: number, y: number, s: string, scale: number, maxW: number, c: RGB): void {
  let sc = scale;
  while (sc > 1 && textW(s, sc) > maxW) sc--;
  if (textW(s, sc) > maxW) {
    truncations++;
    // hard-clip: draw what fits, drop the rest
    let cx = x;
    for (const ch of s) {
      if (cx + 5 * sc > x + maxW) break;
      const g = FONT[ch] ?? FONT["?"];
      for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") fill(cx + col * sc, y + r * sc, sc, sc, c);
      cx += 6 * sc;
    }
    return;
  }
  drawText(x, y, s, sc, c);
}
// Word-wrap a string into lines of at most maxW at given scale.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textW(t, scale) <= maxW) { cur = t; continue; }
    if (cur) lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawLines(x: number, y: number, lines: string[], scale: number, lh: number, c: RGB): void {
  lines.forEach((ln, i) => drawText(x, y + i * lh, ln, scale, c));
}

// ---------- hero scenes (all drawing stays inside the given box) ----------
function tag(x: number, y: number, s: string, bg: RGB, fg: RGB): void {
  const w = textW(s, 1) + 10;
  fill(x, y, w, 16, bg);
  drawText(x + 5, y + 5, s, 1, fg);
}

// HERO 1 — tariffs: globe left, brick wall right with % tags, ship BELOW the
// wall on the ground line (never overlapping a tag), red arrow on the wall.
function sceneTariffs(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, SKY);
  // sun, top right, above the wall
  circle(x + w - 22, y + 12, 9, GOLD);
  // globe, left
  const gx = x + 58, gy = y + 78, gr = 44;
  circle(gx, gy, gr, BLUE);
  circle(gx - 16, gy - 10, 13, GREEN);
  circle(gx + 14, gy + 6, 15, GREEN);
  circle(gx + 4, gy - 22, 9, GREEN);
  vline(gx, gy - gr, gr * 2, WHITE, 2);
  hline(gx - gr, gy, gr * 2, WHITE, 2);
  // brick wall, right — ends well above the ship
  const wx = x + 132, wy = y + 16, ww = w - 140, wh = 100;
  fill(wx, wy, ww, wh, BROWN);
  fill(wx, wy, ww, 4, REDDK);
  for (let r = 1; r < 6; r++) hline(wx, wy + r * 17, ww, [110, 80, 55], 2);
  for (let r = 0; r < 6; r++) {
    const off = r % 2 ? 22 : 0;
    for (let c = 0; c < 4; c++) vline(wx + off + c * 44, wy + r * 17, 17, [110, 80, 55], 2);
  }
  // % tags stacked on the wall, clear of the ship below
  tag(wx + 8, wy + 8, "CHINA 20%", RED, WHITE);
  tag(wx + 8, wy + 30, "VIETNAM 20%", NAVY, WHITE);
  tag(wx + 8, wy + 52, "INDIA 17%", NAVY, WHITE);
  tag(wx + 8, wy + 74, "EU 15%", NAVY, WHITE);
  // red down arrow on the wall, right of the tags
  const ax = wx + ww - 26, ay = wy + 30;
  fill(ax + 6, ay, 10, 34, RED);
  tri(ax, ay + 34, ax + 22, ay + 34, ax + 11, ay + 52, RED);
  // ground line
  hline(x, y + h - 8, w, [70, 90, 110], 3);
  // container ship on the ground line, BELOW the wall — no overlap with tags
  const sy = y + h - 26;
  fill(x + 132, sy, w - 140, 12, [40, 55, 75]);
  fill(x + 140, sy - 12, 30, 12, RED);
  fill(x + 174, sy - 12, 30, 12, GOLD);
  fill(x + 208, sy - 12, 30, 12, GREEN);
  fill(x + 242, sy - 12, 30, 12, BLUE);
}

// HERO 2 — Cairo: overturned tanker, wheels UP and big, hazard diamond,
// flames, burnt cars, smoke. Road is a solid band — no dashes at all.
function sceneCairo(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, CREAM);
  // smoke, top left
  circle(x + 60, y + 26, 14, GREY);
  circle(x + 84, y + 18, 17, GREY);
  circle(x + 108, y + 30, 12, GREY);
  // red casualty tag, top left, inside the scene
  tag(x + 8, y + 8, "31 DEAD · 21 HURT", RED, WHITE);
  // burnt-out cars, bottom left
  for (let i = 0; i < 3; i++) {
    const cx = x + 12 + i * 46;
    fill(cx, y + 118, 38, 14, [30, 30, 32]);
    tri(cx + 8, y + 118, cx + 16, y + 100, cx + 24, y + 118, ORANGE);
    tri(cx + 22, y + 118, cx + 28, y + 106, cx + 34, y + 118, GOLD);
  }
  // city blocks behind the tanker
  fill(x + 132, y + 96, 16, 36, GREY);
  fill(x + 152, y + 88, 14, 44, GREYDK);
  // the tanker, overturned: body low, BIG wheels on top
  const bx = x + 176, by = y + 104, bw = 138, bh = 28;
  fill(bx, by, bw, bh, [200, 205, 210]);
  fill(bx, by, 22, bh, RED); // cab
  fill(bx + 6, by + 7, 10, 12, BLUELT); // cab window
  // hazard diamond, centre of the body
  const dx = bx + 66, dy = by + 14;
  tri(dx, dy - 12, dx + 12, dy, dx, dy + 12, RED);
  tri(dx, dy - 12, dx - 12, dy, dx, dy + 12, WHITE);
  fill(dx - 2, dy - 6, 4, 12, RED);
  // big wheels on TOP of the body (the overturned cue)
  for (let i = 0; i < 4; i++) {
    const wx = bx + 8 + i * 34;
    circle(wx, by - 9, 11, [25, 25, 28]);
    circle(wx, by - 9, 5, GREY);
  }
  // flames rising between the wheels, inside the scene
  tri(bx + 26, by - 10, bx + 34, by - 44, bx + 42, by - 10, ORANGE);
  tri(bx + 58, by - 10, bx + 66, by - 52, bx + 74, by - 10, GOLD);
  tri(bx + 92, by - 10, bx + 100, by - 40, bx + 108, by - 10, ORANGE);
  // solid road band at the very bottom — no dashes, nothing bleeds out
  fill(x, y + h - 10, w, 10, [45, 48, 52]);
  hline(x, y + h - 10, w, WHITE, 2);
}

// HERO 3 — Shenzhou: rocket with flame CONTAINED inside the scene,
// Tiangong ring, China + Pakistan flags, astronaut silhouettes.
function sceneShenzhou(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, NAVY);
  // stars
  const stars: [number, number][] = [[30, 60], [90, 30], [150, 90], [230, 24], [290, 60], [60, 110], [260, 120], [200, 130], [120, 140], [40, 140]];
  for (const [sx, sy] of stars) fill(x + sx, y + sy, 3, 3, WHITE);
  // China flag, top left
  fill(x + 12, y + 10, 56, 32, RED);
  circle(x + 26, y + 22, 6, GOLD);
  dot(x + 42, y + 16, GOLD); dot(x + 46, y + 20, GOLD); dot(x + 42, y + 26, GOLD); dot(x + 38, y + 30, GOLD);
  // Pakistan flag, next to it
  fill(x + 76, y + 10, 56, 32, GREEN);
  fill(x + 76, y + 10, 14, 32, WHITE);
  circle(x + 108, y + 26, 9, WHITE);
  circle(x + 112, y + 26, 8, GREEN);
  dot(x + 118, y + 18, WHITE); dot(x + 120, y + 22, WHITE);
  // Tiangong ring, right
  const rx = x + w - 62, ry = y + 62;
  ring(rx, ry, 30, GOLD, 4);
  ring(rx, ry, 16, WHITE, 2);
  fill(rx - 52, ry - 5, 104, 10, GOLD);
  fill(rx - 10, ry - 10, 20, 20, WHITE);
  drawText(rx - 30, y + h - 22, "TIANGONG", 1, GOLD);
  // rocket, centre — flame ends well above the scene bottom
  const cx = x + 168;
  tri(cx - 16, y + 62, cx + 16, y + 62, cx, y + 34, RED); // nose
  fill(cx - 14, y + 62, 28, 52, WHITE); // body
  fill(cx - 14, y + 96, 28, 8, RED); // band
  circle(cx, y + 80, 6, BLUE); // window
  fill(cx - 22, y + 104, 8, 12, RED); // left fin
  fill(cx + 14, y + 104, 8, 12, RED); // right fin
  // flame: short, ends 14px above the scene bottom
  tri(cx - 9, y + 114, cx + 9, y + 114, cx, y + h - 16, ORANGE);
  tri(cx - 5, y + 114, cx + 5, y + 114, cx, y + h - 24, GOLD);
  // astronaut silhouettes, bottom left
  for (let i = 0; i < 3; i++) {
    const ax = x + 22 + i * 26;
    circle(ax, y + h - 34, 7, WHITE);
    fill(ax - 7, y + h - 26, 14, 18, WHITE);
  }
}

// ---------- mid scenes ----------
function sceneBalloon(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, SKY);
  // wind lines
  line(x + 8, y + 18, x + 30, y + 14, WHITE, 2);
  line(x + 8, y + 30, x + 34, y + 26, WHITE, 2);
  line(x + w - 34, y + 20, x + w - 10, y + 16, WHITE, 2);
  // character balloon: big red circle with a face, ropes holding it down
  const cx = x + w / 2, cy = y + 34, r = 26;
  circle(cx, cy, r, RED);
  circle(cx - 9, cy - 6, 3, WHITE);
  circle(cx + 9, cy - 6, 3, WHITE);
  dot(cx - 9, cy - 6, INK); dot(cx + 9, cy - 6, INK);
  tri(cx - 6, cy + 6, cx + 6, cy + 6, cx, cy + 12, GREEN);
  line(cx - 14, cy + r - 2, cx - 22, y + h - 6, INK, 2);
  line(cx + 14, cy + r - 2, cx + 22, y + h - 6, INK, 2);
  line(cx, cy + r - 2, cx, y + h - 6, INK, 2);
  fill(cx - 24, y + h - 8, 48, 4, INK);
}
function sceneKospi(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, WHITE);
  // chip, bottom left
  fill(x + 12, y + h - 34, 26, 26, [40, 48, 60]);
  fill(x + 18, y + h - 28, 14, 14, BLUELT);
  for (let i = 0; i < 4; i++) { fill(x + 14 + i * 6, y + h - 38, 3, 4, GREYDK); fill(x + 14 + i * 6, y + h - 4, 3, 4, GREYDK); }
  // steep red fall
  line(x + 14, y + 12, x + 60, y + 30, RED, 3);
  line(x + 60, y + 30, x + 100, y + 52, RED, 3);
  line(x + 100, y + 52, x + w - 12, y + h - 8, RED, 3);
  // arrow head at the end
  tri(x + w - 22, y + h - 16, x + w - 10, y + h - 16, x + w - 12, y + h - 4, RED);
}
function sceneDow(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, [235, 245, 235]);
  // record line, top
  hline(x + 8, y + 12, w - 16, GREEN, 2);
  // deep red plunge then green recovery — a V
  line(x + 12, y + 18, x + w / 2 - 6, y + h - 14, RED, 3);
  line(x + w / 2 - 6, y + h - 14, x + w - 12, y + 16, GREEN, 3);
  // low point marker
  circle(x + w / 2 - 6, y + h - 14, 4, RED);
}
function sceneHouse(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, CREAM);
  // house
  const hx = x + 14, hy = y + 26;
  fill(hx, hy + 18, 56, 34, [210, 180, 140]);
  tri(hx - 6, hy + 20, hx + 62, hy + 20, hx + 28, hy, [170, 70, 40]);
  fill(hx + 22, hy + 32, 12, 20, [90, 60, 40]);
  fill(hx + 40, hy + 24, 12, 12, BLUELT);
  // flame (rising costs)
  tri(hx + 58, y + h - 14, hx + 63, y + h - 30, hx + 68, y + h - 14, ORANGE);
  // bill, right
  fill(x + w - 52, y + 16, 40, 48, WHITE);
  fill(x + w - 52, y + 16, 40, 10, RED);
  circle(x + w - 32, y + 42, 9, RED);
  drawText(x + w - 35, y + 39, "!", 1, WHITE);
  hline(x + w - 46, y + 54, 28, GREY, 2);
}
function sceneRefinery(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, [225, 228, 232]);
  // towers
  fill(x + 12, y + 30, 18, h - 30, GREYDK);
  fill(x + 34, y + 18, 22, h - 18, GREY);
  fill(x + 60, y + 38, 16, h - 38, GREYDK);
  tri(x + 34, y + 18, x + 56, y + 18, x + 45, y + 6, GREY);
  // black smoke column
  circle(x + 96, y + 22, 12, [30, 30, 32]);
  circle(x + 104, y + 38, 10, [45, 45, 48]);
  circle(x + 92, y + 48, 8, [60, 60, 63]);
  // drone, crossed out (intercepted)
  const dx = x + w - 34, dy = y + 26;
  line(dx - 8, dy - 6, dx + 8, dy + 6, INK, 2);
  line(dx - 8, dy + 6, dx + 8, dy - 6, INK, 2);
  line(dx - 14, dy - 14, dx + 14, dy + 14, RED, 3);
  line(dx - 14, dy + 14, dx + 14, dy - 14, RED, 3);
  // oil barrel
  fill(x + 84, y + h - 22, 18, 22, [40, 60, 90]);
  fill(x + 84, y + h - 22, 18, 4, [30, 45, 70]);
}
function sceneCourt(x: number, y: number, w: number, h: number): void {
  fill(x, y, w, h, [238, 238, 244]);
  // courthouse
  const cx = x + 12;
  tri(cx, y + 26, cx + 76, y + 26, cx + 38, y + 8, NAVY);
  fill(cx + 2, y + 26, 72, 6, NAVY);
  for (let i = 0; i < 4; i++) fill(cx + 6 + i * 18, y + 32, 8, 30, WHITE);
  fill(cx, y + 62, 76, 6, NAVY);
  // gavel, right
  line(x + w - 44, y + 30, x + w - 20, y + 54, BROWN, 4);
  fill(x + w - 52, y + 22, 22, 10, BROWN);
  fill(x + w - 46, y + 34, 10, 6, BROWN);
  // scales
  line(x + w - 16, y + 44, x + w - 16, y + 62, GOLD, 2);
}

// ---------- layout ----------
const COLS = [
  { x: 8, w: 330 },
  { x: 344, w: 330 },
  { x: 680, w: 336 },
];
function hero(col: number, tagText: string, tagBg: RGB, scene: (x: number, y: number, w: number, h: number) => void,
  headline: string, why: string[], detail: string): void {
  const { x, w } = COLS[col];
  tag(x, 74, tagText, tagBg, WHITE);
  scene(x, 92, w, 156);
  const hl = wrap(headline, 3, w);
  drawLines(x, 254, hl, 3, 23, INK);
  // why-it-matters, highlighted
  const wy = 330;
  fill(x, wy - 4, w, 12 + why.length * 11 + 4, [255, 243, 196]);
  drawText(x, wy, "WHY IT MATTERS", 1, RED);
  drawLines(x, wy + 12, why, 1, 11, INK);
  const dy = wy + 12 + why.length * 11 + 6;
  const dl = wrap(detail, 1, w);
  drawLines(x, dy, dl, 1, 11, MUTED);
}

const MIDCOLS = [8, 177, 346, 515, 684, 853];
const MIDW = 163;
function mid(i: number, scene: (x: number, y: number, w: number, h: number) => void,
  headline: string[], big: string, bigC: RGB, tags: string[]): void {
  const x = MIDCOLS[i];
  scene(x, 400, MIDW, 82);
  drawLines(x, 488, headline, 1, 11, INK);
  drawText(x, 514, big, 2, bigC);
  drawLines(x, 534, tags, 1, 11, MUTED);
}

const BRIEFCOLS = [
  { x: 8, w: 195, name: "MIDDLE EAST", c: RED },
  { x: 211, w: 195, name: "ASIA-PACIFIC", c: [0, 90, 140] as RGB },
  { x: 414, w: 195, name: "EUROPE", c: [90, 60, 140] as RGB },
  { x: 617, w: 195, name: "AMERICAS", c: [0, 110, 90] as RGB },
  { x: 820, w: 196, name: "GLOBAL", c: [120, 80, 20] as RGB },
];
type Brief = [string, string];
function briefCol(ci: number, briefs: Brief[], y0 = 608, pitch = 28): number {
  const { x, w, name, c } = BRIEFCOLS[ci];
  drawText(x, 582, name, 2, c);
  hline(x, 598, w, c, 2);
  let y = y0;
  for (const [h, d] of briefs) {
    drawTextFit(x, y, h, 1, w, INK);
    drawTextFit(x, y + 10, d, 1, w, MUTED);
    y += pitch;
  }
  return y;
}
function subhead(ci: number, y: number, s: string, c: RGB): void {
  const { x, w } = BRIEFCOLS[ci];
  drawText(x, y, s, 2, c);
  hline(x, y + 16, w, c, 2);
}

const ME: Brief[] = [
  ["BOGOR GOLD MINE FLOODS", "9 DEAD, 17 TRAPPED, 100M SHAFT"],
  ["SUDAN DRONE STRIKES", "19 KILLED IN BLUE NILE"],
  ["GAZA STRIKE KILLS HAMAS", "OFFICIAL, WIFE, 2 DAUGHTERS"],
  ["US: CITIZENS, LEAVE IRAN", "TENSIONS RISE"],
  ["UKRAINE HITS RUSSIAN SHIP", "CORVETTE OFF BENGHAZI"],
  ["IRAQ ORDERS TROOPS TO BORDERS", "OIL OVERSIGHT"],
  ["COALITION HITS HODEIDAH", "MISSILE PLATFORM DESTROYED"],
  ["IRAN WEAPONS CLAIM", "CHEMICAL ARMS ALLEGED"],
  ["30+ NATIONS: RUSSIA, STOP", "CHEMICAL AGENTS IN UKRAINE"],
  ["INDIA CONDEMNS RIYADH HIT", "11 WOUNDED, 2 INDIANS"],
];
const AP: Brief[] = [
  ["SOLOMON ISLANDS TREATY", "AUSTRALIA TOP SECURITY PARTNER"],
  ["BANGLADESH WAGE +36%", "17,000 TAKAS MINIMUM"],
  ["CHINA PROBES SHANGHAI CHIEF", "4TH TOP LEADER SINCE 2025"],
  ["N. KOREA EXPELS SWISS ENVOY", "OFFICE TO CLOSE IN 48H"],
  ["HONG KONG: 1 YEAR ON", "168 NAMES READ (ANNIVERSARY)"],
  ["JAPAN: DATA-CENTRE REVOLT", "AI POWER BOOM SPARKS ROW"],
  ["TAIWAN VOTES SATURDAY", "AI FAKES FEARED"],
  ["CANADA TIGHTENS STUDENT RULES", "FOREIGN-STUDENT CAPS"],
  ["INDIA-MALAYSIA DRILL OPENS", "HARIMAU SHAKTI IN IPOH"],
];
const EU: Brief[] = [
  ["SPAIN VOTES SUNDAY", "FAR RIGHT MAY ENTER GOVT"],
  ["MI5 WARNS OF RUSSIAN SABOTAGE", "UK FIRMS ON ALERT"],
  ["POLAND NO-FLY ZONE", "NEAR UKRAINE BORDER"],
  ["UK AI WARNING", "WATCHDOG VS META MUSE AI"],
  ["SARKOZY TO STAND TRIAL 2027", "WITNESS-TAMPERING CASE"],
  ["LONDON MUSEUM REOPENS", "VICTORIAN HALL SATURDAY"],
];
const SPORT: Brief[] = [
  ["NBA: NETS 104, BUCKS 97", "RANDLE 28 PTS, CUP WIN"],
  ["MLB SUES PLAYERS' UNION", "38-PAGE LOCKOUT COMPLAINT"],
];
const AM: Brief[] = [
  ["MISSISSIPPI PLANE CRASH", "6 DEAD, FAMILY OF 6"],
  ["IOWA BLAST: 4,400 KG", "20-MILE SHELTER, ZERO LEAD FOUND"],
  ["VENEZUELA DEBT: $237.5BN", "242% OF GDP (DISCLOSED TUE)"],
  ["CIA NETWORK HACKED", "OSINT HIT, CHINA SUSPECTED"],
  ["DOJ CHARGES 800+ IN SCAMS", "400 CASES WORLDWIDE"],
  ["NSA NETWORK DOWN FOR DAYS", "BAD UPDATE, NOT A HACK"],
  ["TRUMP: FUNDING IRAN WAR PREP", "THROUGH JANUARY"],
  ["MEASLES: 9 US DEATHS IN 2026", "CDC REPORT"],
];
const GL: Brief[] = [
  ["UKRAINE NEEDS EUR 115BN", "EUR 25BN GAP FOR 2027"],
  ["RUSSIAN WAR DEAD 490,334+", "LEAKED DATA, UP TO 700K"],
  ["LANDMINE DEATHS 5-YEAR HIGH", "GLOBAL TOLL RISES"],
  ["WHO: END CUBA FUEL BLOCKADE", "CHIEF URGES US"],
  ["MALAYSIA RETURNS REFUGEES", "THOUSANDS TO MYANMAR"],
  ["AIRPORTS COURT PRIVATE CASH", "EXPANSION FUNDING"],
];

// ---------- main ----------
function main(): void {
  fill(0, 0, W, H, PAPER);
  // header
  fill(0, 0, W, 66, NAVY);
  drawText(16, 8, "THE WEDNESDAY WIRE", 5, WHITE);
  drawText(16, 46, "WEDNESDAY 25 NOVEMBER 2026", 2, GOLD);
  fill(824, 10, 184, 44, RED);
  drawText(834, 22, "50 STORIES", 3, WHITE);
  fill(0, 66, W, 4, GOLD);

  // heroes
  hero(0, "LEAD · TARIFFS", RED, sceneTariffs,
    "TRUMP PROPOSES NEW TARIFFS ON 14 ECONOMIES",
    ["US HOUSEHOLDS PAY ~$900 A YEAR", "UNDER THE NEW DUTIES"],
    "CHINA 20% (40% IF TRUCE FAILS) · VIETNAM 20%/35% · INDIA 17%/25% · EU 15%");
  hero(1, "CAIRO", ORANGE, sceneCairo,
    "CAIRO TANKER FIRE KILLS 31",
    ["27 VEHICLES BURNED. RING ROAD", "SHUT AFTER THE BLAST"],
    "CAUSE: CAR HIT TANKER, IT OVERTURNED AND CAUGHT FIRE");
  hero(2, "SPACE", BLUE, sceneShenzhou,
    "CHINA SENDS FIRST PAKISTANI TO ORBIT",
    ["FIRST FOREIGNER ABOARD", "TIANGONG STATION"],
    "CREW: TANG HONGBO · WU YI · ZEESHAN ALI · 03:56 UTC");
  hline(8, 396, 1008, [200, 200, 195], 2);

  // mids
  mid(0, sceneBalloon, ["MACY'S 100TH PARADE", "POSTPONED — FIRST TIME"], "60 MPH", RED, ["GUSTS · SAT 28 NOV"]);
  mid(1, sceneKospi, ["KOSPI CRASHES 6.2%", "AI FEARS RETURN"], "-6.2%", RED, ["SAMSUNG -9.9%", "SK HYNIX -11.1%"]);
  mid(2, sceneDow, ["DOW ERASES 1,100-PT", "PLUNGE, RECORD CLOSE"], "50,183", GREEN, ["-1,100 → +164 · +0.33%"]);
  mid(3, sceneHouse, ["UK ENERGY CAP +26%", "TO £2,166 A YEAR"], "+26%", RED, ["£1,723 → £2,166 · +£443"]);
  mid(4, sceneRefinery, ["HOUTHIS CLAIM REFINERY", "STRIKE — RAS TANURA"], "550K BPD", INK, ["BRENT $93.60 +2.41%"]);
  mid(5, sceneCourt, ["JUDGES: DROP NETANYAHU", "BRIBERY CASE"], "CASE 4000", INK, ["RECOMMEND, NOT A RULING"]);
  hline(8, 576, 1008, [200, 200, 195], 2);

  // briefs
  briefCol(0, ME);
  briefCol(1, AP);
  let yEU = briefCol(2, EU);
  subhead(2, yEU + 4, "SPORT", [120, 80, 20]);
  briefCol(2, SPORT, yEU + 26, 28);
  briefCol(3, AM);
  let yGL = briefCol(4, GL);
  const note = wrap("EVERY STORY DATE-CHECKED FOR WED 25 NOV 2026", 1, BRIEFCOLS[4].w);
  drawLines(BRIEFCOLS[4].x, yGL + 8, note, 1, 11, MUTED);

  // footer
  fill(0, 912, W, H - 912, NAVY);
  drawText(16, 922, "CLAIMED VS CONFIRMED", 2, GOLD);
  drawText(16, 942, "CAIRO 31/21 CONFIRMED NEXT MORNING · BOGOR 9/17 IS THE 25 NOV FIGURE", 1, WHITE);
  drawText(16, 956, "HONG KONG FIRE = 2025 ANNIVERSARY, NOT A NEW FIRE · VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25", 1, WHITE);
  // date check box, top right of footer
  const dc = "DATE CHECK: WED 25 NOV 2026";
  const dcw = textW(dc, 2) + 20;
  fill(W - 16 - dcw, 920, dcw, 30, NAVY2);
  for (let k = 0; k < 2; k++) {
    hline(W - 16 - dcw, 920 + k, dcw, GOLD, 1);
    hline(W - 16 - dcw, 949 - k, dcw, GOLD, 1);
    vline(W - 16 - dcw + k, 920, 30, GOLD, 1);
    vline(W - 16 - dcw + dcw - 1 - k, 920, 30, GOLD, 1);
  }
  drawText(W - 16 - dcw + 10, 930, dc, 2, GOLD);
  // markets strip
  drawText(16, 976, "DOW 50,182.95 +0.33% · S&P 7,182.78 -0.25% · NASDAQ 23,585.80 -0.62% · KOSPI -6.16% · BRENT $93.60 · GOLD $3,598.10 · BITCOIN $60,200.94 · 10-YR 4.85%", 1, GOLD);
  // sources
  drawText(16, 994, "SOURCES: REUTERS · AP · BBC · NYT · ESPN · OFGEM · PIB · AL JAZEERA · MARKETS CLOSED THU 26 NOV (THANKSGIVING), FRI HALF-DAY", 1, [180, 195, 210]);

  mkdirSync("/output", { recursive: true });
  const png = encodePNG(px, W, H);
  writeFileSync(OUT, png);
  console.log("TRUNCATIONS: " + truncations);
  console.log("WROTE " + png.length + " bytes to " + OUT);
}
main();
