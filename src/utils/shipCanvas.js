
import { createCanvas, loadImage } from 'canvas';

// Helper to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
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
}

// Helper to draw a heart
function drawHeart(ctx, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const topCurveHeight = h * 0.3;
  ctx.moveTo(0, topCurveHeight);
  ctx.bezierCurveTo(0, 0, -w / 2, 0, -w / 2, topCurveHeight);
  ctx.bezierCurveTo(-w / 2, h / 2, 0, h * 0.7, 0, h);
  ctx.bezierCurveTo(0, h * 0.7, w / 2, h / 2, w / 2, topCurveHeight);
  ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, topCurveHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function generateShipImage(user1, user2, percentage) {
    const width = 1000;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Deep Space / Sci-Fi Background
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/1.2);
    bgGrad.addColorStop(0, '#2a0a2a');
    bgGrad.addColorStop(1, '#050205');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Add some random bokeh particles
    for (let i = 0; i < 40; i++) {
        const bx = Math.random() * width;
        const by = Math.random() * height;
        const br = Math.random() * 4 + 1;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 20, 147, ${Math.random() * 0.3 + 0.1})`;
        ctx.fill();
    }

    // Colors
    const neonPink = '#ff1493';
    const lightPink = '#ff69b4';
    const gold = '#ffd700';

    // 2. Heartbeat Line
    ctx.shadowColor = neonPink;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = lightPink;
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(100, 160);
    ctx.lineTo(400, 160);
    // EKG Spike left
    ctx.lineTo(410, 140);
    ctx.lineTo(420, 180);
    ctx.lineTo(430, 160);
    ctx.lineTo(450, 160);
    // Skip center for heart
    ctx.moveTo(550, 160);
    // EKG Spike right
    ctx.lineTo(570, 160);
    ctx.lineTo(580, 140);
    ctx.lineTo(590, 180);
    ctx.lineTo(600, 160);
    ctx.lineTo(900, 160);
    ctx.stroke();
    
    // Draw Center Neon Heart
    ctx.shadowColor = neonPink;
    ctx.shadowBlur = 25;
    ctx.fillStyle = lightPink;
    drawHeart(ctx, 500, 120, 80, 80);
    // Inner bright heart
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    drawHeart(ctx, 500, 130, 40, 40);
    ctx.shadowBlur = 0;

    // 3. Avatars & Neon Rings
    const avRadius = 90;
    const av1X = 220;
    const av1Y = 160;
    const av2X = 780;
    const av2Y = 160;

    // Outer Glow Rings
    ctx.shadowColor = neonPink;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = neonPink;
    ctx.lineWidth = 12;
    
    ctx.beginPath();
    ctx.arc(av1X, av1Y, avRadius + 5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(av2X, av2Y, avRadius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner bright rings
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(av1X, av1Y, avRadius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(av2X, av2Y, avRadius + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Draw Avatar 1
    try {
        const av1 = await loadImage(user1.avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(av1X, av1Y, avRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(av1, av1X - avRadius, av1Y - avRadius, avRadius * 2, avRadius * 2);
        ctx.restore();
    } catch (e) {}

    // Draw Avatar 2
    try {
        const av2 = await loadImage(user2.avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(av2X, av2Y, avRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(av2, av2X - avRadius, av2Y - avRadius, avRadius * 2, avRadius * 2);
        ctx.restore();
    } catch (e) {}

    // 4. Name Plates
    const drawNamePlate = (name, cx, cy) => {
        ctx.font = 'bold 22px "Arial Black", Impact, sans-serif';
        const metrics = ctx.measureText(name);
        const nw = metrics.width + 60;
        const nh = 40;
        
        ctx.shadowColor = gold;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#111';
        ctx.strokeStyle = gold;
        ctx.lineWidth = 2;
        
        roundRect(ctx, cx - nw/2, cy - nh/2, nw, nh, 20);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(name, cx, cy + 8);
    };

    let n1 = user1.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User 1';
    let n2 = user2.username.replace(/[^\x00-\x7F]/g, '').trim() || 'User 2';
    if(n1.length > 15) n1 = n1.substring(0,15) + '...';
    if(n2.length > 15) n2 = n2.substring(0,15) + '...';
    
    drawNamePlate(n1, av1X, 290);
    drawNamePlate(n2, av2X, 290);

    // 5. Progress Bar
    const barW = 500;
    const barH = 30;
    const barX = width/2 - barW/2;
    const barY = 350;

    // Bar BG
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    roundRect(ctx, barX, barY, barW, barH, 15);
    ctx.fill();
    ctx.stroke();

    // Bar Fill
    const fillW = Math.max(20, (percentage / 100) * barW);
    
    const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
    fillGrad.addColorStop(0, '#ff1493');
    fillGrad.addColorStop(1, '#ff69b4');
    
    ctx.shadowColor = neonPink;
    ctx.shadowBlur = 20;
    ctx.fillStyle = fillGrad;
    roundRect(ctx, barX, barY, fillW, barH, 15);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Progress Knob (White circle at end of fill)
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(barX + fillW - 10, barY + barH/2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Percentage Text inside Bar
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${percentage}% MATCH`, width/2, barY + 22);

    // 6. Match Status Text
    let title = 'Good Match!';
    if (percentage <= 20) title = 'Terrible Match!';
    else if (percentage <= 40) title = 'Poor Match';
    else if (percentage <= 60) title = 'Fair Match';
    else if (percentage <= 80) title = 'Good Match!';
    else title = 'Perfect Match!';

    let subtitle = '[ MATCH STATUS ]';
    if (percentage > 80) subtitle = '[ TRUE LOVE MATCH ]';
    else if (percentage > 60) subtitle = '[ HIGH MATCH ]';
    else if (percentage > 40) subtitle = '[ MODERATE MATCH ]';
    else subtitle = '[ LOW MATCH ]';

    ctx.shadowColor = neonPink;
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 50px "Arial Black", sans-serif';
    ctx.fillText(title, width/2, 430);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.letterSpacing = '2px'; // polyfill
    ctx.fillText(subtitle, width/2, 460);
    
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText('ATHENA PRIME - RELATIONSHIP STATUS', width/2, 485);

    return canvas.toBuffer('image/png');
}

export { generateShipImage };
