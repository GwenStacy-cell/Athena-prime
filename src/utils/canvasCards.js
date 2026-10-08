import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

// Pre-load common settings
const CARD_WIDTH = 900;
const CARD_HEIGHT = 250;
const RADIUS = 20;

export async function generateRankCard(member, xp, level, rank, requiredXp) {
  const canvas = createCanvas(900, 250);
  const ctx = canvas.getContext('2d');

  // Sci-fi / Golden Rank Card Design
  // 1. Background Polygon
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 900, 250);
  
  // Outer frame gradient
  const frameGrad = ctx.createLinearGradient(0, 0, 900, 250);
  frameGrad.addColorStop(0, '#ffd700'); // Gold
  frameGrad.addColorStop(0.5, '#2a2a2a');
  frameGrad.addColorStop(1, '#ff8c00'); // Dark Gold/Orange
  
  ctx.lineWidth = 4;
  ctx.strokeStyle = frameGrad;
  
  // Draw an angled sci-fi border
  ctx.beginPath();
  ctx.moveTo(30, 10);
  ctx.lineTo(870, 10);
  ctx.lineTo(890, 30);
  ctx.lineTo(890, 220);
  ctx.lineTo(870, 240);
  ctx.lineTo(30, 240);
  ctx.lineTo(10, 220);
  ctx.lineTo(10, 30);
  ctx.closePath();
  
  // Fill background
  const bgGrad = ctx.createLinearGradient(0, 0, 900, 250);
  bgGrad.addColorStop(0, '#1a1a1a');
  bgGrad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bgGrad;
  ctx.fill();
  ctx.stroke();

  // Glow settings for avatar ring
  const avatarX = 140;
  const avatarY = 125;
  const avatarRadius = 85;

  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#ffb300';
  ctx.lineWidth = 6;

  // Outer glowing ring
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 10, 0, Math.PI * 2);
  ctx.stroke();

  // Reset shadow for clipping
  ctx.shadowBlur = 0;

  // Draw Avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl).catch(() => null);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();
  }

  // Text gradient for Name
  const nameGrad = ctx.createLinearGradient(280, 70, 280, 110);
  nameGrad.addColorStop(0, '#ffffff');
  nameGrad.addColorStop(1, '#ffd700');

  ctx.fillStyle = nameGrad;
  ctx.font = 'bold 46px "Arial Black", Impact, sans-serif';
  let displayName = member.displayName.replace(/[^\x00-\x7F]/g, '').trim() || member.user.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User';
  if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';
  
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(displayName.toUpperCase(), 270, 110);
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Rank text
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '26px sans-serif';
  ctx.fillText(`Rank #${rank}`, 275, 145);

  // Level Badge (Sci-fi polygon on the right)
  const badgeX = 650;
  const badgeY = 70;
  
  ctx.fillStyle = '#151515';
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(badgeX, badgeY + 15);
  ctx.lineTo(badgeX + 30, badgeY - 15);
  ctx.lineTo(850, badgeY - 15);
  ctx.lineTo(870, badgeY + 15);
  ctx.lineTo(870, badgeY + 45);
  ctx.lineTo(850, badgeY + 75);
  ctx.lineTo(badgeX + 30, badgeY + 75);
  ctx.lineTo(badgeX, badgeY + 45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('Level', badgeX + 40, badgeY + 40);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(`${level}`, badgeX + 130, badgeY + 44);

  // XP Bar Outline
  const barX = 270;
  const barY = 175;
  const barWidth = 570;
  const barHeight = 28;
  
  ctx.fillStyle = '#111111';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, 14);
  ctx.fill();
  ctx.stroke();

  let prevXp = 0;
  if (level > 0) {
    prevXp = 100 * Math.pow(level, 2) + 100 * level;
  }
  const relativeXp = Math.max(0, xp - prevXp);
  const relativeRequired = requiredXp - prevXp;
  const progressRatio = Math.min(relativeXp / relativeRequired, 1);
  const fillWidth = barWidth * progressRatio;

  if (fillWidth > 10) {
    const xpGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
    xpGrad.addColorStop(0, '#ffaa00');
    xpGrad.addColorStop(1, '#ffee55');

    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 15;
    ctx.fillStyle = xpGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillWidth, barHeight, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(`${xp} / ${requiredXp} XP`, barX + barWidth - 15, barY + 20);
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
  ctx.roundRect(0, 0, width, height, 20);
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
    const rank = ((page - 1) * 10) + i + 1;
    
    // Rank Number
    ctx.fillStyle = rank <= 3 ? '#FFD700' : '#b9bbbe';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`#${rank}`, 40, yPos + 40);

    // Member Avatar
    try {
      const member = await guild.members.fetch(user.userId).catch(() => null);
      if (member) {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 64 });
        const avatar = await loadImage(avatarUrl).catch(() => null);
        if (avatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(160, yPos + 30, 30, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatar, 130, yPos, 60, 60);
          ctx.restore();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        let dname = member.displayName.replace(/[^\x00-\x7F]/g, '').trim() || member.user.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User';
        if (dname.length > 20) dname = dname.substring(0, 20) + '...';
        ctx.fillText(dname, 210, yPos + 40);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`Unknown User`, 210, yPos + 40);
      }
    } catch {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`Unknown User`, 210, yPos + 40);
    }

    // Level and XP
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
