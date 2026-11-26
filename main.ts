// THE WEDNESDAY WIRE — v4
// Sum up Wednesday 25 November 2026 in one image. 50 stories: 3 heroes + 6 mids + 41 briefs.
// Fresh build. Node stdlib only (own 5x7 bitmap font + own PNG encoder via node:zlib).
// v4 fixes vs v3: Cairo grey pillar removed (it read like a building); dashed Ring Road line
// added under the tanker; date-check note moved directly under the last GLOBAL brief and the
// dead band between briefs and footer closed; Macy's balloon face cleaned up with ropes to
// hands; Houthis refinery redrawn as tanks + flare stack + smoke + drone with red X (no longer
// a bar chart); UK meter flame redrawn as a proper teardrop; tariff ship given a hull + bridge.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- CRC32 + PNG
const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w: number, h: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas
const W = 1024, H = 1024;
type C = [number, number, number];
const PAPER: C = [247, 243, 232];
const INK: C = [17, 17, 17];
const NAVY: C = [20, 38, 63];
const NAVY2: C = [14, 42, 71];
const RED: C = [216, 35, 42];
const YELLOW: C = [245, 197, 24];
const PALEY: C = [255, 243, 176];
const SLATE: C = [90, 107, 124];
const SKY: C = [214, 234, 248];
const SAND: C = [245, 230, 200];
const BRICK: C = [181, 103, 63];
const MORTAR: C = [138, 74, 46];
const GREY: C = [154, 160, 166];
const DGREY: C = [60, 60, 60];
const GREEN: C = [46, 158, 91];
const LGREEN: C = [223, 242, 227];
const LGREY: C = [232, 232, 232];
const WHITE: C = [255, 255, 255];
const BLACK: C = [0, 0, 0];
const ORANGE: C = [232, 106, 24];
const GOLD: C = [212, 160, 23];
const BLUE: C = [46, 111, 183];
const TEAL: C = [0, 120, 120];
const PURPLE: C = [100, 60, 140];
const AGREEN: C = [0, 110, 60];
const BROWN: C = [140, 90, 30];
const RULE: C = [200, 190, 170];
const LTEXT: C = [170, 180, 195];

const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = PAPER[0]; img[i * 4 + 1] = PAPER[1]; img[i * 4 + 2] = PAPER[2]; img[i * 4 + 3] = 255; }

function px(x: number, y: number, c: C): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
}
function rect(x: number, y: number, w: number, h: number, c: C): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: C, th = 1): void {
  const dx = x1 - x0, dy = y1 - y0, steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + dx * s / steps), y = Math.round(y0 + dy * s / steps);
    rect(x - Math.floor(th / 2), y - Math.floor(th / 2), th, th, c);
  }
}
function circle(cx: number, cy: number, r: number, c: C): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - dx; x <= cx + dx; x++) px(x, cy + dy, c);
  }
}
function ring(cx: number, cy: number, r: number, th: number, c: C, bg: C): void {
  circle(cx, cy, r, c);
  circle(cx, cy, r - th, bg);
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: C): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
    for (let x = cx - dx; x <= cx + dx; x++) px(x, cy + dy, c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: C): void {
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const edges = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(Math.round(ax + (y - ay) * (bx - ax) / (by - ay)));
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs), b = Math.max(...xs);
      for (let x = a; x <= b; x++) px(x, y, c);
    }
  }
}
function star(cx: number, cy: number, r: number, c: C): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + Math.round(rr * Math.cos(ang)), cy + Math.round(rr * Math.sin(ang))]);
  }
  for (let i = 1; i < 9; i++) tri(cx, cy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c);
  tri(cx, cy, pts[9][0], pts[9][1], pts[0][0], pts[0][1], c);
}
function flame(x: number, yBase: number, s: number, c1: C, c2: C): void {
  tri(x - s, yBase, x + s, yBase, x, yBase - Math.round(s * 2.2), c1);
  tri(x - Math.round(s * 0.5), yBase, x + Math.round(s * 0.5), yBase, x, yBase - Math.round(s * 1.2), c2);
}

