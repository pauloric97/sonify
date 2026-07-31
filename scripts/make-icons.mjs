// Gera os ícones do PWA sem depender de ImageMagick/sharp: escreve o PNG na mão.
// Rode com: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'public/icons');
mkdirSync(OUT, { recursive: true });

/* --------------------------------------------------------------- PNG */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro "none"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------ desenho */

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Degradê da marca: violeta -> rosa.
const C1 = [124, 92, 255];
const C2 = [232, 74, 178];

/** Distância assinada de um retângulo com cantos arredondados. */
function roundedRect(px, py, w, h, r) {
  const dx = Math.abs(px - w / 2) - (w / 2 - r);
  const dy = Math.abs(py - h / 2) - (h / 2 - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - r;
}

/** Triângulo de "play" com pontas levemente arredondadas. */
function playGlyph(px, py, size, inset) {
  const s = size * inset;
  const ox = (size - s) / 2 + s * 0.08;
  const oy = (size - s) / 2;
  const x = px - ox;
  const y = py - oy;
  const a = [s * 0.12, s * 0.06];
  const b = [s * 0.12, s * 0.94];
  const c = [s * 0.9, s * 0.5];
  const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = sign([x, y], a, b);
  const d2 = sign([x, y], b, c);
  const d3 = sign([x, y], c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function render(size, { maskable = false } = {}) {
  const SS = 3; // supersampling pra borda lisa
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.23;
  const glyphInset = maskable ? 0.44 : 0.52;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (maskable || roundedRect(px, py, size, size, radius) <= 0) bg++;
          if (playGlyph(px, py, size, glyphInset)) fg++;
        }
      }
      const total = SS * SS;
      const bgA = bg / total;
      const fgA = (fg / total) * bgA;

      const t = clamp01((x / size) * 0.6 + (y / size) * 0.6);
      const r = mix(C1[0], C2[0], t);
      const g = mix(C1[1], C2[1], t);
      const b = mix(C1[2], C2[2], t);

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(mix(r, 255, fgA));
      rgba[i + 1] = Math.round(mix(g, 255, fgA));
      rgba[i + 2] = Math.round(mix(b, 255, fgA));
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePng(size, size, rgba);
}

writeFileSync(path.join(OUT, 'icon-192.png'), render(192));
writeFileSync(path.join(OUT, 'icon-512.png'), render(512));
writeFileSync(path.join(OUT, 'maskable-512.png'), render(512, { maskable: true }));

console.log('Ícones gerados em public/icons/');
