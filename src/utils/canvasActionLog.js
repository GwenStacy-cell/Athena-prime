import { createCanvas, loadImage } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

export async function generateGlobalActionCard(opts) {
  const { action, guildName, guildIconUrl, targetTag, targetId, executorName, executorId, reason, timestamp, guildId } = opts;

  const WIDTH = 900;
  const HEIGHT = 450;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Dark theme
  ctx.fillStyle = '#0f1013';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle background glow (top right)
  const gradient = ctx.createRadialGradient(WIDTH, 0, 0, WIDTH, 0, 600);
  gradient.addColorStop(0, '#3a1322'); // dark red/purple tint
  gradient.addColorStop(1, '#0f1013');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Helper for rounded rects
  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // --- TOP SECTION ---
  // Server Icon
  if (guildIconUrl) {
    try {
      const icon = await loadImage(guildIconUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(80, 80, 40, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(icon, 40, 40, 80, 80);
      ctx.restore();
    } catch (e) {
      // Fallback gray circle
      ctx.fillStyle = '#2b2d31';
      ctx.beginPath();
      ctx.arc(80, 80, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#2b2d31';
    ctx.beginPath();
    ctx.arc(80, 80, 40, 0, Math.PI * 2);
    ctx.fill();
  }

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`GLOBAL ${action} LOG`, 140, 75);

  ctx.fillStyle = '#a3a6aa';
  ctx.font = '18px sans-serif';
  // Truncate guild name if too long
  let displayGuildName = guildName;
  if (displayGuildName.length > 25) displayGuildName = displayGuildName.substring(0, 22) + '...';
  ctx.fillText(`${displayGuildName}  •  Security Enforcer: Athena Prime`, 140, 105);

  // Top Right Pill
  ctx.lineWidth = 1;
  const threatText = action === 'BAN' ? 'CRITICAL THREAT' : 'SECURITY ALERT';
  ctx.font = 'bold 14px sans-serif';
  const threatWidth = ctx.measureText(threatText).width + 30;
  roundRect(ctx, WIDTH - threatWidth - 40, 55, threatWidth, 30, 15, 'rgba(255, 50, 50, 0.1)', '#ff3333');
  ctx.fillStyle = '#ff3333';
  ctx.fillText(threatText, WIDTH - threatWidth - 40 + 15, 75);

  // --- MIDDLE BOX ---
  const boxX = 40;
  const boxY = 150;
  const boxW = WIDTH - 80;
  const boxH = 200;
  
  // Inner box background
  roundRect(ctx, boxX, boxY, boxW, boxH, 12, '#16171b', '#2b2d31');

  // Red X Icon
  ctx.fillStyle = '#ff3333';
  ctx.beginPath();
  ctx.arc(boxX + 30, boxY + 35, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('X', boxX + 24, boxY + 41);

  // Box Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`MEMBER ${action}NED`, boxX + 55, boxY + 42);

  // Right Pill
  const actionPillText = `HARD ${action}NED`;
  ctx.font = 'bold 12px sans-serif';
  const actW = ctx.measureText(actionPillText).width + 20;
  roundRect(ctx, boxX + boxW - actW - 20, boxY + 25, actW, 24, 6, 'rgba(255, 50, 50, 0.1)', '#ff3333');
  ctx.fillStyle = '#ff3333';
  ctx.fillText(actionPillText, boxX + boxW - actW - 10, boxY + 42);

  // Data Columns
  const leftCol = boxX + 20;
  const rightCol = boxX + 450;
  let currentY = boxY + 90;
  const lineSpacing = 30;

  ctx.font = 'bold 16px sans-serif';
  
  // Row 1
  ctx.fillStyle = '#a3a6aa';
  ctx.fillText('Executor: ', leftCol, currentY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(executorName, leftCol + 80, currentY);

  ctx.fillStyle = '#a3a6aa';
  ctx.fillText('Target: ', rightCol, currentY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(targetTag, rightCol + 65, currentY);
  currentY += lineSpacing;

  // Row 2
  ctx.fillStyle = '#a3a6aa';
  ctx.fillText('User ID: ', leftCol, currentY);
  ctx.fillStyle = '#5865F2'; // Blurple
  ctx.fillText(executorId, leftCol + 75, currentY);

  ctx.fillStyle = '#a3a6aa';
  ctx.fillText('Target ID: ', rightCol, currentY);
  ctx.fillStyle = '#5865F2'; // Blurple
  ctx.fillText(targetId, rightCol + 85, currentY);
  currentY += lineSpacing;

  // Row 3
  ctx.fillStyle = '#a3a6aa';
  ctx.fillText('Reason: ', leftCol, currentY);
  ctx.fillStyle = '#ff4444'; // Red reason
  // Truncate reason
  let displayReason = reason;
  if (displayReason.length > 70) displayReason = displayReason.substring(0, 67) + '...';
  ctx.fillText(displayReason, leftCol + 70, currentY);
  currentY += lineSpacing;

  // Row 4
  ctx.fillStyle = '#6b6e73';
  ctx.fillText(`Recorded: ${timestamp}`, leftCol, currentY);

  // --- FOOTER ---
  ctx.fillStyle = '#6b6e73';
  ctx.font = '12px sans-serif';
  ctx.fillText('ATHENA PRIME GLOBAL ANTINUKE \u2022 CROSS-SERVER ACTION MONITOR', 40, HEIGHT - 30);
  
  const serverIdText = `Server ID: ${guildId}`;
  const sW = ctx.measureText(serverIdText).width;
  ctx.fillText(serverIdText, WIDTH - sW - 40, HEIGHT - 30);

  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'action-log.png' });
}