// ---------------------------------------------------------------- 5x7 bitmap font
const GLYPHS: Record<string, string[]> = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '..#..', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '£': ['.###.', '#...#', '#....', '.###.', '#....', '#....', '#####'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '•': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '~': ['.....', '.....', '.##.#', '#.#..', '.....', '.....', '.....'],
};
let truncations = 0;
function norm(s: string): string {
  return s.replace(/’/g, "'").replace(/[–—]/g, '-').replace(/−/g, '-');
}
function text(s: string, x: number, y: number, scale: number, c: C, gap: number = scale): void {
  let cx = x;
  for (const ch of norm(s)) {
    const g = GLYPHS[ch] || GLYPHS[' '];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === '#') rect(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 5 * scale + gap;
  }
}
function textW(s: string, scale: number, gap: number = scale): number {
  return norm(s).length * (5 * scale + gap) - gap;
}
function put(s: string, x: number, y: number, scale: number, c: C, maxW: number, gap: number = scale): void {
  if (textW(s, scale, gap) > maxW) { truncations++; console.error('TRUNCATED: ' + s); }
  text(s, x, y, scale, c, gap);
}

// ---------------------------------------------------------------- header
rect(0, 0, 1024, 58, NAVY);
text('THE WEDNESDAY WIRE', 12, 10, 4, WHITE);
text('WEDNESDAY 25 NOVEMBER 2026', 12, 40, 2, YELLOW);
rect(820, 10, 192, 38, RED);
text('50 STORIES', 826, 16, 3, WHITE);

// ---------------------------------------------------------------- heroes
const HX = [0, 341, 682]; // hero column x
const HW = 339;           // hero column width

// --- HERO 1: tariffs (globe + brick wall + container ship)
rect(HX[0], 60, HW, 152, SKY);
rect(HX[0], 60, 96, 18, RED);
text('LEAD • TARIFFS', HX[0] + 6, 64, 1, WHITE);
// globe
circle(70, 140, 52, BLUE);
circle(50, 125, 14, GREEN);
circle(88, 128, 10, GREEN);
circle(82, 160, 16, GREEN);
rect(68, 88, 3, 104, WHITE);
rect(18, 138, 104, 3, WHITE);
// brick wall with mortar
rect(150, 76, 180, 104, BRICK);
for (let r = 0; r < 8; r++) {
  const y = 76 + r * 13;
  rect(150, y + 12, 180, 2, MORTAR);
  const off = (r % 2 === 0) ? 0 : 15;
  for (let k = 0; k < 7; k++) rect(150 + off + k * 30, y, 2, 12, MORTAR);
}
rect(150, 76, 180, 3, RED);
// % tags on the wall
rect(158, 84, 96, 16, RED); text('CHINA 20%', 162, 87, 1, WHITE);
rect(158, 104, 108, 16, NAVY); text('VIETNAM 20%', 162, 107, 1, WHITE);
rect(158, 124, 96, 16, NAVY); text('INDIA 17%', 162, 127, 1, WHITE);
rect(158, 144, 84, 16, NAVY); text('EU 15%', 162, 147, 1, WHITE);
// red down arrow
rect(308, 92, 6, 62, RED);
tri(300, 154, 322, 154, 311, 172, RED);
// container ship at the foot of the wall: hull + containers + bridge, on water
rect(0, 196, HW, 16, [140, 190, 220]);
rect(152, 164, 40, 16, RED);
rect(194, 164, 40, 16, YELLOW);
rect(236, 164, 40, 16, GREEN);
rect(278, 164, 40, 16, BLUE);
rect(318, 158, 12, 22, WHITE);
rect(320, 162, 8, 5, NAVY);
rect(148, 180, 184, 16, NAVY);
tri(332, 180, 332, 196, 318, 196, NAVY);

