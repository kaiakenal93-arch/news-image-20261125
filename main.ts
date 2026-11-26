// THE WEDNESDAY WIRE — v7
// news-image-20261125: "Sum up 25 November's world news in one image"
// 50 stories (3 heroes + 6 mids + 41 briefs), tariff lead, why-it-matters layer.
// Node stdlib only. Own 5x7 bitmap font + own PNG encoder (node:zlib).
// v7 fixes vs v6: briefs rebalanced (UKRAINE NEEDS EUR 115BN moved from GLOBAL
// to EUROPE — Ukraine is Europe, the EU funds it; columns now 10/9/7/7/8),
// bigger tariff % tags on the Hero 1 wall, UK meter redrawn as a dial meter,
// Macy's balloon bigger with a clearer face, Houthis drone enlarged.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const OUT = "/output/entry.png";
let truncations = 0;

// ---------- palette ----------
type RGB = readonly [number, number, number];
const NAVY: RGB = [13, 22, 43];
const NAVY2: RGB = [16, 28, 51];
const CREAM: RGB = [247, 243, 232];
const PAPER: RGB = [255, 253, 246];
const SKY: RGB = [207, 227, 245];
const SAND: RGB = [245, 233, 200];
const WHYBG: RGB = [255, 248, 208];
const RED: RGB = [217, 32, 39];
const YELLOW: RGB = [255, 210, 31];
const GOLD: RGB = [255, 196, 0];
const BLACK: RGB = [17, 17, 17];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [96, 96, 96];
const LGREY: RGB = [120, 120, 120];
const GREEN: RGB = [16, 130, 58];
const DGREEN: RGB = [8, 100, 44];
const BLUE: RGB = [28, 108, 196];
const DBLUE: RGB = [18, 70, 140];
const ORANGE: RGB = [238, 118, 18];
const BROWN: RGB = [146, 94, 52];
const BRICK: RGB = [178, 96, 66];
const MORTAR: RGB = [120, 60, 40];
const PURPLE: RGB = [110, 70, 160];
const ROAD: RGB = [60, 60, 60];
const STEEL: RGB = [120, 120, 125];
const DARK: RGB = [40, 40, 40];

