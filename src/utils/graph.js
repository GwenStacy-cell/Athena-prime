import { createCanvas } from 'canvas';
import fs from 'fs';

export async function generatePingGraph(pingValue, accentColorHex, guildsCount = 10, patternsCount = 41) {
  // We'll generate 10 data points for the ping history. 
  // We'll simulate previous pings jittering around the current ping.
  const data = [];
  for(let i=0; i<9; i++) {
     data.push(Math.max(10, pingValue + (Math.random() * 40 - 20)));
  }
  data.push(pingValue);

  const width = 800;
  const height = 250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  // Parse accent color
  let accent = accentColorHex || '#00ffff';
  if(accent.startsWith('#')) accent = accent.substring(1);
  const [r, g, b] = [
    parseInt(accent.substring(0, 2), 16),
    parseInt(accent.substring(2, 4), 16),
    parseInt(accent.substring(4, 6), 16)
  ];

  // Grid
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i=0; i<=10; i++) {
    const x = 50 + (i * 70);
    ctx.moveTo(x, 40);
    ctx.lineTo(x, 210);
  }
  for(let i=0; i<=4; i++) {
    const y = 40 + (i * 42.5);
    ctx.moveTo(50, y);
    ctx.lineTo(750, y);
  }
  ctx.stroke();

  // Axes
  ctx.strokeStyle = '#333333';
  ctx.beginPath();
  ctx.moveTo(50, 40);
  ctx.lineTo(50, 210);
  ctx.lineTo(750, 210);
  ctx.stroke();

  // Draw points
  const points = data.map((val, i) => {
    return {
      x: 70 + (i * (660 / 9)),
      y: 200 - ((val / Math.max(...data, 100)) * 150)
    };
  });

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 40, 0, 210);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

  ctx.beginPath();
  ctx.moveTo(points[0].x, 210);
  ctx.lineTo(points[0].x, points[0].y);
  
  // Curve
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.lineTo(points[points.length - 1].x, 210);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
  ctx.shadowBlur = 10;
  ctx.stroke();
  
  // Reset shadow for points
  ctx.shadowBlur = 0;

  // Nodes
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for(const pt of points) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Text labels
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  for(let i=0; i<10; i++) {
    ctx.fillText((i+1).toString(), 70 + (i * (660 / 9)), 225);
  }
  
  ctx.textAlign = 'right';
  ctx.fillText('0', 40, 210);
  ctx.fillText(Math.round(Math.max(...data)/2).toString(), 40, 130);
  ctx.fillText(Math.round(Math.max(...data)).toString(), 40, 50);

  // Titles
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  const title1 = 'SYSTEM LATENCY ';
  ctx.fillText(title1, 50, 25);
  
  const titleWidth = ctx.measureText(title1).width;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillText('HISTORY', 50 + titleWidth, 25);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${patternsCount} patterns  •  ${guildsCount} guilds  •  cache 10`, 750, 25);

  ctx.save();
  ctx.translate(20, 130);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.textAlign = 'center';
  ctx.font = '12px sans-serif';
  ctx.fillText('Pattern Count', 0, 0);
  ctx.restore();
  
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.font = '12px sans-serif';
  ctx.fillText('Confidence Levels', 400, 245);

  return canvas.toBuffer('image/png');
}
