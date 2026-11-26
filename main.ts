// THE WEDNESDAY WIRE — v3
// Sum up Wednesday 25 November 2026 in one image.
// 50 stories: 3 heroes + 6 mids + 41 briefs. Tariff lead, why-it-matters layer,
// CLAIMED vs CONFIRMED honesty box, DATE CHECK, markets strip, sources.
// Fresh build. Node stdlib only. Own 5x7 bitmap font + own PNG encoder.
// v3 fixes vs v2: Macy's balloon face redrawn (clean smile, no green triangle);
// briefs columns rebalanced 8/9/8/9/7 so no column ends far above the footer;
// China flag star drawn as a star (was a big circle); stray sun removed from H1.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const px = Buffer.alloc(W * H * 4); // RGBA
let TRUNCATIONS = 0;

// ---------- colours ----------
const C = {
  navy: [10, 37, 64, 255],
  navy2: [13, 52, 88, 255],
  paper: [247, 243, 232, 255],
  cream: [250, 246, 235, 255],
  ink: [26, 26, 26, 255],
  gray: [90, 107, 122, 255],
  gold: [245, 179, 1, 255],
  goldDk: [212, 144, 0, 255],
  red: [210, 31, 43, 255],
  redDk: [168, 20, 30, 255],
  green: [34, 139, 34, 255],
  greenLt: [232, 245, 233, 255],
  sky: [191, 227, 242, 255],
  skyLt: [214, 234, 248, 255],
  sand: [245, 230, 200, 255],
  space: [10, 37, 64, 255],
  white: [255, 255, 255, 255],
  black: [0, 0, 0, 255],
  brick: [160, 113, 79, 255],
  brickDk: [125, 86, 56, 255],
  blue: [43, 108, 176, 255],
  blueLt: [147, 197, 253, 255],
  orange: [234, 88, 12, 255],
  yellow: [250, 204, 21, 255],
  grayLt: [192, 192, 192, 255],
  grayMd: [128, 128, 128, 255],
  grayDk: [64, 64, 64, 255],
  teal: [0, 128, 128, 255],
  purple: [107, 70, 158, 255],
  brown: [139, 90, 43, 255],
  flagRed: [222, 41, 16, 255],
  flagGreen: [1, 65, 28, 255],
};

// ---------- pixel primitives ----------
function setPx(x: number, y: number, c: number[]) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
}
function fillRect(x: number, y: number, w: number, h: number, c: number[]) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function hline(x0: number, x1: number, y: number, c: number[], th = 1) {
  for (let t = 0; t < th; t++) for (let x = x0; x <= x1; x++) setPx(x, y + t, c);
}
function vline(x: number, y0: number, y1: number, c: number[], th = 1) {
  for (let t = 0; t < th; t++) for (let y = y0; y <= y1; y++) setPx(x + t, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[], th = 1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) setPx(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function circle(cx: number, cy: number, r: number, c: number[]) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPx(x, y, c);
}
function ring(cx: number, cy: number, r: number, c: number[], th = 3) {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    for (let t = 0; t < th; t++)
      setPx(Math.round(cx + (r - t) * Math.cos(rad)), Math.round(cy + (r - t) * Math.sin(rad)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]) {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) setPx(x, y, c);
    }
}
// small 5-point star centred at (cx,cy), outer radius r, colour c
function star(cx: number, cy: number, r: number, c: number[]) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([Math.round(cx + rr * Math.cos(ang)), Math.round(cy + rr * Math.sin(ang))]);
  }
  for (let i = 1; i < 9; i++) tri(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c);
}

