import { createCanvas, loadImage } from 'canvas';

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function generateShipImage(user1, user2, percentage) {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const bgGradient = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, 400);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for(let i=0; i<50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    let mainColor, title, subText;
    if (percentage <= 20) {
        mainColor = '#ff4d4d'; title = 'Terrible Match'; subText = '[ RISK ZONE ]';
    } else if (percentage <= 40) {
        mainColor = '#ff9933'; title = 'Poor Match'; subText = '[ LOW COMPATIBILITY ]';
    } else if (percentage <= 60) {
        mainColor = '#ffcc00'; title = 'Fair Match'; subText = '[ AVERAGE ]';
    } else if (percentage <= 80) {
        mainColor = '#ff66b2'; title = 'Good Match!'; subText = '[ HIGH MATCH ]';
    } else {
        mainColor = '#ff0066'; title = 'Perfect Match!'; subText = '[ SOULMATES ]';
    }

    ctx.beginPath();
    ctx.moveTo(250, 180);
    ctx.lineTo(550, 180);
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(400, 165);
    if (percentage <= 40) {
        drawBrokenHeart(ctx, 25, mainColor);
    } else {
        drawHeart(ctx, 25, mainColor);
    }
    ctx.restore();

    const avatarRadius = 60;
    await drawAvatar(ctx, user1.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0.png', 200, 180, avatarRadius, mainColor);
    await drawAvatar(ctx, user2.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0.png', 600, 180, avatarRadius, mainColor);

    drawUsername(ctx, user1.username, 200, 270);
    drawUsername(ctx, user2.username, 600, 270);

    const barWidth = 400;
    const barHeight = 20;
    const barX = 200;
    const barY = 300;
    const fillWidth = (percentage / 100) * barWidth;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, barX, barY, barWidth, barHeight, 10);
    ctx.fill();

    ctx.fillStyle = mainColor;
    roundRect(ctx, barX, barY, fillWidth, barHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(barX + fillWidth, barY + barHeight/2, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Arial"';
    ctx.textAlign = 'center';
    ctx.fillText(`${percentage}% MATCH`, barX + barWidth/2, barY + 14);

    ctx.fillStyle = mainColor;
    ctx.font = 'bold 24px "Arial"';
    ctx.fillText(title, 400, 350);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px "Arial"';
    ctx.fillText(subText, 400, 370);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '8px "Arial"';
    ctx.fillText('ATHENA PRIME - RELATIONSHIP STATUS', 400, 390);

    ctx.fillText('[ LOVE COMPATIBILITY MATRIX ]', 400, 30);

    return canvas.toBuffer();
}

async function drawAvatar(ctx, url, x, y, radius, borderColor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    try {
        const img = await loadImage(url);
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
    } catch(e) {}
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawUsername(ctx, text, x, y) {
    ctx.font = 'bold 12px "Arial"';
    ctx.textAlign = 'center';
    const textWidth = ctx.measureText(text).width;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, x - (textWidth/2) - 10, y - 12, textWidth + 20, 20, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y + 3);
}

function drawHeart(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(0, topCurveHeight);
    ctx.bezierCurveTo(0, 0, -size, 0, -size, topCurveHeight);
    ctx.bezierCurveTo(-size, size * 0.7, 0, size * 0.8, 0, size);
    ctx.bezierCurveTo(0, size * 0.8, size, size * 0.7, size, topCurveHeight);
    ctx.bezierCurveTo(size, 0, 0, 0, 0, topCurveHeight);
    ctx.closePath();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBrokenHeart(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(-2, topCurveHeight);
    ctx.bezierCurveTo(-2, 0, -size - 2, 0, -size - 2, topCurveHeight);
    ctx.bezierCurveTo(-size - 2, size * 0.7, -2, size * 0.8, -2, size);
    ctx.lineTo(-5, size * 0.7);
    ctx.lineTo(2, size * 0.5);
    ctx.lineTo(-3, size * 0.3);
    ctx.closePath();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(5, topCurveHeight);
    ctx.lineTo(0, size * 0.3);
    ctx.lineTo(7, size * 0.5);
    ctx.lineTo(0, size * 0.7);
    ctx.lineTo(5, size);
    ctx.bezierCurveTo(5, size * 0.8, size + 5, size * 0.7, size + 5, topCurveHeight);
    ctx.bezierCurveTo(size + 5, 0, 5, 0, 5, topCurveHeight);
    ctx.closePath();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
}

export { generateShipImage };
