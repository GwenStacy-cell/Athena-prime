import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';

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

export async function generateRankCard(member, xp, level, rank, requiredXp) {
  const W = 960;
  const H = 255;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ─── BACKGROUND ────────────────────────────────────────────────────────────
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
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(165,20,20,0.9)';
    ctx.lineWidth = 3;
    rrPath(ctx, 2, 2, W - 4, H - 4, 14);
    ctx.stroke();
  }

  // ─── AVATAR ────────────────────────────────────────────────────────────────
  const avatarCX = 127;
  const avatarCY = 127;
  const avatarR  = 75;  // avatar clip radius
  const ringR    = 88;  // outer ring radius

  // Outer red glow halo
  const halo = ctx.createRadialGradient(avatarCX, avatarCY, ringR - 4, avatarCX, avatarCY, ringR + 18);
  halo.addColorStop(0, 'rgba(200, 30, 30, 0.50)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR + 18, 0, Math.PI * 2);
  ctx.fill();

  // Stone/chain ring — dark outer + bright red inner
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(70, 6, 6, 1)';
  ctx.lineWidth = 16;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(190, 25, 25, 1)';
  ctx.lineWidth = 9;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 90, 90, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw avatar (clipped to circle)
  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl).catch(() => null);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
  }

  // Inner highlight ring
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR + 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(220, 60, 60, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ─── NAME TEXT ─────────────────────────────────────────────────────────────
  const nameX = 242;
  const nameY = 108;

  let rawName = member.displayName.replace(/[^\x00-\x7F]/g, '').trim()
             || member.user.username.replace(/[^\x00-\x7F]/g, '').trim()
             || 'User';
  if (rawName.length > 18) rawName = rawName.substring(0, 18) + '...';
  const upperName = rawName.toUpperCase();

  // Split at first space: "H4VN" (white/stone) + "OWNER" (red bold)
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

  const fontSize = 44;
  const nameFont = `bold ${fontSize}px "Cinzel", "Montserrat", "Roboto", sans-serif`;

  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Part 1 — off-white stone color
  ctx.fillStyle = '#ede8e0';
  ctx.font = nameFont;
  ctx.fillText(part1, nameX, nameY);
  const p1w = ctx.measureText(part1).width;

  if (part2) {
    const gapW = ctx.measureText(' ').width;
    // Part 2 — bold red
    ctx.fillStyle = '#cc1111';
    ctx.font = nameFont;
    ctx.fillText(part2, nameX + p1w + gapW, nameY);
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // ─── RANK ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#999999';
  ctx.font = `bold 22px "Montserrat", "Roboto", sans-serif`;
  ctx.fillText(`Rank #${rank}`, nameX + 2, nameY + 40);

  // ─── LEVEL ─────────────────────────────────────────────────────────────────
  const levelX = 720;
  const levelY = 118;
  ctx.fillStyle = '#d0d0d0';
  ctx.font = `bold 28px "Montserrat", "Roboto", sans-serif`;
  ctx.fillText('Level', levelX, levelY);
  const lvlW = ctx.measureText('Level').width;

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.font = `bold 54px "Cinzel", "Montserrat", "Roboto", sans-serif`;
  ctx.fillText(`${level}`, levelX + lvlW + 12, levelY + 10);
  ctx.shadowBlur = 0;

  // ─── XP PROGRESS BAR ───────────────────────────────────────────────────────
  const barX = nameX;
  const barY = 178;
  const barW = 695;
  const barH = 22;
  const barR = 11;

  // Bar track
  ctx.fillStyle = 'rgba(25, 4, 4, 0.88)';
  rrPath(ctx, barX, barY, barW, barH, barR);
  ctx.fill();

  ctx.strokeStyle = 'rgba(110, 12, 12, 0.75)';
  ctx.lineWidth = 1.5;
  rrPath(ctx, barX, barY, barW, barH, barR);
  ctx.stroke();

  // Compute fill amount
  let prevXp = 0;
  if (level > 0) prevXp = 100 * Math.pow(level, 2) + 100 * level;
  const relXp  = Math.max(0, xp - prevXp);
  const relReq = Math.max(1, requiredXp - prevXp);
  const ratio  = Math.min(relXp / relReq, 1);
  const fillW  = Math.max(barR * 2, barW * ratio);

  // Red gradient fill
  const xpGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
  xpGrad.addColorStop(0,   '#6b0000');
  xpGrad.addColorStop(0.3, '#bb1010');
  xpGrad.addColorStop(0.7, '#dd2020');
  xpGrad.addColorStop(0.9, '#ff4444');
  xpGrad.addColorStop(1,   '#ff6868');

  ctx.shadowColor = 'rgba(220,30,30,0.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = xpGrad;
  rrPath(ctx, barX, barY, fillW, barH, barR);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Glowing tip at progress end
  if (fillW > barR * 2 + 12) {
    const tipGlow = ctx.createRadialGradient(
      barX + fillW, barY + barH / 2, 0,
      barX + fillW, barY + barH / 2, barH
    );
    tipGlow.addColorStop(0, 'rgba(255,110,110,0.65)');
    tipGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tipGlow;
    ctx.fillRect(barX + fillW - barH, barY - 4, barH * 2, barH + 8);
  }

  // ─── XP TEXT ───────────────────────────────────────────────────────────────
  ctx.fillStyle = '#bbbbbb';
  ctx.font = `bold 14px "Montserrat", "Roboto", sans-serif`;
  ctx.textAlign = 'right';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 5;
  ctx.fillText(`${xp.toLocaleString()} / ${requiredXp.toLocaleString()} XP`, barX + barW - 8, barY + 15);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'rank-card.png' });
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