// ---------- CRC32 + PNG ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 5x7 bitmap font ('#' on, '.' off) ----------
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
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
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
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "\u00b7": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "\u00a3": ["00110", "01000", "01110", "01000", "01111", "01000", "11111"],
  "\u2192": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  "~": ["00000", "00000", "01001", "10110", "00000", "00000", "00000"],
};
// draw one glyph at (x,y), scale s, colour c
function drawChar(ch: string, x: number, y: number, s: number, c: number[]) {
  const g = FONT[ch];
  if (!g) { TRUNCATIONS++; return; }
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r][col] === "1") fillRect(x + col * s, y + r * s, s, s, c);
}
function textWidth(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}
// draw text; if maxW given and text is wider, clip + count truncation
function drawText(s: string, x: number, y: number, sc: number, c: number[], maxW?: number) {
  const w = textWidth(s, sc);
  if (maxW !== undefined && w > maxW) { TRUNCATIONS++; }
  let cx = x;
  for (const ch of s) {
    if (maxW !== undefined && cx + 5 * sc > x + maxW) break;
    drawChar(ch, cx, y, sc, c);
    cx += 6 * sc;
  }
}
function drawTextCentered(s: string, cx: number, y: number, sc: number, c: number[], maxW?: number) {
  drawText(s, cx - Math.floor(textWidth(s, sc) / 2), y, sc, c, maxW);
}

// ---------- hero scenes ----------
// Hero 1: tariff wall + globe + container ship + red down arrow. (x0,y0) = scene top-left, w = width.
function heroTariffs(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.sky);
  // globe, left
  const gx = x0 + 62, gy = y0 + 78, gr = 52;
  circle(gx, gy, gr, C.blue);
  circle(gx - 18, gy - 14, 13, C.green);
  circle(gx + 16, gy + 10, 15, C.green);
  circle(gx + 20, gy - 20, 9, C.green);
  vline(gx, gy - gr, gy + gr, C.white, 2);
  hline(gx - gr, gx + gr, gy, C.white, 2);
  // brick wall, right of globe
  const wx = x0 + 138, wy = y0 + 16, ww = w - 150, wh = 108;
  fillRect(wx, wy, ww, wh, C.brick);
  hline(wx, wx + ww, wy, C.redDk, 3);
  for (let r = 1; r < 6; r++) hline(wx, wx + ww, wy + r * 18, C.brickDk, 1);
  for (let r = 0; r < 6; r++)
    for (let b = 0; b < 4; b++) {
      const bx = wx + ((r % 2) * 24) + b * 48;
      if (bx < wx + ww) vline(bx, wy + r * 18, wy + (r + 1) * 18, C.brickDk, 1);
    }
  // % tags on the wall (left edge)
  const tags: [string, number[]][] = [
    ["CHINA 20%", C.red],
    ["VIETNAM 20%", C.navy],
    ["INDIA 17%", C.navy],
    ["EU 15%", C.navy],
  ];
  let ty = wy + 8;
  for (const [t, bg] of tags) {
    const tw = textWidth(t, 1) + 10;
    fillRect(wx + 6, ty, tw, 15, bg);
    drawText(t, wx + 11, ty + 4, 1, C.white);
    ty += 19;
  }
  // red down arrow, right edge of wall
  const ax = wx + ww - 26;
  fillRect(ax + 6, wy + 22, 8, 52, C.red);
  tri(ax, wy + 74, ax + 20, wy + 74, ax + 10, wy + 96, C.red);
  // container ship at the foot of the wall
  const sy = y0 + h - 16;
  const contCols = [C.red, C.yellow, C.green, C.blue];
  let cx = wx + 4;
  for (const cc of contCols) { fillRect(cx, sy - 12, 40, 12, cc); cx += 42; }
  fillRect(wx, sy, ww, 14, C.navy);
}

