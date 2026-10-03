import { createCanvas, loadImage } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

export async function generateGlobalActionCard(opts) {
  const { action, guildName, guildIconUrl, targetTag, targetId, executorName, executorId, reason, timestamp, guildId } = opts;

  const WIDTH = 900;
  const HEIGHT = 400; // slightly shorter for a sleeker look
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Very dark modern theme
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Determine glow color based on action
  let accentColor = '#3a1818'; // default red
  if (action === 'KICK') accentColor = '#3a2518'; // orange
  if (action === 'WARN' || action === 'TIMEOUT') accentColor = '#3a3618'; // yellow

  // Subtle background glow (top right)
  const gradient = ctx.createRadialGradient(WIDTH - 100, -100, 0, WIDTH - 100, -100, 700);
  gradient.addColorStop(0, accentColor); 
  gradient.addColorStop(1, '#0b0d10');
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
      ctx.fillStyle = '#1e1f24';
      ctx.beginPath();
      ctx.arc(80, 80, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#1e1f24';
    ctx.beginPath();
    ctx.arc(80, 80, 40, 0, Math.PI * 2);
    ctx.fill();
  }

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`GLOBAL ${action} LOG`, 140, 75);

  ctx.fillStyle = '#8b929a';
  ctx.font = '500 18px "Segoe UI", Arial, sans-serif';
  let displayGuildName = guildName;
  if (displayGuildName.length > 25) displayGuildName = displayGuildName.substring(0, 22) + '...';
  ctx.fillText(`${displayGuildName}  •  Security Enforcer: Athena Prime`, 140, 105);

  // Top Right Pill
  ctx.lineWidth = 1.5;
  const threatText = action === 'BAN' ? 'CRITICAL THREAT' : 'SECURITY ALERT';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  const threatWidth = ctx.measureText(threatText).width + 30;
  roundRect(ctx, WIDTH - threatWidth - 40, 55, threatWidth, 28, 14, 'rgba(237, 66, 69, 0.1)', '#ed4245');
  ctx.fillStyle = '#ed4245';
  ctx.fillText(threatText, WIDTH - threatWidth - 40 + 15, 74);

  // --- MIDDLE BOX ---
  const boxX = 40;
  const boxY = 150;
  const boxW = WIDTH - 80;
  const boxH = 170;
  
  // Inner box background
  roundRect(ctx, boxX, boxY, boxW, boxH, 12, '#141519', '#24252a');

  // Box Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`MEMBER ${action}NED`, boxX + 30, boxY + 40);

  // Right Pill
  const actionPillText = `HARD ${action}NED`;
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  const actW = ctx.measureText(actionPillText).width + 20;
  roundRect(ctx, boxX + boxW - actW - 20, boxY + 22, actW, 24, 6, 'rgba(237, 66, 69, 0.15)', 'transparent');
  ctx.fillStyle = '#ed4245';
  ctx.fillText(actionPillText, boxX + boxW - actW - 10, boxY + 39);

  // Divider Line
  ctx.fillStyle = '#24252a';
  ctx.fillRect(boxX + 30, boxY + 60, boxW - 60, 2);

  // Data Columns
  const leftCol = boxX + 30;
  const rightCol = boxX + 420;
  let currentY = boxY + 95;
  const lineSpacing = 32;

  ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
  
  // Row 1
  ctx.fillStyle = '#8b929a';
  ctx.fillText('Executor: ', leftCol, currentY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(executorName, leftCol + 70, currentY);

  ctx.fillStyle = '#8b929a';
  ctx.fillText('Target: ', rightCol, currentY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(targetTag, rightCol + 55, currentY);
  currentY += lineSpacing;

  // Row 2
  ctx.fillStyle = '#8b929a';
  ctx.fillText('User ID: ', leftCol, currentY);
  ctx.fillStyle = '#5865F2'; 
  ctx.fillText(executorId, leftCol + 65, currentY);

  ctx.fillStyle = '#8b929a';
  ctx.fillText('Target ID: ', rightCol, currentY);
  ctx.fillStyle = '#5865F2'; 
  ctx.fillText(targetId, rightCol + 75, currentY);
  currentY += lineSpacing;

  // Row 3
  ctx.fillStyle = '#8b929a';
  ctx.fillText('Reason: ', leftCol, currentY);
  ctx.fillStyle = '#ed4245'; 
  let displayReason = reason;
  if (displayReason.length > 70) displayReason = displayReason.substring(0, 67) + '...';
  ctx.fillText(displayReason, leftCol + 60, currentY);

  // --- FOOTER ---
  ctx.fillStyle = '#4f545c';
  ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ATHENA PRIME GLOBAL ANTINUKE \u2022 CROSS-SERVER ACTION MONITOR', 40, HEIGHT - 25);
  
  const serverIdText = `Server ID: ${guildId}`;
  const sW = ctx.measureText(serverIdText).width;
  ctx.fillText(serverIdText, WIDTH - sW - 40, HEIGHT - 25);

  return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'action-log.png' });
}