// --- HERO 2: Cairo tanker fire (overturned tanker, NO grey pillar — v3 defect removed)
rect(HX[1], 60, HW, 152, SAND);
rect(HX[1], 60, 62, 18, ORANGE);
text('CAIRO', HX[1] + 6, 64, 1, WHITE);
// smoke plume
circle(390, 92, 16, GREY);
circle(412, 86, 20, GREY);
circle(436, 94, 14, GREY);
// casualty tag
rect(349, 118, 132, 18, RED);
text('31 DEAD • 21 HURT', 355, 122, 1, WHITE);
// dark road band with dashed white centre line (new in v4)
rect(HX[1], 186, HW, 26, DGREY);
for (let x = 350; x < 672; x += 30) rect(x, 198, 14, 3, WHITE);
// burnt-out cars in a row, flames on top
for (const cx of [360, 430, 500]) {
  rect(cx, 170, 56, 16, BLACK);
  flame(cx + 12, 170, 7, ORANGE, YELLOW);
  flame(cx + 38, 170, 6, ORANGE, YELLOW);
}
// overturned tanker: grey body, 4 wheels UP, hazard diamond, red stripe, flames
rect(566, 148, 104, 34, [160, 164, 168]);
rect(566, 174, 104, 4, RED);
for (const wx of [580, 606, 632, 658]) {
  circle(wx, 140, 9, BLACK);
  circle(wx, 140, 4, GREY);
}
flame(606, 132, 6, ORANGE, YELLOW);
flame(632, 132, 6, ORANGE, YELLOW);
// hazard diamond, half white / half red
tri(640, 153, 628, 165, 640, 177, WHITE);
tri(640, 153, 652, 165, 640, 177, RED);

// --- HERO 3: Shenzhou-24, first Pakistani in orbit
rect(HX[2], 60, HW, 152, NAVY2);
rect(HX[2], 60, 56, 18, BLUE);
text('SPACE', HX[2] + 6, 64, 1, WHITE);
// stars
for (const [sx, sy] of [[700, 90], [760, 80], [830, 100], [960, 85], [1000, 120], [720, 180], [990, 190], [860, 70]]) rect(sx, sy, 2, 2, WHITE);
// China flag: red, big yellow star + 4 small
rect(696, 76, 72, 44, RED);
star(716, 92, 10, YELLOW);
star(742, 84, 3, YELLOW); star(750, 92, 3, YELLOW); star(742, 100, 3, YELLOW); star(734, 104, 3, YELLOW);
// Pakistan flag: green, white stripe, white crescent + star
rect(776, 76, 72, 44, [20, 90, 50]);
rect(776, 76, 16, 44, WHITE);
circle(818, 98, 14, WHITE);
circle(824, 96, 12, [20, 90, 50]);
star(838, 88, 4, WHITE);
// rocket: white body, red nose + fins, blue window, flame contained in scene
rect(880, 96, 34, 64, WHITE);
tri(880, 96, 914, 96, 897, 72, RED);
circle(897, 120, 7, BLUE);
tri(880, 140, 880, 160, 864, 160, RED);
tri(914, 140, 914, 160, 930, 160, RED);
rect(880, 152, 34, 8, RED);
tri(888, 160, 906, 160, 897, 184, ORANGE);
tri(891, 160, 903, 160, 897, 176, YELLOW);
// Tiangong ring station
ring(968, 128, 26, 5, GOLD, NAVY2);
rect(952, 120, 32, 16, WHITE);
rect(928, 124, 24, 8, GOLD);
rect(984, 124, 24, 8, GOLD);
// three astronaut silhouettes
for (const ax of [712, 748, 784]) {
  circle(ax, 178, 8, WHITE);
  rect(ax - 8, 186, 16, 20, WHITE);
}
text('TIANGONG', 936, 196, 1, YELLOW);

// --- hero headlines (scale 3, max 17 chars/line)
put('TRUMP PROPOSES', 12, 216, 3, INK, 317);
put('NEW TARIFFS ON', 12, 242, 3, INK, 317);
put('14 ECONOMIES', 12, 268, 3, INK, 317);
put('CAIRO TANKER FIRE', 353, 216, 3, INK, 317);
put('KILLS 31', 353, 242, 3, INK, 317);
put('CHINA SENDS FIRST', 694, 216, 3, INK, 317);
put('PAKISTANI TO', 694, 242, 3, INK, 317);
put('ORBIT', 694, 268, 3, INK, 317);