// Hero 2: overturned tanker, wheels up, hazard diamond, flames, burnt cars, smoke.
function heroCairo(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.sand);
  // smoke plume, top-left
  circle(x0 + 40, y0 + 26, 16, C.grayMd);
  circle(x0 + 66, y0 + 18, 20, C.grayMd);
  circle(x0 + 96, y0 + 28, 14, C.grayMd);
  // "31 DEAD · 21 HURT" tag
  const tag = "31 DEAD · 21 HURT";
  fillRect(x0 + 10, y0 + 44, textWidth(tag, 1) + 12, 17, C.red);
  drawText(tag, x0 + 16, y0 + 49, 1, C.white);
  // road
  fillRect(x0, y0 + h - 14, w, 14, C.grayDk);
  // burnt-out cars, left, with flames
  for (let i = 0; i < 3; i++) {
    const bx = x0 + 12 + i * 62;
    fillRect(bx, y0 + h - 34, 52, 20, C.black);
    tri(bx + 10, y0 + h - 34, bx + 20, y0 + h - 34, bx + 15, y0 + h - 56, C.orange);
    tri(bx + 26, y0 + h - 34, bx + 34, y0 + h - 34, bx + 30, y0 + h - 50, C.yellow);
  }
  // overturned tanker: body with wheels on TOP
  const tx = x0 + 196, ty = y0 + 78, tw = 128, th = 40;
  fillRect(tx, ty, tw, th, C.grayLt); // tank body
  fillRect(tx - 26, ty + 8, 26, 32, C.red); // cab (red, on the side)
  fillRect(tx - 20, ty + 14, 12, 12, C.blueLt); // cab window
  // wheels up
  for (let i = 0; i < 4; i++) {
    const wx = tx + 8 + i * 30;
    circle(wx, ty - 8, 11, C.black);
    circle(wx, ty - 8, 5, C.grayMd);
  }
  // hazard diamond on the tank
  const dx = tx + 88, dy = ty + 20;
  tri(dx, dy - 12, dx + 12, dy, dx, dy + 12, C.red);
  tri(dx, dy - 12, dx - 12, dy, dx, dy + 12, C.white);
  tri(dx, dy + 12, dx + 12, dy, dx, dy - 12, C.red);
  // flames licking the tank
  tri(tx + 30, ty, tx + 42, ty, tx + 36, ty - 26, C.orange);
  tri(tx + 62, ty, tx + 72, ty, tx + 67, ty - 30, C.yellow);
  tri(tx + 96, ty, tx + 106, ty, tx + 101, ty - 22, C.orange);
  // grey support pillars behind
  fillRect(x0 + 176, y0 + h - 62, 14, 48, C.grayMd);
}

// Hero 3: rocket + Tiangong + flags + astronauts.
function heroSpace(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.space);
  // stars
  const stars: [number, number][] = [
    [14, 12], [52, 44], [120, 20], [168, 60], [210, 16], [250, 90], [40, 110], [300, 40], [150, 130], [230, 120], [90, 138], [280, 130],
  ];
  for (const [sx, sy] of stars) fillRect(x0 + sx, y0 + sy, 2, 2, C.white);
  // China flag: red, yellow 5-point star (v3: a real star, not a circle)
  fillRect(x0 + 10, y0 + 12, 74, 42, C.flagRed);
  star(x0 + 26, y0 + 30, 9, C.yellow);
  // Pakistan flag: green, white stripe + white crescent
  fillRect(x0 + 92, y0 + 12, 74, 42, C.flagGreen);
  fillRect(x0 + 92, y0 + 12, 16, 42, C.white);
  circle(x0 + 138, y0 + 33, 12, C.white);
  circle(x0 + 143, y0 + 33, 10, C.flagGreen);
  star(x0 + 152, y0 + 26, 3, C.white);
  // rocket, centre
  const rx = x0 + 178, ry = y0 + 34;
  tri(rx + 6, ry, rx + 26, ry, rx + 16, ry - 22, C.red); // nose cone
  fillRect(rx, ry, 32, 62, C.white); // body
  fillRect(rx, ry + 62, 32, 8, C.red); // base band
  circle(rx + 16, ry + 26, 7, C.blue); // window
  fillRect(rx - 8, ry + 52, 8, 18, C.red); // left fin
  fillRect(rx + 32, ry + 52, 8, 18, C.red); // right fin
  tri(rx + 8, ry + 70, rx + 24, ry + 70, rx + 16, ry + 96, C.orange); // flame
  tri(rx + 11, ry + 70, rx + 21, ry + 70, rx + 16, ry + 88, C.yellow);
  // Tiangong station, right
  const tx = x0 + 268, ty = y0 + 78;
  ring(tx, ty, 30, C.gold, 4);
  fillRect(tx - 44, ty - 5, 88, 10, C.gold);
  fillRect(tx - 10, ty - 12, 20, 24, C.white);
  ring(tx, ty, 16, C.white, 2);
  drawText("TIANGONG", x0 + w - 66, y0 + h - 22, 1, C.gold);
  // three astronaut silhouettes, bottom-left
  for (let i = 0; i < 3; i++) {
    const ax = x0 + 16 + i * 30;
    circle(ax + 9, y0 + h - 34, 8, C.white);
    fillRect(ax, y0 + h - 24, 18, 22, C.white);
  }
}

