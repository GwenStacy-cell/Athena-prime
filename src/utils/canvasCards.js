import { createCanvas, loadImage, registerFont } from './canvas.js';
import { AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';
import db from '../database.js';
import { exec } from 'child_process';
import util from 'util';
import ffmpegPath from 'ffmpeg-static';

const execPromise = util.promisify(exec);

// Register Cinzel Bold for the God of War stone-style name font
const CINZEL_PATH = path.resolve('assets/Cinzel-Bold.ttf');
if (fs.existsSync(CINZEL_PATH)) {
  try { registerFont(CINZEL_PATH, { family: 'Cinzel', weight: 'bold' }); } catch {}
}
const ROBOTO_BOLD_PATH = path.resolve('assets/Roboto-Bold.ttf');
if (fs.existsSync(ROBOTO_BOLD_PATH)) {
  try { registerFont(ROBOTO_BOLD_PATH, { family: 'Roboto', weight: 'bold' }); } catch {}
}
const MONTSERRAT_BOLD_PATH = path.resolve('assets/Montserrat-Bold.ttf');
if (fs.existsSync(MONTSERRAT_BOLD_PATH)) {
  try { registerFont(MONTSERRAT_BOLD_PATH, { family: 'Montserrat', weight: 'bold' }); } catch {}
}

/**
 * Helper: draw a rounded rect path (fallback for older canvas)
 */
function rrPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// Cache Hogwarts master assets in memory so disk is read only once
let hogwartsAssetsCache = null;
async function getHogwartsAssets() {
  if (hogwartsAssetsCache) return hogwartsAssetsCache;
  const [bgImg, owlImg, ringImg] = await Promise.all([
    loadImage(path.resolve('src/assets/rank_hogwarts_master.png')),
    loadImage(path.resolve('src/assets/hedwig_sprite_clean.png')),
    loadImage(path.resolve('src/assets/avatar_runic_ring.png'))
  ]);
  hogwartsAssetsCache = { bgImg, owlImg, ringImg };
  return hogwartsAssetsCache;
}

// Pre-calculate candle positions on Hogwarts altar & castle
const HOGWARTS_CANDLES = [
  { x: 13, y: 76, r: 8 },
  { x: 34, y: 114, r: 9 },
  { x: 52, y: 142, r: 8 },
  { x: 70, y: 168, r: 8 },
  { x: 198, y: 126, r: 9 },
  { x: 216, y: 154, r: 8 },
  { x: 326, y: 276, r: 16 }, // desk lantern
  { x: 964, y: 243, r: 10 },
  { x: 945, y: 38,  r: 8  },
  { x: 989, y: 204, r: 7  }
];

// Pre-calculate deterministic fire embers / sparks
const NUM_EMBERS = 28;
const HOGWARTS_EMBERS = [];
for (let i = 0; i < NUM_EMBERS; i++) {
  HOGWARTS_EMBERS.push({
    x: 80 + (i * 39) % 880,
    y: 30 + (i * 29) % 280,
    vx: -(0.4 + (i % 3) * 0.35),
    vy: -(1.1 + (i % 4) * 0.45),
    size: 1.1 + (i % 3) * 0.8,
    alpha: 0.45 + (i % 5) * 0.12,
    phase: i * 0.45
  });
}

export async function generateAthenaClassicRankCard(member, xp, level, rank, requiredXp) {
  const W = 1024;
  const H = 342;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background obsidian gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0f1117');
  bgGrad.addColorStop(0.5, '#161922');
  bgGrad.addColorStop(1, '#0a0b0e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Border frame
  ctx.strokeStyle = 'rgba(230, 40, 40, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  // Avatar setup
  const avatarCX = 150;
  const avatarCY = 171;
  const avatarR = 85;

  // Outer glowing ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR + 8, 0, Math.PI * 2);
  ctx.strokeStyle = '#e62828';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(230, 40, 40, 0.8)';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();

  // Draw Avatar
  try {
    const avatarUrl = member?.user?.displayAvatarURL ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
    if (avatarUrl) {
      const av = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(av, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
    }
  } catch {}

  // Name
  let rawName = member?.displayName?.replace(/[^\x00-\x7F]/g, '').trim()
             || member?.user?.username?.replace(/[^\x00-\x7F]/g, '').trim()
             || 'MEMBER';
  if (rawName.length > 20) rawName = rawName.substring(0, 20) + '...';

  ctx.font = 'bold 36px "Cinzel", "Montserrat", serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 8;
  ctx.fillText(rawName.toUpperCase(), 290, 110);
  ctx.shadowBlur = 0;

  // Level & Rank
  ctx.font = '22px "Cinzel", "Montserrat", serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Rank #${rank}`, 290, 160);

  ctx.font = 'bold 36px "Cinzel", "Montserrat", serif';
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillText(`Level ${level}`, 480, 160);
  ctx.shadowBlur = 0;

  // XP Progress Bar
  const barX = 290;
  const barY = 205;
  const barW = 660;
  const barH = 24;
  const r = 12;

  rrPath(ctx, barX, barY, barW, barH, r);
  ctx.fillStyle = '#1e2330';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const pct = Math.max(0.02, Math.min(1, xp / Math.max(1, requiredXp)));
  const fillW = Math.max(r * 2, barW * pct);

  ctx.save();
  rrPath(ctx, barX, barY, fillW, barH, r);
  const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
  fillGrad.addColorStop(0, '#b91c1c');
  fillGrad.addColorStop(1, '#ef4444');
  ctx.fillStyle = fillGrad;
  ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  ctx.font = 'bold 15px "Montserrat", "Roboto", sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'right';
  ctx.fillText(`${xp.toLocaleString()} / ${requiredXp.toLocaleString()} XP (${Math.round(pct * 100)}%)`, barX + barW, barY - 8);
  ctx.textAlign = 'left';

  ctx.font = '13px "Cinzel", "Montserrat", serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Athena Prime Defense & Leveling Engine', 290, 275);

  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'rank-card.png' });
}