// --- why-it-matters boxes
for (let i = 0; i < 3; i++) rect(HX[i], 298, HW, 48, PALEY);
text('WHY IT MATTERS', HX[0] + 8, 302, 1, RED);
text('US HOUSEHOLDS PAY $900', HX[0] + 8, 314, 2, INK, 1);
text('A YEAR UNDER NEW DUTIES', HX[0] + 8, 328, 2, INK, 1);
text('WHY IT MATTERS', HX[1] + 8, 302, 1, RED);
text('27 VEHICLES BURNED', HX[1] + 8, 314, 2, INK, 1);
text('RING ROAD SHUT AFTER BLAST', HX[1] + 8, 328, 2, INK, 1);
text('WHY IT MATTERS', HX[2] + 8, 302, 1, RED);
text('FIRST FOREIGNER ABOARD', HX[2] + 8, 314, 2, INK, 1);
text('TIANGONG STATION', HX[2] + 8, 328, 2, INK, 1);

// --- hero detail lines (scale 1, slate)
put('CHINA 20% (40% IF TRUCE FAILS) • VIETNAM 20%/35%', 12, 350, 1, SLATE, 317);
put('INDIA 17%/25% • EU 15%', 12, 359, 1, SLATE, 317);
put('CAUSE: CAR HIT TANKER, IT OVERTURNED', 353, 350, 1, SLATE, 317);
put('AND CAUGHT FIRE', 353, 359, 1, SLATE, 317);
put('CREW: TANG HONGBO • WU YI • ZEESHAN ALI', 694, 350, 1, SLATE, 317);
put('DOCKED 03:56 UTC', 694, 359, 1, SLATE, 317);
rect(0, 368, 1024, 2, RULE);

// ---------------------------------------------------------------- mids (6 columns x 0,170,341,512,683,854)
const MX = [0, 170, 341, 512, 683, 854];

// --- M1: Macy's balloon — cleaner face, ropes to hands, wind lines
rect(MX[0], 372, 170, 76, SKY);
rect(8, 392, 18, 2, SLATE);
rect(12, 404, 14, 2, SLATE);
ellipse(85, 408, 26, 30, RED);
circle(76, 402, 3, INK);
circle(94, 402, 3, INK);
line(78, 412, 82, 418, INK, 2);
line(82, 418, 88, 418, INK, 2);
line(88, 418, 92, 412, INK, 2);
line(72, 436, 66, 448, INK, 1);
line(98, 436, 104, 448, INK, 1);
rect(58, 444, 14, 4, [222, 170, 120]);
rect(98, 444, 14, 4, [222, 170, 120]);

// --- M2: Kospi — chip + steep red fall
rect(196, 398, 34, 26, NAVY);
rect(206, 406, 14, 10, [120, 170, 210]);
for (const py of [402, 408, 414]) { rect(192, py, 4, 3, NAVY); rect(230, py, 4, 3, NAVY); }
line(238, 380, 322, 438, RED, 4);
tri(322, 438, 308, 432, 318, 424, RED);

// --- M3: Dow — V-shaped recovery
rect(MX[2], 372, 170, 76, LGREEN);
line(352, 386, 400, 430, RED, 3);
line(400, 430, 470, 392, GREEN, 3);
line(470, 392, 500, 388, GREEN, 3);

// --- M4: UK energy — house + bill/meter with red ! + teardrop flame
rect(540, 404, 44, 34, [181, 140, 90]);
tri(536, 404, 588, 404, 562, 384, [120, 70, 40]);
rect(558, 420, 10, 18, [80, 50, 30]);
rect(572, 412, 10, 10, [180, 220, 240]);
rect(604, 386, 48, 52, NAVY);
rect(606, 388, 44, 48, WHITE);
rect(606, 388, 44, 10, RED);
circle(628, 418, 9, RED);
rect(627, 411, 2, 9, WHITE);
rect(627, 422, 2, 2, WHITE);
flame(658, 436, 5, ORANGE, YELLOW);