// ---------- mid scenes (each ~170 wide, 100 tall) ----------
// Macy's balloon: clean character face — two dark eyes + a smile arc.
// v2's green triangle read like a beak at 2x zoom; v3 removes it entirely.
function midMacys(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.skyLt);
  // wind lines
  hline(x0 + 8, x0 + 34, y0 + 26, C.white, 2);
  hline(x0 + 12, x0 + 30, y0 + 34, C.white, 2);
  hline(x0 + w - 36, x0 + w - 10, y0 + 30, C.white, 2);
  // balloon
  const cx = x0 + Math.floor(w / 2), cy = y0 + 44, r = 30;
  circle(cx, cy, r, C.red);
  // face: two dark eyes
  fillRect(cx - 13, cy - 8, 5, 5, C.navy);
  fillRect(cx + 8, cy - 8, 5, 5, C.navy);
  // smile: shallow arc of dark pixels
  const smile: [number, number][] = [
    [-11, 8], [-8, 11], [-5, 13], [-2, 14], [1, 14], [4, 13], [7, 11], [10, 8],
  ];
  for (const [dx, dy] of smile) fillRect(cx + dx, cy + dy, 3, 3, C.navy);
  // ropes to a base
  line(cx - 12, cy + r - 2, cx - 16, y0 + h - 6, C.navy, 2);
  line(cx + 12, cy + r - 2, cx + 16, y0 + h - 6, C.navy, 2);
  fillRect(cx - 22, y0 + h - 8, 44, 6, C.navy);
}
// Kospi: falling red chart + chip.
function midKospi(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.cream);
  // chip
  fillRect(x0 + 12, y0 + 52, 30, 30, C.navy);
  fillRect(x0 + 20, y0 + 60, 14, 14, C.blueLt);
  for (let i = 0; i < 3; i++) {
    fillRect(x0 + 4, y0 + 56 + i * 10, 8, 3, C.navy);
    fillRect(x0 + 42, y0 + 56 + i * 10, 8, 3, C.navy);
  }
  // falling chart
  line(x0 + 56, y0 + 10, x0 + 96, y0 + 46, C.red, 3);
  line(x0 + 96, y0 + 46, x0 + 136, y0 + 78, C.red, 3);
  tri(x0 + 128, y0 + 70, x0 + 144, y0 + 84, x0 + 136, y0 + 88, C.red);
}
// Dow: V-shaped recovery chart.
function midDow(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.greenLt);
  hline(x0 + 8, x0 + w - 8, y0 + 12, C.green, 2);
  line(x0 + 12, y0 + 12, x0 + 78, y0 + 74, C.red, 3);
  line(x0 + 78, y0 + 74, x0 + 156, y0 + 14, C.green, 3);
  circle(x0 + 78, y0 + 74, 4, C.red);
}
// UK energy: house + bill with red "!" + small flame.
function midUK(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.cream);
  // house
  tri(x0 + 10, y0 + 44, x0 + 66, y0 + 44, x0 + 38, y0 + 18, C.brown);
  fillRect(x0 + 16, y0 + 44, 44, 38, [214, 182, 140, 255]);
  fillRect(x0 + 22, y0 + 52, 12, 12, C.blueLt);
  fillRect(x0 + 42, y0 + 62, 12, 20, C.brown);
  // bill / meter
  fillRect(x0 + 96, y0 + 16, 48, 58, C.white);
  fillRect(x0 + 96, y0 + 16, 48, 12, C.red);
  circle(x0 + 120, y0 + 46, 11, C.red);
  drawText("!", x0 + 117, y0 + 40, 1, C.white);
  hline(x0 + 104, x0 + 136, y0 + 64, C.grayMd, 2);
  // small flame
  tri(x0 + 78, y0 + 82, x0 + 90, y0 + 82, x0 + 84, y0 + 64, C.orange);
}
// Houthis: refinery towers + black smoke + red X (intercepted) + barrel.
function midHouthis(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, [232, 232, 232, 255]);
  fillRect(x0 + 12, y0 + 46, 20, 44, C.grayMd);
  fillRect(x0 + 38, y0 + 28, 24, 62, C.grayLt);
  fillRect(x0 + 68, y0 + 52, 18, 38, C.grayMd);
  // smoke column
  circle(x0 + 112, y0 + 30, 12, C.black);
  circle(x0 + 126, y0 + 44, 11, C.black);
  circle(x0 + 110, y0 + 56, 9, C.black);
  // red X over the smoke = intercepted
  line(x0 + 128, y0 + 14, x0 + 158, y0 + 44, C.red, 4);
  line(x0 + 158, y0 + 14, x0 + 128, y0 + 44, C.red, 4);
  // barrel
  fillRect(x0 + 104, y0 + 72, 20, 18, C.navy);
}
// Netanyahu: courthouse + gavel.
function midNetanyahu(x0: number, y0: number, w: number, h: number) {
  fillRect(x0, y0, w, h, C.skyLt);
  tri(x0 + 10, y0 + 26, x0 + 96, y0 + 26, x0 + 53, y0 + 6, C.navy);
  for (let i = 0; i < 3; i++) fillRect(x0 + 18 + i * 28, y0 + 28, 12, 48, C.white);
  fillRect(x0 + 10, y0 + 76, 86, 8, C.navy);
  // gavel, diagonal
  line(x0 + 116, y0 + 30, x0 + 152, y0 + 66, C.brown, 5);
  fillRect(x0 + 112, y0 + 22, 22, 12, C.brown);
  fillRect(x0 + 146, y0 + 62, 14, 4, C.goldDk);
}

