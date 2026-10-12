/**
 * Generate GOW rank card background
 * Uses the top_gow_template as source art
 */
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

const W = 960;
const H = 255;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

try {
  const topTemplate = await loadImage('src/assets/top_gow_template.png');
  // top_gow_template is 1024x500
  
  ctx.drawImage(topTemplate,
    0, 0, 1024, 155,
    0, 0, W, H
  );

  // Smear/erase the "Top Statistics" trophy text that got scaled in
  // It appears in bottom-center of our output around y=170-215, x=150-330
  // Sample the background color nearby and paint over it with a solid dark patch
  // The bg at that area is very dark near-black
  ctx.fillStyle = 'rgba(8, 5, 5, 0.95)';
  ctx.fillRect(145, 168, 220, 50);

  // Gradient dark overlay on lower portion for the XP bar area
  const bottomDark = ctx.createLinearGradient(0, H * 0.5, 0, H);
  bottomDark.addColorStop(0, 'rgba(0,0,0,0.1)');
  bottomDark.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = bottomDark;
  ctx.fillRect(0, 0, W, H);
  
  // Center darker overlay for text readability 
  const textOverlay = ctx.createLinearGradient(180, 0, W * 0.85, 0);
  textOverlay.addColorStop(0, 'rgba(0,0,0,0)');
  textOverlay.addColorStop(0.1, 'rgba(0,0,0,0.58)');
  textOverlay.addColorStop(0.7, 'rgba(0,0,0,0.52)');
  textOverlay.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = textOverlay;
  ctx.fillRect(0, 0, W, H);
  
  // Red border frame
  ctx.strokeStyle = 'rgba(165, 20, 20, 0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(2, 2, W-4, H-4, 14);
  ctx.stroke();

  // Inner thin secondary border line
  ctx.strokeStyle = 'rgba(100, 0, 0, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(6, 6, W-12, H-12, 10);
  ctx.stroke();
  
  // Bottom left subtle red glow (corner accent)
  const cornerGlow = ctx.createRadialGradient(30, H - 20, 0, 30, H - 20, 80);
  cornerGlow.addColorStop(0, 'rgba(160,20,20,0.4)');
  cornerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cornerGlow;
  ctx.fillRect(0, H-80, 120, 80);

  // Right bottom accent
  const rightCornerGlow = ctx.createRadialGradient(W - 30, H - 20, 0, W - 30, H - 20, 80);
  rightCornerGlow.addColorStop(0, 'rgba(160,20,20,0.35)');
  rightCornerGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightCornerGlow;
  ctx.fillRect(W-120, H-80, 120, 80);

  const buffer = canvas.toBuffer('image/png');
  writeFileSync('src/assets/rank_gow_bg.png', buffer);
  console.log(`Generated rank_gow_bg.png (${buffer.length} bytes)`);

} catch (e) {
  console.error('Error:', e);
  process.exit(1);
}
