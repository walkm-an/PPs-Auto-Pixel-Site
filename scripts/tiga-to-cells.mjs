import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(root, 'assets/tiga-clean.png');
const outPath = path.join(root, 'src/generated/tiga-pack.ts');
const previewPath = path.join(root, 'PROOF/tiga-preview.png');

const COLS = 52;
const SKY_DISTANCE = 46;
const MARK_LUMA = 230;
const GLYPH_RAMP = ['.', '+', '#', '@'];

const DARK_BG = [20, 19, 17];
const LIGHT_BG = [243, 241, 234];

function parseArgs(argv) {
  return { check: argv.includes('--check') };
}

function channelToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return (
    0.2126 * channelToLinear(rgb[0]) +
    0.7152 * channelToLinear(rgb[1]) +
    0.0722 * channelToLinear(rgb[2])
  );
}

function contrast(rgb, bg) {
  const a = luminance(rgb);
  const b = luminance(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function hex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
      .join('')
  );
}

function liftForBackground(gem, bg) {
  const toward = luminance(bg) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  let lo = 0;
  let hi = 1;
  let best = mix(gem, toward, 1);
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    const color = mix(gem, toward, mid);
    if (contrast(color, bg) >= 4.5) {
      best = color;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

function medianChannel(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function hash(x, y) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return n >>> 0;
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function pixel(png, x, y) {
  const i = (png.width * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

function skyReference(png) {
  const rs = [];
  const gs = [];
  const bs = [];
  const n = 28;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const [r, g, b] = pixel(png, x, y);
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
  return [medianChannel(rs), medianChannel(gs), medianChannel(bs)];
}

function isSky(rgb, sky) {
  const dr = rgb[0] - sky[0];
  const dg = rgb[1] - sky[1];
  const db = rgb[2] - sky[2];
  return dr * dr + dg * dg + db * db < SKY_DISTANCE * SKY_DISTANCE && rgb[2] > rgb[0] && rgb[2] > rgb[1];
}

function isBadgePixel(rgb) {
  return rgb[0] >= MARK_LUMA && rgb[1] >= MARK_LUMA && rgb[2] >= MARK_LUMA;
}

function gemColor(png) {
  const rs = [];
  const gs = [];
  const bs = [];
  const x0 = Math.floor(png.width * 0.35);
  const x1 = Math.floor(png.width * 0.65);
  const y0 = Math.floor(png.height * 0.28);
  const y1 = Math.floor(png.height * 0.52);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const [r, g, b] = pixel(png, x, y);
      if (b > 170 && r < 50 && g < 80) {
        rs.push(r);
        gs.push(g);
        bs.push(b);
      }
    }
  }
  if (rs.length < 20) {
    throw new Error(`color timer sample too small: ${rs.length}`);
  }
  return [medianChannel(rs), medianChannel(gs), medianChannel(bs)];
}

function glyphIndex(coverage) {
  if (coverage > 0.85) return 3;
  if (coverage > 0.62) return 2;
  if (coverage > 0.4) return 1;
  return 0;
}

function buildCells(png) {
  const sky = skyReference(png);
  const cols = COLS;
  const rows = Math.round((png.height / png.width) * cols);
  const cellW = png.width / cols;
  const cellH = png.height / rows;
  const cells = [];

  for (let cy = 0; cy < rows; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const x0 = Math.floor(cx * cellW);
      const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW));
      const y0 = Math.floor(cy * cellH);
      const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH));
      let total = 0;
      let kept = 0;
      let badge = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const rgb = pixel(png, x, y);
          total += 1;
          if (isBadgePixel(rgb)) {
            badge += 1;
            continue;
          }
          if (isSky(rgb, sky)) continue;
          kept += 1;
          sr += rgb[0];
          sg += rgb[1];
          sb += rgb[2];
        }
      }
      if (total === 0 || kept === 0) continue;
      if (badge / total > 0.18) continue;
      const coverage = kept / total;
      if (coverage < 0.22) continue;
      cells.push({
        x: cx,
        y: cy,
        r: Math.round(sr / kept),
        g: Math.round(sg / kept),
        b: Math.round(sb / kept),
        glyph: glyphIndex(coverage),
      });
    }
  }

  const keptCells = dropIslands(cells, 10);
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const jitterSpan = Math.max(4, Math.floor(cols / 5));
  for (const cell of keptCells) {
    const dist = (cell.x - cx) ** 2 + (cell.y - cy) ** 2;
    cell.score = dist * 10 + (hash(cell.x, cell.y) % jitterSpan);
  }
  keptCells.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);

  return { cols, rows, sky, cells: keptCells };
}