// --- M5: Houthis refinery — flat-top storage tanks + thick flare stack + smoke + big drone with thin red X
rect(MX[4], 372, 170, 76, LGREY);
// flat-top tanks (rounded tops read as tombstones at this size)
rect(694, 406, 34, 32, [140, 145, 150]);
rect(694, 406, 34, 4, [110, 115, 120]);
rect(698, 414, 4, 20, [175, 180, 185]);
rect(732, 418, 28, 20, [160, 165, 170]);
rect(732, 418, 28, 4, [130, 135, 140]);
// black smoke column rising from the tall tank
circle(706, 392, 9, [40, 40, 40]);
circle(714, 382, 11, [40, 40, 40]);
circle(722, 392, 8, [40, 40, 40]);
// thick flare stack with a bigger flame
rect(766, 394, 8, 44, [90, 90, 90]);
flame(770, 394, 6, ORANGE, YELLOW);
// drone, big enough to read through the thin red X
rect(806, 384, 20, 8, [30, 30, 30]);
circle(808, 380, 3, [30, 30, 30]);
circle(824, 380, 3, [30, 30, 30]);
line(806, 382, 826, 382, [30, 30, 30], 1);
line(802, 380, 830, 400, RED, 2);
line(830, 380, 802, 400, RED, 2);
// oil barrel with bands
rect(828, 420, 18, 18, [30, 60, 110]);
rect(828, 425, 18, 3, [60, 100, 160]);
rect(828, 432, 18, 3, [60, 100, 160]);

// --- M6: Netanyahu — courthouse + gavel
rect(MX[5], 372, 170, 76, SKY);
rect(880, 392, 84, 28, NAVY);
rect(886, 396, 8, 24, WHITE);
rect(912, 396, 8, 24, WHITE);
rect(938, 396, 8, 24, WHITE);
tri(876, 392, 968, 392, 922, 376, NAVY);
rect(880, 420, 84, 18, WHITE);
rect(880, 438, 84, 4, GREY);
line(968, 392, 984, 404, [120, 80, 40], 8);
line(984, 404, 1004, 424, [120, 80, 40], 3);

// --- mid headlines (scale 2, gap 1, max 15 chars/line)
const MID_HEAD: string[][] = [
  ["MACY'S 100TH", 'PARADE', 'POSTPONED'],
  ['KOSPI CRASHES', '6.2% AI FEARS', 'RETURN'],
  ['DOW ERASES', '1,100-PT DROP', 'RECORD CLOSE'],
  ['UK ENERGY CAP', 'JUMPS 26% TO', '£2,166 A YEAR'],
  ['HOUTHIS CLAIM', 'REFINERY HIT', '- RAS TANURA'],
  ['JUDGES: DROP', 'NETANYAHU', 'BRIBERY CASE'],
];
for (let i = 0; i < 6; i++) {
  for (let l = 0; l < MID_HEAD[i].length; l++) put(MID_HEAD[i][l], MX[i] + 5, 452 + l * 16, 2, INK, 160, 1);
}
// --- mid big numbers (scale 3, gap 2)
const MID_BIG: [string, C][] = [
  ['60 MPH', RED], ['-6.2%', RED], ['50,183', GREEN], ['+26%', RED], ['550K BPD', INK], ['CASE 4000', INK],
];
for (let i = 0; i < 6; i++) put(MID_BIG[i][0], MX[i] + 5, 504, 3, MID_BIG[i][1], 160, 2);
// --- mid sub-lines (scale 1, slate)
const MID_SUB: string[][] = [
  ['GUSTS • SAT 28 NOV'],
  ['SAMSUNG -9.9%', 'SK HYNIX -11.1%'],
  ['-1,100 → +164 • +0.33%'],
  ['£1,723 → £2,166 • +£443'],
  ['BRENT $93.60 +2.41%'],
  ['RECOMMEND, NOT A RULING'],
];
for (let i = 0; i < 6; i++) {
  for (let l = 0; l < MID_SUB[i].length; l++) put(MID_SUB[i][l], MX[i] + 5, 530 + l * 9, 1, SLATE, 160);
}
rect(0, 550, 1024, 2, RULE);

