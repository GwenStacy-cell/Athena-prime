// upload-jtc-emojis.mjs
// Uploads all JTC icons as Discord Application Emojis (bot-level, work in every server)
// Run ONCE: node upload-jtc-emojis.mjs
// This saves emoji IDs to assets/jtc-emoji-map.json which the bot uses automatically.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.join(__dirname, 'assets', 'jtc-icons');
const MAP_FILE = path.join(__dirname, 'assets', 'jtc-emoji-map.json');
const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.CLIENT_ID; // Uses CLIENT_ID from your .env

const ICONS = [
  'name', 'limit', 'status', 'game', 'lfm',
  'bitrate', 'region', 'text', 'nsfw', 'claim',
  'lock', 'unlock', 'permit', 'reject', 'invite',
  'ghost', 'unghost', 'transfer'
];

if (!TOKEN) { console.error('❌ Missing DISCORD_TOKEN in .env'); process.exit(1); }
if (!APP_ID) { console.error('❌ Missing CLIENT_ID in .env'); process.exit(1); }

async function fetchExistingEmojis() {
  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
    headers: { Authorization: `Bot ${TOKEN}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

async function deleteEmoji(emojiId) {
  await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis/${emojiId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${TOKEN}` }
  });
}

async function uploadEmoji(name, filePath) {
  const imgBuffer = fs.readFileSync(filePath);
  const base64 = imgBuffer.toString('base64');
  const dataURI = `data:image/png;base64,${base64}`;

  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
    method: 'POST',
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `jtc_${name}`, image: dataURI })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to upload ${name}: ${JSON.stringify(err)}`);
  }

  return await res.json();
}

async function main() {
  console.log('🎨 JTC Emoji Uploader\n');
  console.log('📡 Fetching existing application emojis...');

  const existing = await fetchExistingEmojis();
  const existingJtc = existing.filter(e => e.name.startsWith('jtc_'));

  if (existingJtc.length > 0) {
    console.log(`🗑️  Removing ${existingJtc.length} old JTC emojis...`);
    for (const e of existingJtc) {
      await deleteEmoji(e.id);
      await new Promise(r => setTimeout(r, 300)); // Rate limit
    }
  }

  const emojiMap = {};
  let success = 0;

  for (const name of ICONS) {
    const filePath = path.join(ICON_DIR, `${name}.png`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  Skipping ${name}.png (file not found)`);
      continue;
    }

    try {
      process.stdout.write(`  ⬆️  Uploading ${name}...`);
      const emoji = await uploadEmoji(name, filePath);
      emojiMap[name] = { id: emoji.id, name: emoji.name };
      console.log(` ✅ ID: ${emoji.id}`);
      success++;
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(emojiMap, null, 2));
  console.log(`\n✨ Done! ${success}/${ICONS.length} emojis uploaded.`);
  console.log(`📄 Emoji map saved to: assets/jtc-emoji-map.json`);
  console.log('\n🔁 Restart your bot to apply the icons to the control panel!');
}

main().catch(console.error);