function dropIslands(cells, minSize) {
  const key = (x, y) => `${x},${y}`;
  const byKey = new Map(cells.map((cell) => [key(cell.x, cell.y), cell]));
  const seen = new Set();
  const kept = [];
  for (const start of cells) {
    const startKey = key(start.x, start.y);
    if (seen.has(startKey)) continue;
    const stack = [start];
    const group = [];
    seen.add(startKey);
    while (stack.length) {
      const cell = stack.pop();
      group.push(cell);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextKey = key(cell.x + dx, cell.y + dy);
          if (seen.has(nextKey) || !byKey.has(nextKey)) continue;
          seen.add(nextKey);
          stack.push(byKey.get(nextKey));
        }
      }
    }
    if (group.length >= minSize) kept.push(...group);
  }
  return kept;
}

function packCells(cells) {
  const buf = Buffer.alloc(cells.length * 6);
  cells.forEach((cell, index) => {
    const o = index * 6;
    buf[o] = cell.x;
    buf[o + 1] = cell.y;
    buf[o + 2] = cell.r;
    buf[o + 3] = cell.g;
    buf[o + 4] = cell.b;
    buf[o + 5] = cell.glyph;
  });
  return buf.toString('base64');
}

function renderModule(frame, gem) {
  const accentOnDark = liftForBackground(gem, DARK_BG);
  const accentOnLight = liftForBackground(gem, LIGHT_BG);
  const body = [
    '// Generated by scripts/tiga-to-cells.mjs. Do not edit by hand.',
    '// Each cell is 6 bytes: x, y, r, g, b, glyph. glyph 0..3 maps to . + # @',
    '// Cells are stored center-out so the loader can slice the string by time.',
    'export const tigaPack = {',
    `  cols: ${frame.cols},`,
    `  rows: ${frame.rows},`,
    `  accentGem: '${hex(gem)}',`,
    `  accentOnDark: '${hex(accentOnDark)}',`,
    `  accentOnLight: '${hex(accentOnLight)}',`,
    `  cells: '${packCells(frame.cells)}',`,
    '} as const;',
    '',
    'export type TigaPack = typeof tigaPack;',
    '',
  ].join('\n');
  return { body, accentOnDark, accentOnLight };
}

function writePreview(frame, file) {
  const scale = 10;
  const png = new PNG({ width: frame.cols * scale, height: frame.rows * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = DARK_BG[0];
    png.data[i + 1] = DARK_BG[1];
    png.data[i + 2] = DARK_BG[2];
    png.data[i + 3] = 255;
  }
  for (const cell of frame.cells) {
    const inset = cell.glyph === 0 ? 3 : cell.glyph === 1 ? 2 : 1;
    for (let y = inset; y < scale - inset; y += 1) {
      for (let x = inset; x < scale - inset; x += 1) {
        const i = ((cell.y * scale + y) * png.width + (cell.x * scale + x)) << 2;
        png.data[i] = cell.r;
        png.data[i + 1] = cell.g;
        png.data[i + 2] = cell.b;
        png.data[i + 3] = 255;
      }
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function assertFrame(frame) {
  if (frame.cells.length < 400) {
    throw new Error(`too few cells: ${frame.cells.length}`);
  }
  if (frame.cells.length > 4000) {
    throw new Error(`too many cells: ${frame.cells.length}`);
  }
  const edge = frame.cells.filter((cell) => cell.x > frame.cols - 3 && cell.y > frame.rows - 3);
  if (edge.length > 0) {
    throw new Error(`badge cells survived in the corner: ${edge.length}`);
  }
  for (const cell of frame.cells) {
    if (cell.x > 255 || cell.y > 255 || cell.glyph > 3) {
      throw new Error('cell does not fit the 6-byte pack');
    }
  }
}

function main() {
  const { check } = parseArgs(process.argv.slice(2));
  const png = readPng(inputPath);
  const frame = buildCells(png);
  assertFrame(frame);
  const gem = gemColor(png);
  const rendered = renderModule(frame, gem);
  if (check) {
    const current = fs.readFileSync(outPath, 'utf8');
    if (current !== rendered.body) {
      console.error('tiga-pack.ts drifted from assets/tiga-clean.png');
      process.exit(1);
    }
    console.log(`cells ok ${frame.cells.length}`);
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rendered.body);
  writePreview(frame, previewPath);
  const gz = gzipSize(rendered.body);
  console.log(
    JSON.stringify({
      cols: frame.cols,
      rows: frame.rows,
      cells: frame.cells.length,
      sky: frame.sky,
      accentGem: hex(gem),
      accentOnDark: hex(rendered.accentOnDark),
      accentOnLight: hex(rendered.accentOnLight),
      moduleBytes: Buffer.byteLength(rendered.body),
      moduleGzip: gz,
      ramp: GLYPH_RAMP.join(''),
      preview: path.relative(root, previewPath),
    }),
  );
}

function gzipSize(text) {
  const { gzipSync } = require('node:zlib');
  return gzipSync(Buffer.from(text)).length;
}

main();
