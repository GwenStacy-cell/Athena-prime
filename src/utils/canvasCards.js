import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

// Pre-load common settings
const CARD_WIDTH = 900;
const CARD_HEIGHT = 250;
const RADIUS = 20;

export async function generateRankCard(member, xp, level, rank, requiredXp) {
  const canvas = createCanvas(990, 430);
  const ctx = canvas.getContext('2d');

  // Load HD Background Template
  try {
      const bg = await loadImage('src/assets/rank_bg.jpg');
      ctx.drawImage(bg, 0, 0, 990, 430);
  } catch (err) {
      console.error('Missing rank_bg.jpg template, falling back to black');
      ctx.fillStyle = '#0f0f0f';
      ctx.fillRect(0, 0, 990, 430);
  }

  // Draw Avatar inside the glowing ring
  const avatarX = 195;
  const avatarY = 220;
  const avatarRadius = 110;

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

  // Draw Name (H4VN OWNER)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px "Arial Black", Impact, sans-serif';
  let displayName = member.displayName.replace(/[^\x00-\x7F]/g, '').trim() || member.user.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User';
  if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';
  
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(displayName.toUpperCase(), 360, 160);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw Rank (#1)
  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`Rank #${rank}`, 365, 210);

  // Draw Level text inside the badge (next to crown)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('Level', 780, 200);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText(`${level}`, 880, 204);

  // Glowing XP Bar Fill
  const barX = 350;
  const barY = 275;
  const barW = 500;
  const barH = 34;

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
    // The bar in the template has rounded ends
    ctx.roundRect(barX, barY, fillWidth, barH, 17);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // XP Text (inside the bar on the right side)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(`${xp} / ${requiredXp} XP`, barX + barW - 15, barY + 23);
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
