// crop-icons.mjs — Crops the icon sprite rows into individual 128x128 PNG files
// Run: node crop-icons.mjs

import { Jimp } from 'jimp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ICON_SIZE = 128; // Output size for Discord emojis
const OUT_DIR = path.join(__dirname, 'assets', 'jtc-icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const BRAIN_DIR = 'C:\\Users\\hathi\\.gemini\\antigravity\\brain\\78d01a97-13c2-4051-9bc4-d1b2057d91c6';

// Map: [filename, icons in order, icon width in source, icon height in source]
const ROWS = [
  {
    file: path.join(BRAIN_DIR, 'jtc_settings_row1_1780861474583.png'),
    icons: ['name', 'limit', 'status', 'game', 'lfm'],
    cols: 5
  },
  {
    file: path.join(BRAIN_DIR, 'jtc_settings_row2_1780861494178.png'),
    icons: ['bitrate', 'region', 'text', 'nsfw', 'claim'],
    cols: 5
  },
  {
    file: path.join(BRAIN_DIR, 'jtc_perms_row1_1780861510236.png'),
    icons: ['lock', 'unlock', 'permit', 'reject', 'invite'],
    cols: 5
  },
  {
    file: path.join(BRAIN_DIR, 'jtc_perms_row2_1780861531536.png'),
    icons: ['ghost', 'unghost', 'transfer'],
    cols: 3
  }
];

async function cropAll() {
  for (const row of ROWS) {
    console.log(`Processing: ${path.basename(row.file)}`);
    const img = await Jimp.read(row.file);
    const W = img.width;
    const H = img.height;
    const iconW = Math.floor(W / row.cols);

    for (let i = 0; i < row.icons.length; i++) {
      const name = row.icons[i];
      const x = i * iconW;

      const cropped = img.clone()
        .crop({ x, y: 0, w: iconW, h: H })
        .resize({ w: ICON_SIZE, h: ICON_SIZE });

      const outPath = path.join(OUT_DIR, `${name}.png`);
      await cropped.write(outPath);
      console.log(`  ✅ Saved: ${name}.png`);
    }
  }
  console.log('\n✨ All icons cropped to assets/jtc-icons/');
}

cropAll().catch(console.error);
