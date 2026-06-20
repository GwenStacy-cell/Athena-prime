import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

// Pre-load common settings
const CARD_WIDTH = 900;
const CARD_HEIGHT = 250;
const RADIUS = 20;

export async function generateRankCard(member, xp, level, rank, requiredXp) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2b2d31'; // Discord dark background
  ctx.beginPath();
  ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, RADIUS);
  ctx.fill();

  // Draw Avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarUrl).catch(() => null);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 45, 45, 160, 160);
    ctx.restore();
  }

  // Draw Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  let displayName = member.displayName.replace(/[^\x00-\x7F]/g, '').trim() || member.user.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User';
  if (displayName.length > 15) displayName = displayName.substring(0, 15) + '...';
  ctx.fillText(displayName, 240, 110);

  // Draw Ranks
  ctx.fillStyle = '#b9bbbe';
  ctx.font = '24px sans-serif';
  ctx.fillText(`Rank #${rank}`, 240, 150);

  ctx.fillStyle = '#5865F2'; // Discord Blurple
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`Level ${level}`, CARD_WIDTH - 200, 110);

  // Draw XP Bar Background
  const barX = 240;
  const barY = 170;
  const barWidth = 600;
  const barHeight = 30;
  
  ctx.fillStyle = '#404249';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, 15);
  ctx.fill();

  // Draw XP Bar Fill
  // Calculate previous level required XP
  let prevXp = 0;
  if (level > 0) {
    // We can't import calculateXpForLevel easily without circular dep or passing it
    // For visual purposes we'll pass requiredXp
  }
  
  // Since we don't know the base easily, let's just make the progress bar based on total required XP.
  // We'll pass the progress ratio directly from the command.
  const progressRatio = Math.min(xp / requiredXp, 1);
  const fillWidth = barWidth * progressRatio;

  if (fillWidth > 0) {
    ctx.fillStyle = '#5865F2';
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillWidth, barHeight, 15);
    ctx.fill();
  }

  // XP Text
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${xp} / ${requiredXp} XP`, barX + barWidth - 10, barY + 22);

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
