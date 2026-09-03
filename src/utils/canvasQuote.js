import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
      lines++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  lines++;
  return lines * lineHeight;
}

function calculateTextHeight(ctx, text, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      line = words[n] + ' ';
      lines++;
    } else {
      line = testLine;
    }
  }
  lines++;
  return lines * lineHeight;
}

export async function generateQuoteBuffer(username, avatarUrl, text, timestampStr, theme = 'dark', roleColor = '#FFFFFF') {
  const maxWidth = 800;
  const padding = 30;
  const avatarSize = 60;
  const textX = padding * 2 + avatarSize;
  const textY = padding + 40;
  const maxTextWidth = maxWidth - textX - padding;
  
  // Create a temporary canvas just to measure text
  const tempCanvas = createCanvas(maxWidth, 100);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = '24px sans-serif';
  
  const textHeight = calculateTextHeight(tempCtx, text, maxTextWidth, 32);
  const totalHeight = Math.max(120, padding * 2 + 25 + textHeight);
  
  const canvas = createCanvas(maxWidth, totalHeight);
  const ctx = canvas.getContext('2d');
  
  // Background
  if (theme === 'dark') {
    ctx.fillStyle = '#313338';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (theme === 'light') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (theme === 'transparent') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Load and draw avatar
  try {
    const avatar = await loadImage(avatarUrl.replace('.webp', '.png').replace('.gif', '.png') + '?size=128');
    ctx.save();
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, padding, padding, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    // Fallback if avatar fails to load
    ctx.fillStyle = '#5865F2';
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.fill();
  }
  
  // Username
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = (roleColor && roleColor !== '#000000') ? roleColor : (theme === 'light' ? '#000000' : '#FFFFFF');
  ctx.fillText(username, textX, padding + 22);
  
  // Timestamp
  const usernameWidth = ctx.measureText(username).width;
  ctx.font = '18px sans-serif';
  ctx.fillStyle = theme === 'light' ? '#5c5e66' : '#949ba4';
  ctx.fillText(timestampStr, textX + usernameWidth + 15, padding + 22);
  
  // Text
  ctx.font = '24px sans-serif';
  ctx.fillStyle = theme === 'light' ? '#060607' : '#dbdee1';
  wrapText(ctx, text, textX, textY, maxTextWidth, 32);
  
  return canvas.toBuffer('image/png');
}