// ---------- layout ----------
function header() {
  fillRect(0, 0, W, 58, C.navy);
  drawText("THE WEDNESDAY WIRE", 16, 8, 4, C.white);
  drawText("WEDNESDAY 25 NOVEMBER 2026", 16, 40, 2, C.gold);
  // red "50 STORIES" badge
  fillRect(820, 10, 192, 38, C.red);
  drawTextCentered("50 STORIES", 916, 19, 3, C.white);
  hline(0, W - 1, 58, C.gold, 2);
}

const HERO_X = [8, 350, 692];
const HERO_W = [334, 334, 330];
function hero(col: number, tag: string, tagBg: number[], scene: (x: number, y: number, w: number, h: number) => void,
  headline: string[], why: string[], detail: string[]) {
  const x = HERO_X[col], w = HERO_W[col];
  // tag chip
  fillRect(x, 62, textWidth(tag, 1) + 12, 16, tagBg);
  drawText(tag, x + 6, 66, 1, C.white);
  // scene
  scene(x, 80, w, 152);
  // headline, scale 3
  let hy = 240;
  for (const ln of headline) { drawText(ln, x, hy, 3, C.ink, w); hy += 24; }
  // why-it-matters box
  fillRect(x, 314, w, 46, [253, 243, 208, 255]);
  drawText("WHY IT MATTERS", x + 8, 318, 1, C.red);
  drawText(why[0], x + 8, 331, 1, C.ink, w - 16);
  if (why[1]) drawText(why[1], x + 8, 343, 1, C.ink, w - 16);
  // detail line(s)
  let dy = 366;
  for (const ln of detail) { drawText(ln, x, dy, 1, C.gray, w); dy += 12; }
}

