import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

// Pre-load common settings
const CARD_WIDTH = 900;
const CARD_HEIGHT = 250;
const RADIUS = 20;

export async function generateRankCard(member, xp, level, rank, requiredXp) {
  const canvas = createCanvas(900, 250);
  const ctx = canvas.getContext('2d');

  // Background Base
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(0, 0, 900, 250);

  // Deep Metallic Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 250);
  bgGrad.addColorStop(0, '#1a1a1c');
  bgGrad.addColorStop(1, '#050505');
  ctx.fillStyle = bgGrad;
  
  // Create Main Outer Shape with large aggressive angled cuts
  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(860, 10);
  ctx.lineTo(890, 40);
  ctx.lineTo(890, 210);
  ctx.lineTo(860, 240);
  ctx.lineTo(40, 240);
  ctx.lineTo(10, 210);
  ctx.lineTo(10, 40);
  ctx.closePath();
  ctx.fill();

  // Golden Outer Border
  const borderGrad = ctx.createLinearGradient(0, 0, 900, 250);
  borderGrad.addColorStop(0, '#ffd700');
  borderGrad.addColorStop(0.5, '#444');
  borderGrad.addColorStop(1, '#ff8c00');
  ctx.lineWidth = 4;
  ctx.strokeStyle = borderGrad;
  ctx.stroke();

  // Inner Metallic Panels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.moveTo(300, 10);
  ctx.lineTo(860, 10);
  ctx.lineTo(890, 40);
  ctx.lineTo(890, 80);
  ctx.lineTo(300, 80);
  ctx.closePath();
  ctx.fill();

  // Top Right Tech Accents (Hash lines)
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  for(let i=0; i<4; i++) {
    ctx.beginPath();
    ctx.moveTo(820 + (i*15), 15);
    ctx.lineTo(805 + (i*15), 30);
    ctx.stroke();
  }

  // Draw Avatar
  const avatarX = 150;
  const avatarY = 125;
  const avatarRadius = 85;

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

  // Double Avatar Ring (Gold and Dark)
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  // Broken tech ring
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 14, -Math.PI/4, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 14, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();

  // Draw Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px "Arial Black", Impact, sans-serif';
  let displayName = member.displayName.replace(/[^\x00-\x7F]/g, '').trim() || member.user.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User';
  if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';
  
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(displayName.toUpperCase(), 300, 105);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw Rank
  ctx.fillStyle = '#999999';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Rank #${rank}`, 305, 140);

  // Level Badge (Angled polygon on right)
  const badgeX = 660;
  const badgeY = 60;
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  
  ctx.beginPath();
  ctx.moveTo(badgeX, badgeY + 20);
  ctx.lineTo(badgeX + 30, badgeY);
  ctx.lineTo(870, badgeY);
  ctx.lineTo(870, badgeY + 60);
  ctx.lineTo(badgeX + 30, badgeY + 60);
  ctx.lineTo(badgeX, badgeY + 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Crown Icon (Simple poly drawing)
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(badgeX + 25, badgeY + 20);
  ctx.lineTo(badgeX + 35, badgeY + 35);
  ctx.lineTo(badgeX + 40, badgeY + 20);
  ctx.lineTo(badgeX + 45, badgeY + 35);
  ctx.lineTo(badgeX + 55, badgeY + 20);
  ctx.lineTo(badgeX + 50, badgeY + 45);
  ctx.lineTo(badgeX + 30, badgeY + 45);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('Level', badgeX + 70, badgeY + 40);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(`${level}`, badgeX + 160, badgeY + 44);

  // Glowing XP Bar
  const barX = 300;
  const barY = 175;
  const barW = 550;
  const barH = 30;

  // Background
  ctx.fillStyle = '#151515';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 15);
  ctx.fill();
  ctx.stroke();

  let prevXp = 0;
  if (level > 0) {
    prevXp = 100 * Math.pow(level, 2) + 100 * level;
  }
  const relativeXp = Math.max(0, xp - prevXp);
  const relativeRequired = requiredXp - prevXp;
  const progressRatio = Math.min(relativeXp / relativeRequired, 1);
  const fillWidth = barW * progressRatio;

  if (fillWidth > 15) {
    const xpGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
    xpGrad.addColorStop(0, '#ffaa00');
    xpGrad.addColorStop(0.8, '#ffee55');
    xpGrad.addColorStop(1, '#ffffff'); // Glowing hot tip

    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 15;
    ctx.fillStyle = xpGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillWidth, barH, 15);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Slanted shine hash marks on the XP bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(barX + fillWidth - 30, barY);
    ctx.lineTo(barX + fillWidth - 15, barY);
    ctx.lineTo(barX + fillWidth - 25, barY + barH);
    ctx.lineTo(barX + fillWidth - 40, barY + barH);
    ctx.closePath();
    ctx.fill();
  }

  // XP Text (inside the bar on the right side)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(`${xp} / ${requiredXp} XP`, barX + barW - 15, barY + 21);
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