// ---------------------------------------------------------------- briefs (5 columns, 41 stories)
const BX = [12, 214, 416, 618, 820];
const BHEAD: [string, C][] = [
  ['MIDDLE EAST', RED], ['ASIA-PACIFIC', TEAL], ['EUROPE', PURPLE], ['AMERICAS', AGREEN], ['GLOBAL & SPORT', BROWN],
];
for (let i = 0; i < 5; i++) {
  text(BHEAD[i][0], BX[i], 556, 2, BHEAD[i][1]);
  rect(BX[i], 578, 190, 3, BHEAD[i][1]);
}
type Brief = [string, string];
const BRIEFS: Brief[][] = [
  [ // Middle East — 8
    ['BOGOR GOLD MINE FLOODS', '9 DEAD, 17 TRAPPED, 100M SHAFT'],
    ['SUDAN DRONE STRIKES', '19 KILLED IN BLUE NILE'],
    ['GAZA STRIKE KILLS HAMAS', 'OFFICIAL, WIFE, 2 DAUGHTERS'],
    ['US: CITIZENS LEAVE IRAN', 'TENSIONS RISE'],
    ['UKRAINE HITS RUSSIAN SHIP', 'CORVETTE OFF BENGHAZI'],
    ['IRAQ ORDERS TROOPS TO BORDERS', 'OIL OVERSIGHT'],
    ['COALITION HITS HODEIDAH', 'MISSILE PLATFORM DESTROYED'],
    ['IRAN WEAPONS CLAIM', 'CHEMICAL ARMS ALLEGED'],
  ],
  [ // Asia-Pacific — 9
    ['SOLOMON ISLANDS TREATY', 'AUSTRALIA TOP SECURITY PARTNER'],
    ['BANGLADESH WAGE +36%', '17,000 TAKAS MINIMUM'],
    ['CHINA PROBES SHANGHAI CHIEF', '4TH TOP LEADER SINCE 2025'],
    ['N. KOREA EXPELS SWISS ENVOY', 'OFFICE TO CLOSE IN 48H'],
    ['HONG KONG: 1 YEAR ON', '168 NAMES READ (ANNIVERSARY)'],
    ['JAPAN: DATA-CENTRE REVOLT', 'AI POWER BOOM SPARKS ROW'],
    ['TAIWAN VOTES SATURDAY', 'AI FAKES FEARED'],
    ['INDIA-MALAYSIA DRILL OPENS', 'HARIMAU SHAKTI IN IPOH'],
    ['INDIA CONDEMNS RIYADH HIT', '11 WOUNDED, 2 INDIANS'],
  ],
  [ // Europe — 8
    ['SPAIN VOTES SUNDAY', 'FAR RIGHT MAY ENTER GOVT'],
    ['MI5 WARNS OF RUSSIAN SABOTAGE', 'UK FIRMS ON ALERT'],
    ['POLAND NO-FLY ZONE', 'NEAR UKRAINE BORDER'],
    ['UK AI WARNING', 'WATCHDOG VS META MUSE AI'],
    ['SARKOZY TO STAND TRIAL 2027', 'WITNESS-TAMPERING CASE'],
    ['LONDON MUSEUM REOPENS', 'VICTORIAN HALL SATURDAY'],
    ['UKRAINE NEEDS EUR 115BN', 'EUR 25BN GAP FOR 2027'],
    ['RUSSIAN WAR DEAD 490,334+', 'LEAKED DATA, UP TO 700K'],
  ],
  [ // Americas — 9
    ['MISSISSIPPI PLANE CRASH', '6 DEAD, FAMILY OF 6'],
    ['IOWA BLAST: 4,400 KG', '20-MILE SHELTER, NO LEAD FOUND'],
    ['VENEZUELA DEBT: $237.5BN', '242% OF GDP (DISCLOSED TUE)'],
    ['CIA NETWORK HACKED', 'OSINT HIT, CHINA SUSPECTED'],
    ['DOJ CHARGES 800+ IN SCAMS', '400 CASES WORLDWIDE'],
    ['NSA NETWORK DOWN FOR DAYS', 'BAD UPDATE, NOT A HACK'],
    ['TRUMP: FUNDING IRAN WAR PREP', 'THROUGH JANUARY'],
    ['MEASLES: 9 US DEATHS IN 2026', 'CDC REPORT'],
    ['CANADA TIGHTENS STUDENT RULES', 'FOREIGN-STUDENT CAPS'],
  ],
  [ // Global & Sport — 7
    ['CHEMICAL WEAPONS', '30+ NATIONS: RUSSIA, STOP'],
    ['LANDMINE DEATHS 5-YEAR HIGH', 'GLOBAL TOLL RISES'],
    ['WHO: END CUBA FUEL BLOCKADE', 'CHIEF URGES US'],
    ['MALAYSIA RETURNS REFUGEES', 'THOUSANDS TO MYANMAR'],
    ['AIRPORTS COURT PRIVATE CASH', 'EXPANSION FUNDING'],
    ['NBA: NETS 104, BUCKS 97', 'RANDLE 28 PTS, CUP WIN'],
    ["MLB SUES PLAYERS' UNION", '38-PAGE LOCKOUT COMPLAINT'],
  ],
];
for (let col = 0; col < 5; col++) {
  for (let r = 0; r < BRIEFS[col].length; r++) {
    const y = 586 + r * 30;
    put(BRIEFS[col][r][0], BX[col], y, 1, INK, 190);
    put(BRIEFS[col][r][1], BX[col], y + 9, 1, SLATE, 190);
  }
}
// date-check note sits DIRECTLY under the last GLOBAL & SPORT brief (v3 gap fixed)
put('EVERY STORY DATE-CHECKED', 820, 796, 1, SLATE, 190);
put('FOR WED 25 NOV 2026', 820, 805, 1, SLATE, 190);