const MID_X = [8, 178, 348, 518, 688, 858];
const MID_W = 162;
function mid(col: number, scene: (x: number, y: number, w: number, h: number) => void,
  headline: string[], big: string, bigC: number[], sub: string[]) {
  const x = MID_X[col];
  scene(x, 392, MID_W, 100);
  let hy = 498;
  for (const ln of headline) { drawText(ln, x, hy, 1, C.ink, MID_W); hy += 11; }
  drawText(big, x, 524, 3, bigC, MID_W);
  let sy = 550;
  for (const ln of sub) { drawText(ln, x, sy, 1, C.gray, MID_W); sy += 11; }
}

// briefs: columns rebalanced 8/9/8/9/7 (v2 was 10/9/6+2/8/6) so every column
// ends within ~35px of the footer instead of GLOBAL ending ~110px above it.
const BRIEF_X = [8, 213, 418, 623, 828];
const BRIEF_W = 192;
const BRIEF_Y = 612;
const BRIEF_PITCH = 32;
type Brief = [string, string];
const COLUMNS: { name: string; color: number[]; items: Brief[] }[] = [
  {
    name: "MIDDLE EAST", color: C.red, items: [
      ["BOGOR GOLD MINE FLOODS", "9 DEAD, 17 TRAPPED, 100M SHAFT"],
      ["SUDAN DRONE STRIKES", "19 KILLED IN BLUE NILE"],
      ["GAZA STRIKE KILLS HAMAS", "OFFICIAL, WIFE, 2 DAUGHTERS"],
      ["US: CITIZENS LEAVE IRAN", "TENSIONS RISE"],
      ["UKRAINE HITS RUSSIAN SHIP", "CORVETTE OFF BENGHAZI"],
      ["IRAQ ORDERS TROOPS TO BORDERS", "OIL OVERSIGHT"],
      ["COALITION HITS HODEIDAH", "MISSILE PLATFORM DESTROYED"],
      ["IRAN WEAPONS CLAIM", "CHEMICAL ARMS ALLEGED"],
    ],
  },
  {
    name: "ASIA-PACIFIC", color: C.teal, items: [
      ["SOLOMON ISLANDS TREATY", "AUSTRALIA TOP SECURITY PARTNER"],
      ["BANGLADESH WAGE +36%", "17,000 TAKAS MINIMUM"],
      ["CHINA PROBES SHANGHAI CHIEF", "4TH TOP LEADER SINCE 2025"],
      ["N. KOREA EXPELS SWISS ENVOY", "OFFICE TO CLOSE IN 48H"],
      ["HONG KONG: 1 YEAR ON", "168 NAMES READ (ANNIVERSARY)"],
      ["JAPAN: DATA-CENTRE REVOLT", "AI POWER BOOM SPARKS ROW"],
      ["TAIWAN VOTES SATURDAY", "AI FAKES FEARED"],
      ["INDIA-MALAYSIA DRILL OPENS", "HARIMAU SHAKTI IN IPOH"],
      ["INDIA CONDEMNS RIYADH HIT", "11 WOUNDED, 2 INDIANS"],
    ],
  },
  {
    name: "EUROPE", color: C.purple, items: [
      ["SPAIN VOTES SUNDAY", "FAR RIGHT MAY ENTER GOVT"],
      ["MI5 WARNS OF RUSSIAN SABOTAGE", "UK FIRMS ON ALERT"],
      ["POLAND NO-FLY ZONE", "NEAR UKRAINE BORDER"],
      ["UK AI WARNING", "WATCHDOG VS META MUSE AI"],
      ["SARKOZY TO STAND TRIAL 2027", "WITNESS-TAMPERING CASE"],
      ["LONDON MUSEUM REOPENS", "VICTORIAN HALL SATURDAY"],
      ["UKRAINE NEEDS EUR 115BN", "EUR 25BN GAP FOR 2027"],
      ["RUSSIAN WAR DEAD 490,334+", "LEAKED DATA, UP TO 700K"],
    ],
  },
  {
    name: "AMERICAS", color: C.green, items: [
      ["MISSISSIPPI PLANE CRASH", "6 DEAD, FAMILY OF 6"],
      ["IOWA BLAST: 4,400 KG", "20-MILE SHELTER, NO LEAD FOUND"],
      ["VENEZUELA DEBT: $237.5BN", "242% OF GDP (DISCLOSED TUE)"],
      ["CIA NETWORK HACKED", "OSINT HIT, CHINA SUSPECTED"],
      ["DOJ CHARGES 800+ IN SCAMS", "400 CASES WORLDWIDE"],
      ["NSA NETWORK DOWN FOR DAYS", "BAD UPDATE, NOT A HACK"],
      ["TRUMP: FUNDING IRAN WAR PREP", "THROUGH JANUARY"],
      ["MEASLES: 9 US DEATHS IN 2026", "CDC REPORT"],
      ["CANADA TIGHTENS STUDENT RULES", "FOREIGN-STUDENT CAPS"],
    ],
  },
  {
    name: "GLOBAL & SPORT", color: C.brown, items: [
      ["CHEMICAL WEAPONS", "30+ NATIONS: RUSSIA, STOP"],
      ["LANDMINE DEATHS 5-YEAR HIGH", "GLOBAL TOLL RISES"],
      ["WHO: END CUBA FUEL BLOCKADE", "CHIEF URGES US"],
      ["MALAYSIA RETURNS REFUGEES", "THOUSANDS TO MYANMAR"],
      ["AIRPORTS COURT PRIVATE CASH", "EXPANSION FUNDING"],
      ["NBA: NETS 104, BUCKS 97", "RANDLE 28 PTS, CUP WIN"],
      ["MLB SUES PLAYERS' UNION", "38-PAGE LOCKOUT COMPLAINT"],
    ],
  },
];