// ---------- canvas ----------
const px = new Uint8Array(W * H * 4);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
  }
}
function setP(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setP(i, j, c);
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -dx; x <= dx; x++) setP(cx + x, cy + y, c);
  }
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      setP(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    setP(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy);
  const edges: [number, number, number, number][] = [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]];
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
    }
    if (xs.length >= 2) {
      const x0 = Math.ceil(Math.min(...xs)), x1 = Math.floor(Math.max(...xs));
      for (let x = x0; x <= x1; x++) setP(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font (own) ----------
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
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "£": ["00111", "01000", "01110", "01000", "11111", "01000", "01110"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "·": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "→": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"],
};
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, col: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let c2 = 0; c2 < 5; c2++) {
        if (g[r][c2] === "1") rect(cx + c2 * scale, y + r * scale, scale, scale, col);
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, col: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, col);
}
function wrap(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function textBlock(s: string, x: number, y: number, maxChars: number, scale: number, col: RGB, lineH: number, maxLines: number): void {
  const lines = wrap(s, maxChars);
  if (lines.length > maxLines) truncations += lines.length - maxLines;
  lines.slice(0, maxLines).forEach((ln, i) => drawText(ln, x, y + i * lineH, scale, col));
}

// ---------- PNG encoder (own) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- header ----------
fill(CREAM);
rect(0, 0, 1024, 70, NAVY);
drawText("THE WEDNESDAY WIRE", 16, 8, 6, WHITE);
rect(812, 12, 196, 44, RED);
drawTextCentered("50 STORIES", 910, 22, 3, WHITE);
drawText("WEDNESDAY 25 NOVEMBER 2026", 16, 50, 2, YELLOW);

// ---------- hero 1: tariffs (globe + wall) ----------
rect(0, 70, 341, 208, SKY);
// globe
circle(88, 172, 76, BLUE);
circle(60, 150, 18, GREEN);
circle(105, 185, 22, GREEN);
circle(120, 140, 12, GREEN);
circle(70, 200, 10, GREEN);
circle(95, 130, 8, GREEN);
// tariff wall (bricks)
rect(172, 96, 146, 156, BRICK);
for (let y = 118; y <= 228; y += 22) rect(172, y, 146, 2, MORTAR);
for (let r = 0; r < 6; r++) {
  const y0 = 96 + r * 22;
  const off = r % 2 === 0 ? 0 : 14;
  for (let x = 172 + 26 + off; x < 318; x += 28) rect(x, y0, 2, 22, MORTAR);
}
// % tags — bigger than v6 so the numbers read at 300px
function tag(txt: string, y: number): void {
  const w = textWidth(txt, 2) + 10;
  rect(176, y, w, 26, BLACK);
  drawText(txt, 181, y + 6, 2, WHITE);
}
tag("CHINA 20%", 100);
tag("VIETNAM 20%", 130);
tag("INDIA 17%", 160);
tag("EU 15%", 190);
// containers at the foot of the wall
const CONT: RGB[] = [RED, YELLOW, GREEN, BLUE, ORANGE, PURPLE];
for (let i = 0; i < 6; i++) rect(172 + i * 25, 234, 23, 18, CONT[i]);
rect(172, 252, 146, 6, NAVY);
// red down arrow
rect(328, 100, 8, 28, RED);
tri(322, 128, 340, 128, 331, 146, RED);

// ---------- hero 2: Cairo tanker fire ----------
rect(341, 70, 341, 208, SAND);
// smoke plume
circle(470, 92, 16, LGREY);
circle(495, 86, 20, LGREY);
circle(520, 94, 14, LGREY);
circle(445, 100, 12, LGREY);
// death toll banner
rect(355, 128, 313, 30, RED);
drawTextCentered("31 DEAD · 21 HURT", 511, 134, 2, WHITE);
// burnt-out cars with flames
for (let i = 0; i < 3; i++) {
  const x = 360 + i * 70;
  rect(x, 205, 50, 23, BLACK);
  tri(x + 14, 205, x + 25, 182, x + 36, 205, ORANGE);
  tri(x + 19, 205, x + 25, 190, x + 31, 205, YELLOW);
}
// overturned tanker — wheels UP, hazard diamond
rect(575, 195, 90, 30, STEEL);
circle(590, 190, 7, DARK);
circle(615, 190, 7, DARK);
circle(640, 190, 7, DARK);
tri(620, 194, 636, 210, 620, 226, RED);
tri(620, 194, 604, 210, 620, 226, RED);
tri(620, 199, 631, 210, 620, 221, WHITE);
tri(620, 199, 609, 210, 620, 221, WHITE);
drawText("!", 617, 203, 1, RED);
// ring road
rect(341, 238, 341, 40, ROAD);
for (let x = 355; x < 660; x += 40) rect(x, 256, 24, 4, WHITE);

// ---------- hero 3: Shenzhou-24 ----------
rect(682, 70, 342, 208, NAVY2);
// stars
const STARS: [number, number][] = [[700, 90], [720, 120], [760, 80], [800, 140], [850, 90], [880, 120], [900, 80], [950, 220], [700, 200], [1000, 90], [1010, 180], [730, 240], [860, 240], [990, 220]];
for (const [sx, sy] of STARS) rect(sx, sy, 2, 2, WHITE);
// China flag
rect(700, 84, 84, 54, RED);
circle(712, 96, 5, YELLOW);
circle(730, 90, 3, YELLOW);
circle(740, 100, 3, YELLOW);
circle(730, 110, 3, YELLOW);
circle(716, 110, 3, YELLOW);
// Pakistan flag
rect(800, 84, 84, 54, [0, 100, 60]);
rect(800, 84, 20, 54, WHITE);
circle(845, 111, 12, WHITE);
circle(850, 111, 10, [0, 100, 60]);
circle(862, 100, 3, WHITE);
// rocket (flame kept inside the scene)
tri(928, 92, 954, 92, 941, 66, RED);
rect(928, 92, 26, 92, WHITE);
circle(941, 120, 6, BLUE);
tri(928, 170, 918, 190, 928, 184, RED);
tri(954, 170, 964, 190, 954, 184, RED);
tri(928, 184, 954, 184, 941, 208, ORANGE);
tri(934, 184, 948, 184, 941, 200, YELLOW);
// Tiangong station ring
ring(995, 140, 26, 5, GOLD);
rect(969, 137, 52, 6, GOLD);
rect(992, 114, 6, 52, GOLD);
// three astronaut silhouettes
for (const ax of [720, 770, 820]) {
  circle(ax, 232, 8, WHITE);
  rect(ax - 10, 242, 20, 20, WHITE);
}
drawText("TIANGONG", 950, 262, 1, YELLOW);

// ---------- hero headlines ----------
textBlock("TRUMP PROPOSES NEW TARIFFS ON 14 ECONOMIES", 8, 282, 18, 3, BLACK, 23, 3);
drawText("CHINA 20% (40% IF TRUCE FAILS)", 8, 354, 1, GREY);
drawText("VIETNAM 20%/35% · INDIA 17%/25% · EU 15%", 8, 364, 1, GREY);
textBlock("CAIRO TANKER FIRE KILLS 31", 349, 282, 18, 3, BLACK, 23, 3);
textBlock("CHINA SENDS FIRST PAKISTANI INTO ORBIT", 690, 282, 18, 3, BLACK, 23, 3);

// ---------- why it matters strips ----------
rect(0, 372, 341, 58, WHYBG);
rect(341, 372, 341, 58, WHYBG);
rect(682, 372, 342, 58, WHYBG);
rect(0, 372, 1024, 2, GOLD);
drawText("WHY IT MATTERS", 8, 377, 1, RED);
drawText("US HOUSEHOLDS PAY $900 A YEAR UNDER NEW DUTIES", 8, 389, 1, BLACK);
drawText("HEARING 25 JAN · TRUCE EXPIRES 10 JAN", 8, 399, 1, BLACK);
drawText("16 PARTNERS PROBED · MEXICO, NORWAY EXCLUDED", 8, 409, 1, BLACK);
drawText("WHY IT MATTERS", 349, 377, 1, RED);
drawText("27 VEHICLES BURNED, RING ROAD SHUT AFTER BLAST", 349, 389, 1, BLACK);
drawText("CAUSE: CAR HIT TANKER, IT OVERTURNED", 349, 399, 1, BLACK);
drawText("AND CAUGHT FIRE · RING ROAD, GIZA · WED NIGHT", 349, 409, 1, BLACK);
drawText("WHY IT MATTERS", 690, 377, 1, RED);
drawText("FIRST FOREIGNER ABOARD TIANGONG STATION", 690, 389, 1, BLACK);
drawText("CREW: TANG HONGBO · WU YI · ZEESHAN ALI", 690, 399, 1, BLACK);
drawText("LAUNCH 00:18 UTC · DOCKED 03:56 UTC", 690, 409, 1, BLACK);

// ---------- mid scenes (y 432-508) ----------
const MIDBG: RGB[] = [[232, 240, 248], [255, 248, 220], [230, 245, 230], [245, 235, 225], [240, 232, 240], [228, 238, 245]];
const MIDX = [0, 171, 342, 513, 684, 855];
for (let i = 0; i < 6; i++) rect(MIDX[i], 432, i === 5 ? 169 : 171, 76, MIDBG[i]);
// M1 — Macy's balloon, bigger, friendlier face
circle(85, 468, 28, RED);
circle(76, 456, 6, WHITE);
circle(76, 462, 3, BLACK);
circle(94, 462, 3, BLACK);
line(78, 474, 85, 479, BLACK);
line(85, 479, 92, 474, BLACK);
circle(70, 472, 4, [255, 150, 150]);
circle(100, 472, 4, [255, 150, 150]);
line(75, 494, 70, 506, BLACK);
line(95, 494, 100, 506, BLACK);
line(20, 448, 40, 448, LGREY);
line(130, 440, 150, 440, LGREY);
line(25, 480, 45, 480, LGREY);
// M2 — Kospi chip + red down arrow
rect(226, 448, 60, 36, DBLUE);
rect(220, 454, 6, 4, DBLUE);
rect(220, 466, 6, 4, DBLUE);
rect(220, 478, 6, 4, DBLUE);
rect(286, 454, 6, 4, DBLUE);
rect(286, 466, 6, 4, DBLUE);
rect(286, 478, 6, 4, DBLUE);
rect(246, 458, 20, 16, [120, 180, 255]);
rect(300, 438, 8, 26, RED);
tri(294, 464, 312, 464, 304, 482, RED);
// M3 — Dow V-chart, plunge then record
line(362, 494, 362, 448, BLACK);
line(362, 494, 498, 494, BLACK);
line(362, 462, 420, 494, RED);
line(420, 494, 494, 450, GREEN);
drawText("RECORD", 446, 436, 1, GREEN);
// M4 — UK house + dial meter
tri(540, 466, 600, 466, 570, 442, BROWN);
rect(545, 466, 50, 34, [250, 240, 210]);
rect(565, 482, 12, 18, BROWN);
rect(551, 473, 10, 10, BLUE);
rect(608, 452, 44, 34, BLACK);
rect(610, 454, 40, 30, WHITE);
circle(630, 466, 8, DARK);
line(630, 466, 637, 459, RED);
rect(614, 478, 32, 3, GREEN);
// M5 — Houthis refinery + intercepted drone (bigger)
rect(700, 472, 18, 36, STEEL);
rect(722, 460, 18, 48, STEEL);
rect(744, 478, 18, 30, STEEL);
circle(760, 450, 10, BLACK);
circle(772, 440, 12, BLACK);
circle(784, 450, 9, BLACK);
tri(726, 460, 731, 448, 736, 460, ORANGE);
rect(790, 452, 22, 8, BLACK);
line(788, 448, 814, 448, BLACK);
circle(788, 448, 2, BLACK);
circle(814, 448, 2, BLACK);
line(786, 442, 818, 466, RED);
line(818, 442, 786, 466, RED);
// M6 — Netanyahu courthouse + gavel
tri(880, 464, 1000, 464, 940, 440, DBLUE);
rect(890, 464, 10, 36, WHITE);
rect(930, 464, 10, 36, WHITE);
rect(970, 464, 10, 36, WHITE);
rect(880, 500, 120, 6, DBLUE);
rect(986, 458, 16, 10, BROWN);
line(992, 468, 1006, 486, BROWN);

// ---------- mid headlines (y 508-598) ----------
textBlock("MACY'S 100TH PARADE POSTPONED", 8, 512, 13, 2, BLACK, 15, 3);
drawText("60 MPH", 8, 560, 3, RED);
drawText("GUSTS · SAT 28 NOV", 8, 586, 1, GREY);
textBlock("KOSPI CRASHES 6.2% AI FEARS RETURN", 179, 512, 13, 2, BLACK, 15, 3);
drawText("-6.2%", 179, 560, 3, RED);
drawText("SAMSUNG -9.9% HYNIX -11.1%", 179, 586, 1, GREY);
textBlock("DOW ERASES 1,100-PT DROP RECORD CLOSE", 350, 512, 13, 2, BLACK, 15, 3);
drawText("50,183", 350, 560, 3, GREEN);
drawText("-1,100 → +164 · +0.33%", 350, 586, 1, GREY);
textBlock("UK ENERGY CAP JUMPS 26% TO £2,166 A YEAR", 521, 512, 13, 2, BLACK, 15, 3);
drawText("+26%", 521, 560, 3, RED);
drawText("£1,723 → £2,166 · +£443", 521, 586, 1, GREY);
textBlock("HOUTHIS CLAIM REFINERY HIT - RAS TANURA", 692, 512, 13, 2, BLACK, 15, 3);
drawText("550K BPD", 692, 560, 3, BLACK);
drawText("BRENT $93.60 +2.41%", 692, 586, 1, GREY);
textBlock("JUDGES: DROP NETANYAHU BRIBERY CASE", 863, 512, 13, 2, BLACK, 15, 3);
drawText("CASE 4000", 863, 560, 3, BLACK);
drawText("RECOMMEND: NOT A RULING", 863, 586, 1, GREY);

// ---------- briefs (41) ----------
// Columns rebalanced vs v6: UKRAINE NEEDS EUR 115BN moved from GLOBAL to
// EUROPE (Ukraine is Europe, the EU funds it) — columns now 10/9/7/7/8.
const BRIEF_COLS: { head: string; color: RGB; items: [string, string][] }[] = [
  {
    head: "MIDDLE EAST", color: RED,
    items: [
      ["BOGOR GOLD MINE FLOODS", "9 DEAD, 17 TRAPPED, 100M SHAFT"],
      ["SUDAN DRONE STRIKES", "19 KILLED IN BLUE NILE"],
      ["GAZA STRIKE KILLS HAMAS", "SECURITY CHIEF + FAMILY"],
      ["US: CITIZENS LEAVE IRAN", "TENSIONS RISE"],
      ["UKRAINE HITS RUSSIAN SHIP", "CORVETTE OFF BENGHAZI"],
      ["IRAQ ORDERS TROOPS TO BORDERS", "OIL OVERSIGHT"],
      ["COALITION HITS HODEIDAH", "MISSILE PLATFORM DESTROYED"],
      ["IRAN WEAPONS CLAIM", "CHEMICAL ARMS ALLEGED"],
      ["CHEMICAL WEAPONS", "30+ NATIONS: RUSSIA, STOP"],
      ["INDIA CONDEMNS RIYADH HIT", "11 WOUNDED, 2 INDIANS"],
    ],
  },
  {
    head: "ASIA-PACIFIC", color: BLUE,
    items: [
      ["SOLOMON ISLANDS TREATY", "AUSTRALIA TOP SECURITY PARTNER"],
      ["BANGLADESH WAGE +36%", "17,000 TAKAS MINIMUM"],
      ["CHINA PROBES SHANGHAI CHIEF", "4TH TOP LEADER SINCE 2025"],
      ["N. KOREA EXPELS SWISS ENVOY", "OFFICE TO CLOSE IN 48H"],
      ["HONG KONG: 1 YEAR ON", "168 NAMES READ (ANNIVERSARY)"],
      ["JAPAN: DATA-CENTRE REVOLT", "AI POWER BOOM SPARKS ROW"],
      ["TAIWAN VOTES SATURDAY", "AI FAKES FEARED"],
      ["INDIA-MALAYSIA DRILL OPENS", "HARIMAU SHAKTI IN IPOH"],
      ["CANADA TIGHTENS STUDENT RULES", "FOREIGN-STUDENT CAPS"],
    ],
  },
  {
    head: "EUROPE", color: PURPLE,
    items: [
      ["SPAIN VOTES SUNDAY", "FAR RIGHT MAY ENTER GOVT"],
      ["MI5 WARNS RUSSIAN SABOTAGE", "UK FIRMS ON ALERT"],
      ["POLAND NO-FLY ZONE", "NEAR UKRAINE BORDER"],
      ["UK AI WARNING", "WATCHES VS META MUSE AI"],
      ["SARKOZY TO STAND TRIAL 2027", "WITNESS-TAMPERING CASE"],
      ["LONDON MUSEUM REOPENS", "VICTORIAN HALL SATURDAY"],
      ["UKRAINE NEEDS EUR 115BN", "EUR 25BN GAP FOR 2027"],
    ],
  },
  {
    head: "AMERICAS", color: GREEN,
    items: [
      ["MISSISSIPPI PLANE CRASH", "6 DEAD: FAMILY OF 6"],
      ["IOWA BLAST: 4,400 KG", "NO LEAD FOUND"],
      ["VENEZUELA DEBT: $237.5BN", "242% OF GDP (DISCLOSED TUE)"],
      ["CIA NETWORK HACKED", "OSINT HIT, CHINA SUSPECTED"],
      ["DOJ CHARGES 800+ IN SCAMS", "400 CASES WORLDWIDE"],
      ["NSA NETWORK DOWN FOR DAYS", "BAD UPDATE, NOT A HACK"],
      ["TRUMP: FUNDING IRAN WAR PREP", "THROUGH JANUARY"],
      ["MEASLES", "CDC: 9 US DEATHS IN 2026"],
    ],
  },
  {
    head: "GLOBAL & SPORT", color: ORANGE,
    items: [
      ["RUSSIAN WAR DEAD 490,334+", "LEAKED DATA, UP TO 700K"],
      ["LANDMINE DEATHS 5-YEAR HIGH", "GLOBAL TOLL RISES"],
      ["WHO: END CUBA FUEL BLOCKADE", "CHIEF URGES US"],
      ["MALAYSIA RETURNS REFUGEES", "THOUSANDS TO MYANMAR"],
      ["AIRPORTS COURT PRIVATE CASH", "EXPANSION FUNDING"],
      ["NBA: NETS 104, BUCKS 97", "RANDLE 28 PTS, CUP WIN"],
      ["MLB SUES PLAYERS' UNION", "38-PAGE LOCKOUT COMPLAINT"],
    ],
  },
];
const BRIEFX = [0, 205, 410, 615, 820];
for (let c = 0; c < 5; c++) {
  const col = BRIEF_COLS[c];
  const x = BRIEFX[c];
  drawText(col.head, x + 4, 602, 2, col.color);
  rect(x + 4, 618, 197, 3, col.color);
  col.items.forEach(([t, s], i) => {
    const y = 626 + i * 27;
    if (textWidth(t, 1) > 197 || textWidth(s, 1) > 197) truncations++;
    drawText(t, x + 4, y, 1, BLACK);
    drawText(s, x + 4, y + 10, 1, GREY);
  });
}

// ---------- footer ----------
rect(0, 900, 1024, 124, NAVY);
drawText("CLAIMED VS CONFIRMED", 16, 910, 3, YELLOW);
drawText("CAIRO 31/21 CONFIRMED NEXT MORNING · BOGOR 9/17 IS THE 25 NOV FIGURE", 16, 940, 1, WHITE);
drawText("HONG KONG FIRE IS 2025 ANNIVERSARY, NOT A NEW FIRE · VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25", 16, 954, 1, WHITE);
// date check box
rect(720, 906, 288, 3, YELLOW);
rect(720, 967, 288, 3, YELLOW);
rect(720, 906, 3, 64, YELLOW);
rect(1005, 906, 3, 64, YELLOW);
drawTextCentered("DATE CHECK:", 864, 914, 3, YELLOW);
drawTextCentered("WED 25 NOV 2026", 864, 940, 3, YELLOW);
drawText("DOW 50,182.95 +0.33% · S&P 7,182.78 -0.25% · NASDAQ 23,585.80 -0.62% · KOSPI -6.16% · BRENT $93.60 · GOLD $3,598.10 · BITCOIN $60,200.94 · 10-YR 4.85%", 16, 980, 1, WHITE);
drawText("SOURCES: REUTERS · AP · BBC · NYT · ESPN · OFGEM · PIB · AL JAZEERA · MARKETS CLOSED THU 26 NOV (THANKSGIVING) · FRI HALF-DAY", 16, 996, 1, [200, 200, 200]);
drawTextCentered("50 STORIES · TARIFF LEAD · WHY IT MATTERS · EVERY STORY DATE-CHECKED FOR WED 25 NOV 2026", 512, 1012, 1, [180, 180, 160]);

// ---------- main ----------
mkdirSync("/output", { recursive: true });
const buf = encodePNG();
writeFileSync(OUT, buf);
console.log("TRUNCATIONS: " + truncations);
console.log("WROTE " + buf.length + " bytes to " + OUT);