export async function generateRankCard(member, xp, level, rank, requiredXp) {
  const userId = member?.user?.id || member?.id;
  const theme = db.getUserRankTheme(userId);
  if (theme === 'athena' || theme === 'classic') {
    return generateAthenaClassicRankCard(member, xp, level, rank, requiredXp);
  }
  return generateHogwartsRankGif(member, xp, level, rank, requiredXp);
}

export async function generateHogwartsRankGif(member, xp, level, rank, requiredXp) {
  const W = 1024;
  const H = 342;
  const numFrames = 12;

  const tempDir = path.resolve(`data/rank_temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  let firstFrameBuffer = null;

  try {
    const { bgImg, owlImg, ringImg } = await getHogwartsAssets();

    // Fetch Avatar with robust fallback
    let avatarImg = null;
    if (member?.user?.displayAvatarURL) {
      try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        avatarImg = await loadImage(avatarUrl).catch(() => null);
      } catch {}
    }

    // Name formatting
    let rawName = member?.displayName?.replace(/[^\x00-\x7F]/g, '').trim()
               || member?.user?.username?.replace(/[^\x00-\x7F]/g, '').trim()
               || 'MEMBER';
    if (rawName.length > 22) rawName = rawName.substring(0, 22) + '...';
    const upperName = rawName.toUpperCase();

    // Split at first space or halfway if long single word
    let part1 = upperName;
    let part2 = '';
    const spaceIdx = upperName.indexOf(' ');
    if (spaceIdx > 0 && spaceIdx < upperName.length - 1) {
      part1 = upperName.substring(0, spaceIdx);
      part2 = upperName.substring(spaceIdx + 1);
    } else if (upperName.length > 7) {
      const mid = Math.ceil(upperName.length / 2);
      part1 = upperName.substring(0, mid);
      part2 = upperName.substring(mid);
    }

    // Font size scaling
    let nameFontSize = 38;
    if (upperName.length > 18) nameFontSize = 26;
    else if (upperName.length > 13) nameFontSize = 32;

    // Relative XP calculation
    let prevXp = 0;
    if (level > 0) prevXp = 100 * Math.pow(level, 2) + 100 * level;
    const relXp  = Math.max(0, xp - prevXp);
    const relReq = Math.max(1, requiredXp - prevXp);
    const pct    = Math.min(Math.max(relXp / relReq, 0.02), 1.0);

    // Progress Bar parameters
    const barX = 340, barY = 195, barW = 600, barH = 20, barR = 10;
    const fillW = Math.max(barH, barW * pct);

    // Avatar center and radius
    const avX = 210, avY = 138, avR = 81;

    // Render 12 frames
    for (let f = 0; f < numFrames; f++) {
      const phi = (2 * Math.PI * f) / numFrames;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      // 1. Master Background Plate
      ctx.drawImage(bgImg, 0, 0, W, H);

      // 2. Animated Candle Flames & Lantern Aura
      for (let cIdx = 0; cIdx < HOGWARTS_CANDLES.length; cIdx++) {
        const c = HOGWARTS_CANDLES[cIdx];
        const flicker = 0.75 + 0.25 * Math.sin(phi * 2 + cIdx * 1.5) + 0.08 * Math.cos(phi * 3 + cIdx);
        const rad = c.r * flicker;
        const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, rad * 2.2);
        g.addColorStop(0, 'rgba(255, 235, 140, 0.75)');
        g.addColorStop(0.35, 'rgba(255, 130, 30, 0.35)');
        g.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rad * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Avatar Fire Halo, Clipped Avatar & Runic Crest Overlay
      const haloR = 88 + Math.sin(phi) * 3;
      const halo = ctx.createRadialGradient(avX, avY, 78, avX, avY, haloR + 14);
      halo.addColorStop(0, 'rgba(240, 40, 20, 0.45)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(avX, avY, haloR + 14, 0, Math.PI * 2);
      ctx.fill();

      // Draw Avatar (or dark fallback if unavailable)
      ctx.save();
      ctx.beginPath();
      ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (avatarImg) {
        ctx.drawImage(avatarImg, avX - avR, avY - avR, avR * 2, avR * 2);
      } else {
        const defaultAvGrad = ctx.createRadialGradient(avX, avY, 10, avX, avY, avR);
        defaultAvGrad.addColorStop(0, '#551111');
        defaultAvGrad.addColorStop(1, '#1a0505');
        ctx.fillStyle = defaultAvGrad;
        ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
        ctx.font = 'bold 50px "Cinzel", "Montserrat", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText((rawName[0] || '?').toUpperCase(), avX, avY + 18);
        ctx.textAlign = 'left';
      }
      ctx.restore();

      // Overlay Runic Ring on top of avatar edge
      ctx.drawImage(ringImg, 0, 0, W, H);

      // 4. Hedwig Owl Floating & Soaring Hover
      const owlCX = 890;
      const owlCY = 68;
      const floatY = Math.sin(phi) * 4.2;
      const tilt = Math.cos(phi) * 0.025;
      const owlW = 195;
      const owlH = 195;

      ctx.save();
      ctx.translate(owlCX, owlCY + floatY);
      ctx.rotate(tilt);
      ctx.drawImage(owlImg, -owlW / 2, -owlH / 2, owlW, owlH);
      ctx.restore();

      // 5. Dynamic Flaming Progress Bar
      // Outer track
      ctx.fillStyle = 'rgba(12, 3, 3, 0.88)';
      rrPath(ctx, barX, barY, barW, barH, barR);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 25, 25, 0.6)';
      ctx.lineWidth = 1.5;
      rrPath(ctx, barX, barY, barW, barH, barR);
      ctx.stroke();

      // Fiery animated fill
      ctx.save();
      rrPath(ctx, barX, barY, fillW, barH, barR);
      ctx.clip();

      const flameGrad = ctx.createLinearGradient(barX - (f * 15), barY, barX + fillW + (f * 15), barY);
      flameGrad.addColorStop(0, '#550000');
      flameGrad.addColorStop(0.3, '#aa1111');
      flameGrad.addColorStop(0.7, '#ff2222');
      flameGrad.addColorStop(1, '#ff8888');
      ctx.fillStyle = flameGrad;
      ctx.fillRect(barX, barY, fillW, barH);

      // Crackling lightning arcs along fill
      ctx.strokeStyle = 'rgba(255, 230, 230, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(barX + 10, barY + barH / 2);
      let lx = barX + 10;
      while (lx < barX + fillW - 8) {
        lx += 15 + Math.random() * 10;
        const ly = barY + barH / 2 + (Math.sin(phi * 3 + lx) * 3);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
      ctx.restore();

      // Plasma Head Orb
      const headX = barX + fillW;
      const headY = barY + barH / 2;
      const orbR = 12 + Math.sin(phi * 2) * 1.8;
      const orbGrad = ctx.createRadialGradient(headX, headY, 1, headX, headY, orbR * 1.8);
      orbGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      orbGrad.addColorStop(0.3, 'rgba(255, 80, 50, 0.95)');
      orbGrad.addColorStop(0.7, 'rgba(230, 20, 20, 0.45)');
      orbGrad.addColorStop(1, 'rgba(200, 0, 0, 0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(headX, headY, orbR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 6. Fire Sparks / Embers Particle Drift
      for (let eIdx = 0; eIdx < HOGWARTS_EMBERS.length; eIdx++) {
        const e = HOGWARTS_EMBERS[eIdx];
        const curX = (e.x + e.vx * f * 4 + W) % W;
        let curY = e.y + e.vy * f * 4;
        if (curY < 0) curY += H;
        const waveX = curX + Math.sin(phi + e.phase) * 5;
        const sparkAlpha = e.alpha * (0.7 + 0.3 * Math.sin(phi * 2 + eIdx));

        ctx.fillStyle = (eIdx % 2 === 0)
          ? `rgba(255, 200, 70, ${sparkAlpha})`
          : `rgba(255, 60, 30, ${sparkAlpha})`;
        ctx.beginPath();
        ctx.arc(waveX, curY, e.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Dynamic Typography
      // Username Dual-Tone
      const nameX = 340, nameY = 110;
      ctx.font = `bold ${nameFontSize}px "Cinzel", "Montserrat", "Roboto", serif`;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Part 1: Silver Stone
      ctx.fillStyle = '#eaecee';
      ctx.fillText(part1, nameX, nameY);
      const p1w = ctx.measureText(part1).width;

      // Part 2: Fiery Crimson
      if (part2) {
        ctx.shadowColor = 'rgba(230, 20, 20, 0.7)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff2222';
        ctx.fillText(' ' + part2, nameX + p1w, nameY);
      }
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Rank
      ctx.font = 'bold 20px "Montserrat", "Roboto", sans-serif';
      ctx.fillStyle = '#9ea5b0';
      ctx.fillText(`Rank #${rank}`, nameX + 2, nameY + 42);

      // Level
      const lvlBaseX = 640, lvlBaseY = 152;
      ctx.font = '24px "Cinzel", "Montserrat", serif';
      ctx.fillStyle = '#b8bec8';
      ctx.fillText('Level', lvlBaseX, lvlBaseY);
      const lvlLabelW = ctx.measureText('Level').width;

      ctx.font = 'bold 44px "Cinzel", "Montserrat", serif';
      ctx.fillStyle = '#ff2222';
      ctx.shadowColor = 'rgba(255, 30, 30, 0.8)';
      ctx.shadowBlur = 14;
      ctx.fillText(` ${level}`, lvlBaseX + lvlLabelW, lvlBaseY + 6);
      ctx.shadowBlur = 0;

      // XP Text
      ctx.font = 'bold 13px "Montserrat", "Roboto", monospace';
      ctx.fillStyle = '#9ea5b0';
      ctx.textAlign = 'right';
      ctx.fillText(`${xp.toLocaleString()} / ${requiredXp.toLocaleString()} XP`, barX + barW, barY - 7);
      ctx.textAlign = 'left';

      // Save frame PNG
      const frameBuffer = canvas.toBuffer('image/png');
      if (f === 0) firstFrameBuffer = frameBuffer;
      const framePath = path.join(tempDir, `frame_${String(f).padStart(2, '0')}.png`);
      fs.writeFileSync(framePath, frameBuffer);
    }

    // 2-pass FFmpeg Palettegen + Paletteuse for highest fidelity GIF
    const gifOutPath = path.join(tempDir, 'rank-card.gif');
    const palettePath = path.join(tempDir, 'palette.png');

    const genPaletteCmd = `"${ffmpegPath}" -y -framerate 10 -i "${tempDir}/frame_%02d.png" -vf "palettegen=stats_mode=diff" "${palettePath}"`;
    const encodeGifCmd = `"${ffmpegPath}" -y -framerate 10 -i "${tempDir}/frame_%02d.png" -i "${palettePath}" -lavfi "paletteuse=dither=bayer:bayer_scale=3" "${gifOutPath}"`;

    await execPromise(genPaletteCmd);
    await execPromise(encodeGifCmd);

    const gifBuffer = fs.readFileSync(gifOutPath);
    return new AttachmentBuilder(gifBuffer, { name: 'rank-card.gif' });
  } catch (err) {
    console.error('[RankCard] Animated GIF generation error, falling back to static card:', err);
    if (firstFrameBuffer) {
      return new AttachmentBuilder(firstFrameBuffer, { name: 'rank-card.png' });
    }
    const fallbackCanvas = createCanvas(W, H);
    return new AttachmentBuilder(fallbackCanvas.toBuffer('image/png'), { name: 'rank-card.png' });
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

export async function generateLeaderboard(guild, users, page, totalPages) {
  const width = 800;
  const height = 150 + (users.length * 80);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2b2d31';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, width, height, 20);
  } else {
    ctx.rect(0, 0, width, height);
  }
  ctx.fill();

  // Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${guild.name} Leaderboard`, width / 2, 70);

  ctx.fillStyle = '#b9bbbe';
  ctx.font = '24px sans-serif';
  ctx.fillText(`Page ${page} / ${totalPages}`, width / 2, 110);

  // Draw Users
  ctx.textAlign = 'left';
  let yPos = 160;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const rankNum = ((page - 1) * 10) + i + 1;

    ctx.fillStyle = rankNum <= 3 ? '#FFD700' : '#b9bbbe';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`#${rankNum}`, 40, yPos + 40);

    try {
      const member = await guild.members.fetch(user.userId).catch(() => null);
      if (member) {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 64 });
        const av = await loadImage(avatarUrl).catch(() => null);
        if (av) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(160, yPos + 30, 30, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(av, 130, yPos, 60, 60);
          ctx.restore();
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        let dname = member.displayName.replace(/[^\x00-\x7F]/g, '').trim()
                 || member.user.username.replace(/[^\x00-\x7F]/g, '').trim()
                 || 'User';
        if (dname.length > 20) dname = dname.substring(0, 20) + '...';
        ctx.fillText(dname, 210, yPos + 40);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('Unknown User', 210, yPos + 40);
      }
    } catch {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('Unknown User', 210, yPos + 40);
    }

    ctx.fillStyle = '#5865F2';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Level ${user.level}`, width - 40, yPos + 25);

    ctx.fillStyle = '#b9bbbe';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${user.xp} XP`, width - 40, yPos + 55);

    ctx.textAlign = 'left';
    yPos += 80;
  }

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
}