function briefs() {
  for (let c = 0; c < COLUMNS.length; c++) {
    const col = COLUMNS[c];
    const x = BRIEF_X[c];
    drawText(col.name, x, 586, 2, col.color, BRIEF_W);
    fillRect(x, 604, BRIEF_W, 3, col.color);
    let y = BRIEF_Y;
    for (const [h, s] of col.items) {
      drawText(h, x, y, 1, C.ink, BRIEF_W);
      drawText(s, x, y + 11, 1, C.gray, BRIEF_W);
      y += BRIEF_PITCH;
    }
    // date-check note under the shortest column (GLOBAL & SPORT, 7 items)
    if (c === 4) {
      drawText("EVERY STORY DATE-CHECKED", x, y + 18, 1, C.gray, BRIEF_W);
      drawText("FOR WED 25 NOV 2026", x, y + 30, 1, C.gray, BRIEF_W);
    }
  }
}

function footer() {
  fillRect(0, 920, W, H - 920, C.navy);
  drawText("CLAIMED VS CONFIRMED", 16, 930, 2, C.gold);
  // DATE CHECK box, right
  fillRect(636, 928, 372, 30, C.navy);
  for (let t = 0; t < 2; t++) {
    hline(636, 1007, 928 + t, C.gold);
    hline(636, 1007, 956 + t, C.gold);
    vline(636 + t, 928, 957, C.gold);
    vline(1006 + t, 928, 957, C.gold);
  }
  drawTextCentered("DATE CHECK: WED 25 NOV 2026", 822, 936, 2, C.gold);
  drawText("CAIRO 31/21 CONFIRMED NEXT MORNING · BOGOR 9/17 IS THE 25 NOV FIGURE", 16, 954, 1, C.white);
  drawText("HONG KONG FIRE = 2025 ANNIVERSARY, NOT A NEW FIRE · VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25", 16, 966, 1, C.white);
  drawText("DOW 50,182.95 +0.33% · S&P 7,182.78 -0.25% · NASDAQ 23,585.80 -0.62% · KOSPI -6.16% · BRENT $93.60 · GOLD $3,598.10 · BITCOIN $60,200.94 · 10-YR 4.85%", 16, 988, 1, C.gold);
  drawText("SOURCES: REUTERS · AP · BBC · NYT · ESPN · OFGEM · PIB · AL JAZEERA · MARKETS CLOSED THU 26 NOV (THANKSGIVING), FRI HALF-DAY", 16, 1004, 1, [180, 190, 200, 255]);
}