// ---------------------------------------------------------------- footer
rect(0, 852, 1024, 172, NAVY);
text('CLAIMED VS CONFIRMED', 12, 864, 2, YELLOW);
put('CAIRO 31/21 CONFIRMED NEXT MORNING • BOGOR 9/17 IS THE 25 NOV FIGURE', 12, 890, 1, WHITE, 660);
put('HONG KONG FIRE IS 2025 ANNIVERSARY, NOT A NEW FIRE • VENEZUELA DEBT DISCLOSED TUE 24, REPORTED WED 25', 12, 902, 1, WHITE, 660);
// date check box (right)
rect(700, 862, 312, 48, YELLOW);
rect(703, 865, 306, 42, NAVY);
text('DATE CHECK:', 790, 870, 2, YELLOW);
text('WED 25 NOV 2026', 766, 888, 2, YELLOW);
// markets strip + sources + bottom line
rect(12, 926, 1000, 2, [120, 110, 80]);
put('DOW 50,182.95 +0.33% • S&P 7,182.78 -0.25% • NASDAQ 23,585.80 -0.62% • KOSPI -6.16% • BRENT $93.60 • GOLD $3,598.10 • BITCOIN $60,200.94 • 10-YR 4.85%', 12, 938, 1, YELLOW, 1000);
put('SOURCES: REUTERS • AP • BBC • NYT • ESPN • OFGEM • PIB • AL JAZEERA • MARKETS CLOSED THU 26 NOV (THANKSGIVING); FRI HALF-DAY', 12, 962, 1, LTEXT, 1000);
put('50 STORIES • TARIFF LEAD • WHY IT MATTERS • EVERY STORY DATE-CHECKED FOR WED 25 NOV 2026', 12, 992, 1, LTEXT, 1000);

// ---------------------------------------------------------------- output
const outDir = (() => {
  const ai = process.argv.indexOf('--output');
  if (ai >= 0 && process.argv[ai + 1]) return process.argv[ai + 1];
  return process.env.MAKEFUN_OUTPUT_DIR || '/output';
})();
mkdirSync(outDir, { recursive: true });
const png = encodePNG(W, H, img);
writeFileSync(join(outDir, 'entry.png'), png);
console.log('TRUNCATIONS: ' + truncations);
console.log(`WROTE ${png.length} bytes to ${outDir}/entry.png`);