export async function generateProfileCard(member, xpData, statsData, guild) {
  const W = 960;
  const H = 340;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  let bgLoaded = false;
  for (const bgPath of ['src/assets/rank_gow_bg.png', 'src/assets/rank_bg.jpg']) {
    try {
      const bg = await loadImage(bgPath);
      ctx.drawImage(bg, 0, 0, W, H);
      bgLoaded = true;
      break;
    } catch {}
  }
  if (!bgLoaded) {
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);
  }

  // Semi-transparent dark overlay for high contrast
  ctx.fillStyle = 'rgba(7, 7, 10, 0.65)';
  ctx.fillRect(0, 0, W, H);

  // Border frame
  ctx.strokeStyle = 'rgba(165, 20, 20, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Avatar Setup
  const avatarCX = 135;
  const avatarCY = 155;
  const avatarR = 80;

  // Red ring / seal behind avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR + 10, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(190, 25, 25, 0.7)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#cc1818';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();

  // Draw Avatar
  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const av = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(av, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#222226';
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Username in Cinzel Two-Tone
  let rawName = member.displayName.replace(/[^\x00-\x7F]/g, '').trim()
             || member.user.username.replace(/[^\x00-\x7F]/g, '').trim()
             || 'Warrior';
  if (rawName.length > 18) rawName = rawName.substring(0, 18) + '...';
  const upperName = rawName.toUpperCase();

  let part1 = upperName;
  let part2 = '';
  const spaceIdx = upperName.indexOf(' ');
  if (spaceIdx > 0 && spaceIdx < upperName.length - 1) {
    part1 = upperName.substring(0, spaceIdx);
    part2 = upperName.substring(spaceIdx + 1);
  } else if (upperName.length > 5) {
    const mid = Math.ceil(upperName.length / 2);
    part1 = upperName.substring(0, mid);
    part2 = upperName.substring(mid);
  }

  const textX = 255;
  const nameY = 85;

  ctx.font = `bold 38px "Cinzel", "Montserrat", "Roboto", serif`;
  ctx.fillStyle = '#b0b4bb'; // Stone grey
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 8;
  ctx.fillText(part1, textX, nameY);
  const p1Width = ctx.measureText(part1).width;

  if (part2) {
    ctx.fillStyle = '#cc1818'; // Blood red
    ctx.shadowColor = 'rgba(204,24,24,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(' ' + part2, textX + p1Width, nameY);
  }
  ctx.shadowBlur = 0;

  // Subtitle: Server & Badges
  ctx.fillStyle = '#7a7f87';
  ctx.font = `bold 16px "Montserrat", "Roboto", sans-serif`;
  ctx.fillText(`MEMBER OF ${guild.name.toUpperCase()} • ATHENA VERIFIED`, textX, nameY + 28);

  // Divider line
  ctx.strokeStyle = 'rgba(180, 30, 30, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(textX, nameY + 42);
  ctx.lineTo(W - 40, nameY + 42);
  ctx.stroke();

  // Metrics Grid (Level, Rank, Messages, Voice Hours)
  const gridY = nameY + 85;
  const metrics = [
    { label: 'LEVEL', value: `${xpData.level || 0}`, color: '#ffffff' },
    { label: 'RANK', value: `#${xpData.rank || 1}`, color: '#cc1818' },
    { label: 'MESSAGES', value: `${(statsData.messages || 0).toLocaleString()}`, color: '#ffffff' },
    { label: 'VOICE TIME', value: `${((statsData.voiceSeconds || 0) / 3600).toFixed(1)}h`, color: '#ffffff' }
  ];

  const colWidth = 160;
  for (let i = 0; i < metrics.length; i++) {
    const mx = textX + (i * colWidth);
    ctx.fillStyle = '#656b73';
    ctx.font = `bold 13px "Montserrat", "Roboto", sans-serif`;
    ctx.fillText(metrics[i].label, mx, gridY);

    ctx.fillStyle = metrics[i].color;
    ctx.font = `bold 24px "Cinzel", "Montserrat", "Roboto", serif`;
    ctx.fillText(metrics[i].value, mx, gridY + 30);
  }

  // XP Progress Bar
  const barX = textX;
  const barY = gridY + 75;
  const barW = W - textX - 45;
  const barH = 18;
  const barR = 9;

  ctx.fillStyle = 'rgba(20, 4, 4, 0.85)';
  rrPath(ctx, barX, barY, barW, barH, barR);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 15, 15, 0.7)';
  ctx.lineWidth = 1.5;
  rrPath(ctx, barX, barY, barW, barH, barR);
  ctx.stroke();

  const reqXp = xpData.requiredXp || 1000;
  const currXp = xpData.xp || 0;
  const ratio = Math.min(currXp / reqXp, 1);
  const fillW = Math.max(barR * 2, barW * ratio);

  const xpGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
  xpGrad.addColorStop(0, '#6b0000');
  xpGrad.addColorStop(0.5, '#bb1010');
  xpGrad.addColorStop(1, '#ff3838');
  ctx.fillStyle = xpGrad;
  rrPath(ctx, barX, barY, fillW, barH, barR);
  ctx.fill();

  // XP Text
  ctx.fillStyle = '#a5a9b0';
  ctx.font = `bold 12px "Montserrat", "Roboto", sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`${currXp.toLocaleString()} / ${reqXp.toLocaleString()} XP`, barX + barW, barY - 6);
  ctx.textAlign = 'left';

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'profile_card.png' });
}

let cachedWarRoomPlate = null;
async function getWarRoomPlate() {
  if (!cachedWarRoomPlate) {
    const platePath = path.resolve('src/assets/hud_war_room_plate.jpg');
    if (fs.existsSync(platePath)) {
      try {
        cachedWarRoomPlate = await loadImage(platePath);
      } catch {}
    }
  }
  return cachedWarRoomPlate;
}

/**
 * Generates an ultra-sleek, dynamic Cyber HUD animated looping GIF for Discord commands (Whitelist, Security, Triggers, Automod, etc.)
 * Dynamically draws the server/member icon, title, animated glowing progress bar, status badges, and real-time metrics chips.
 * Modeled after the 1024x512 Athena Prime Global Defense War Room Command Center.
 */
export async function generateCommandStatusBanner({
  title = 'SYSTEM MATRIX',
  subtitle = 'ATHENA PRIME DEFENSE ENGINE',
  badge = 'ACTIVE',
  badgeColor = '#00f0ff',
  iconUrl = null,
  fallbackInitial = 'A',
  current = 10,
  total = 20,
  unit = 'UNITS',
  accentColor = '#00ff88',
  metrics = [],
  attachmentName = 'status_banner.gif',
  animated = true
}) {
  const W = 1024;
  const H = 512;
  const numFrames = animated ? 8 : 1;
  const tempDir = path.resolve(`data/status_gif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  
  if (animated) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let firstFrameBuffer = null;

  // Pre-load base plate and icon
  const basePlate = await getWarRoomPlate();

  let iconImg = null;
  if (iconUrl) {
    try {
      iconImg = await loadImage(iconUrl);
    } catch {}
  }

  const clamped = Math.max(0, Math.min(current, total));
  const ratio = total > 0 ? clamped / total : 0;
  const pct = Math.round(ratio * 100);

  const barX = 255;
  const barY = 202;
  const barW = 580;
  const barH = 26;
  const fillW = Math.max(16, Math.min(barW, barW * ratio));

  const iconCX = 138;
  const iconCY = 177;
  const iconR = 50;

  try {
    for (let f = 0; f < numFrames; f++) {
      const phi = (2 * Math.PI * f) / numFrames;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      // 1. Draw 1024x512 Base War Room Background
      if (basePlate) {
        ctx.drawImage(basePlate, 0, 0, W, H);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#040b08');
        bgGrad.addColorStop(0.5, '#071610');
        bgGrad.addColorStop(1, '#020805');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
      }

      // 2. High-Tech Translucent Cyber Glass HUD Over Center Console
      const panelGrad = ctx.createLinearGradient(242, 82, 242, 332);
      panelGrad.addColorStop(0, 'rgba(1, 14, 10, 0.96)');
      panelGrad.addColorStop(0.5, 'rgba(2, 22, 16, 0.94)');
      panelGrad.addColorStop(1, 'rgba(1, 12, 8, 0.97)');

      ctx.save();
      ctx.fillStyle = panelGrad;
      ctx.beginPath();
      ctx.roundRect(242, 82, 616, 250, 12);
      ctx.fill();

      // Fine holographic tactical grid
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 242; x < 858; x += 22) {
        ctx.beginPath(); ctx.moveTo(x, 82); ctx.lineTo(x, 332); ctx.stroke();
      }
      for (let y = 82; y < 332; y += 22) {
        ctx.beginPath(); ctx.moveTo(242, y); ctx.lineTo(858, y); ctx.stroke();
      }

      // Glowing panel border
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      // 3. Avatar / Server Icon inside Left Holographic Reticle
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (iconImg) {
        ctx.drawImage(iconImg, iconCX - iconR, iconCY - iconR, iconR * 2, iconR * 2);
      } else {
        ctx.fillStyle = '#01120a';
        ctx.fillRect(iconCX - iconR, iconCY - iconR, iconR * 2, iconR * 2);
        ctx.font = 'bold 44px sans-serif';
        ctx.fillStyle = accentColor;
        ctx.textAlign = 'center';
        ctx.fillText((fallbackInitial || 'A')[0].toUpperCase(), iconCX, iconCY + 16);
      }
      ctx.restore();

      // Concentric neon glowing border around avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // Outer animated rotating HUD reticle ticks
      ctx.save();
      ctx.translate(iconCX, iconCY);
      ctx.rotate(phi);
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 16]);
      ctx.beginPath();
      ctx.arc(0, 0, iconR + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 4. Subtitle Eyebrow
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(subtitle.toUpperCase(), barX, 114);

      // 5. Main Title
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 12;
      ctx.fillText(title.toUpperCase(), barX, 148);
      ctx.shadowBlur = 0;

      // 6. Status Badge Pill
      if (badge) {
        const titleW = ctx.measureText(title.toUpperCase()).width;
        const badgeText = `${badge.toUpperCase()} >>>`;
        ctx.font = 'bold 11px sans-serif';
        const bTextW = ctx.measureText(badgeText).width;
        const badgeX = Math.min(barX + titleW + 20, 680);
        const badgeY = 132;

        ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY - 14, bTextW + 22, 24, 12);
        ctx.fill();
        ctx.strokeStyle = badgeColor || accentColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = badgeColor || accentColor;
        ctx.fillText(badgeText, badgeX + 11, badgeY + 2);
      }
      ctx.restore();

      // 7. Status Progress Text
      ctx.save();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText(`STATUS PROGRESS: ${clamped}/${total} ${unit.toUpperCase()}`, barX, barY - 10);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'right';
      ctx.fillText(`${pct}%`, barX + barW, barY - 9);
      ctx.restore();

      // 8. The Beveled Electric Plasma Wave Progress Bar
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 13);
      ctx.fillStyle = '#010a0e';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
      ctx.stroke();

      // Clip inside bar
      ctx.clip();

      if (ratio > 0) {
        // Gradient fill
        const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
        fillGrad.addColorStop(0, '#0055ff');
        fillGrad.addColorStop(0.35, '#00d4ff');
        fillGrad.addColorStop(0.75, accentColor);
        fillGrad.addColorStop(1, '#ffffff');

        ctx.fillStyle = fillGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, 13);
        ctx.fill();

        // Dual Multi-Harmonic Oscillating Electric Sine Waves
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let x = barX; x <= barX + fillW; x += 4) {
          const relX = x - barX;
          const y = barY + barH / 2 + Math.sin(relX * 0.05 + phi) * 5.5 + Math.cos(relX * 0.02 - phi) * 2;
          if (x === barX) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.lineWidth = 1.8;
        ctx.strokeStyle = 'rgba(0, 230, 255, 0.85)';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = barX; x <= barX + fillW; x += 4) {
          const relX = x - barX;
          const y = barY + barH / 2 + Math.cos(relX * 0.04 - phi * 1.5) * 4.5;
          if (x === barX) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // 9. Pulsing Plasma Head Orb & Lens Flare
      if (ratio > 0) {
        const headX = barX + fillW;
        const headY = barY + barH / 2;
        const pulseScale = 1 + 0.22 * Math.sin(phi);

        ctx.save();
        const flareGrad = ctx.createRadialGradient(headX, headY, 1, headX, headY, 16 * pulseScale);
        flareGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        flareGrad.addColorStop(0.3, accentColor);
        flareGrad.addColorStop(0.7, 'rgba(0, 212, 255, 0.4)');
        flareGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');

        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(headX, headY, 16 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(headX - 18 * pulseScale, headY);
        ctx.lineTo(headX + 18 * pulseScale, headY);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(headX, headY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 10. Metrics Chips below bar
      const chipList = Array.isArray(metrics) && metrics.length > 0
        ? metrics.slice(0, 3)
        : [
            { label: 'STATUS', value: 'ONLINE' },
            { label: 'CAPACITY', value: `${clamped}/${total}` },
            { label: 'ENGINE', value: 'ATHENA' }
          ];

      let chipX = barX;
      for (const m of chipList) {
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        const labelText = `${m.label}: ${m.value}`;
        const chipW = Math.max(120, ctx.measureText(labelText).width + 24);
        const chipH = 28;

        ctx.fillStyle = 'rgba(1, 24, 16, 0.85)';
        ctx.beginPath();
        ctx.roundRect(chipX, 262, chipW, chipH, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, chipX + 12, 280);
        ctx.restore();

        chipX += chipW + 14;
      }

      // Subtle Watermark
      ctx.save();
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';
      ctx.textAlign = 'right';
      ctx.fillText('ATHENA PRIME // DEFENSE MATRIX', barX + barW, 318);
      ctx.restore();

      const frameBuf = canvas.toBuffer('image/png');
      if (f === 0) firstFrameBuffer = frameBuf;

      if (animated) {
        fs.writeFileSync(path.join(tempDir, `frame_${String(f).padStart(2, '0')}.png`), frameBuf);
      }
    }

    if (!animated) {
      return new AttachmentBuilder(firstFrameBuffer, { name: attachmentName || 'status_banner.png' });
    }

    // 2-pass FFmpeg Palettegen + Paletteuse for highest fidelity looping GIF
    const gifOutPath = path.join(tempDir, 'status.gif');
    const palettePath = path.join(tempDir, 'palette.png');

    const genPaletteCmd = `"${ffmpegPath}" -y -framerate 10 -i "${tempDir}/frame_%02d.png" -vf "palettegen=stats_mode=diff" "${palettePath}"`;
    const encodeGifCmd = `"${ffmpegPath}" -y -framerate 10 -i "${tempDir}/frame_%02d.png" -i "${palettePath}" -lavfi "paletteuse=dither=bayer:bayer_scale=3" "${gifOutPath}"`;

    await execPromise(genPaletteCmd);
    await execPromise(encodeGifCmd);

    const gifBuffer = fs.readFileSync(gifOutPath);
    return new AttachmentBuilder(gifBuffer, { name: attachmentName || 'status_banner.gif' });
  } catch (err) {
    console.error('[CommandStatusBanner] GIF generation error, falling back to static card:', err);
    return new AttachmentBuilder(firstFrameBuffer || createCanvas(W, H).toBuffer('image/png'), { name: 'status_banner.png' });
  } finally {
    if (animated) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