// ---------- main ----------
function main() {
  fillRect(0, 0, W, H, C.paper);
  header();
  hero(0, "LEAD · TARIFFS", C.red, heroTariffs,
    ["TRUMP PROPOSES NEW", "TARIFFS ON 14", "ECONOMIES"],
    ["US HOUSEHOLDS PAY ~$900 A YEAR", "UNDER THE NEW DUTIES"],
    ["CHINA 20% (40% IF TRUCE FAILS) ·", "VIETNAM 20%/35% · INDIA 17%/25% · EU 15%"]);
  hero(1, "CAIRO", C.orange, heroCairo,
    ["CAIRO TANKER FIRE", "KILLS 31"],
    ["27 VEHICLES BURNED, RING ROAD", "SHUT AFTER THE BLAST"],
    ["CAUSE: CAR HIT TANKER, IT OVERTURNED AND CAUGHT FIRE"]);
  hero(2, "SPACE", C.blue, heroSpace,
    ["CHINA SENDS FIRST", "PAKISTANI TO ORBIT"],
    ["FIRST FOREIGNER ABOARD", "TIANGONG STATION"],
    ["CREW: TANG HONGBO · WU YI · ZEESHAN ALI · 03:56 UTC"]);
  hline(8, 1016, 388, C.grayMd, 1);
  mid(0, midMacys, ["MACY'S 100TH PARADE", "POSTPONED - FIRST TIME"], "60 MPH", C.red, ["GUSTS · SAT 28 NOV"]);
  mid(1, midKospi, ["KOSPI CRASHES 6.2%", "AI FEARS RETURN"], "-6.2%", C.red, ["SAMSUNG -9.9%", "SK HYNIX -11.1%"]);
  mid(2, midDow, ["DOW ERASES 1,100-PT", "PLUNGE, RECORD CLOSE"], "50,183", C.green, ["-1,100 → +164 · +0.33%"]);
  mid(3, midUK, ["UK ENERGY CAP +26%", "TO £2,166 A YEAR"], "+26%", C.red, ["£1,723 → £2,166 · +£443"]);
  mid(4, midHouthis, ["HOUTHIS CLAIM REFINERY", "STRIKE - RAS TANURA"], "550K BPD", C.ink, ["BRENT $93.60 +2.41%"]);
  mid(5, midNetanyahu, ["JUDGES: DROP NETANYAHU", "BRIBERY CASE"], "CASE 4000", C.ink, ["RECOMMEND, NOT A RULING"]);
  hline(8, 1016, 580, C.grayMd, 1);
  briefs();
  footer();
  mkdirSync("/output", { recursive: true });
  const png = encodePNG();
  writeFileSync("/output/entry.png", png);
  console.log(`TRUNCATIONS: ${TRUNCATIONS}`);
  console.log(`WROTE ${png.length} bytes to /output/entry.png`);
}

main();
