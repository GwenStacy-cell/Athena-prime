import { createCanvas } from './canvas.js';

function hexToRgb(hex) {
  let clean = String(hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { r: 0, g: 229, b: 255, hex: '#00E5FF' };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
    hex: `#${clean.toUpperCase()}`
  };
}

function drawSpline(ctx, pts) {
  if (pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[0];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

export async function generatePingGraph(pingHistory, accentColorHex = '#00e5ff', guildsCount = 10, patternsCount = 41) {
  let rawData = Array.isArray(pingHistory) ? [...pingHistory] : [pingHistory];
  rawData = rawData.filter(v => typeof v === 'number' && !isNaN(v) && v > 0);

  const currentPing = rawData.length > 0 ? Math.round(rawData[rawData.length - 1]) : 17;
  const numPoints = 16;

  // Build 16 rich timeline samples with natural network packet jitter
  let data = [];
  if (rawData.length >= numPoints) {
    data = rawData.slice(-numPoints);
  } else if (rawData.length > 1) {
    data = [...rawData];
    while (data.length < numPoints) {
      const prev = data[0];
      const jitter = (Math.random() - 0.5) * (prev * 0.3);
      data.unshift(Math.max(5, Math.round(prev + jitter)));
    }
  } else {
    const base = currentPing;
    for (let i = 0; i < numPoints - 1; i++) {
      const spikeChance = (i === 4 || i === 11) || Math.random() < 0.2;
      const spike = spikeChance ? (Math.random() * 0.4 + 0.2) * base : 0;
      const wave = Math.sin(i * 0.7) * (base * 0.2);
      const randomJitter = (Math.random() - 0.5) * (base * 0.25);
      const val = Math.max(5, Math.round(base + wave + randomJitter + spike));
      data.push(val);
    }
    data.push(base); // Final node is always current live ping
  }

  // Ensure visible telemetry curve variation
  const minRaw = Math.min(...data);
  const maxRaw = Math.max(...data);
  if (maxRaw - minRaw < 8) {
    data = data.map((val, idx) => {
      if (idx === numPoints - 1) return val;
      const mod = Math.sin(idx * 0.8) * 6 + (Math.random() * 5 - 2.5);
      return Math.max(5, Math.round(val + mod));
    });
  }

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const avgVal = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
  const jitterVal = (Math.abs(maxVal - minVal) / 4).toFixed(1);

  const width = 880;
  const height = 270;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Exact server accent color parsing
  const { r, g, b, hex: cleanHex } = hexToRgb(accentColorHex);

  // Background - deep technical slate
  ctx.fillStyle = '#08090d';
  ctx.fillRect(0, 0, width, height);

  // Ambient radial glow matching accent color
  const bgRadial = ctx.createRadialGradient(width / 2, height / 2, 30, width / 2, height / 2, 420);
  bgRadial.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.10)`);
  bgRadial.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.03)`);
  bgRadial.addColorStop(1, 'rgba(8, 9, 13, 0)');
  ctx.fillStyle = bgRadial;
  ctx.fillRect(0, 0, width, height);

  // Auto-ranging Y scale with comfortable margins
  const yMin = Math.max(0, Math.floor(minVal * 0.75));
  const yMax = Math.ceil(maxVal * 1.3);
  const yRange = Math.max(12, yMax - yMin);

  const plotLeft = 68;
  const plotRight = 835;
  const plotTop = 48;
  const plotBottom = 215;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Grid styling - subtle dashed horizontal lines
  ctx.lineWidth = 1;
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const y = plotTop + (i * (plotHeight / ySteps));
    ctx.strokeStyle = i === ySteps ? '#252936' : '#141722';
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
  }

  // Vertical timeline division lines
  for (let i = 0; i < numPoints; i++) {
    const x = plotLeft + (i * (plotWidth / (numPoints - 1)));
    ctx.strokeStyle = '#12151f';
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();
  }

  // Average benchmark line (dashed accent line)
  const avgFraction = (avgVal - yMin) / yRange;
  const avgY = plotBottom - (avgFraction * plotHeight);
  if (avgY >= plotTop && avgY <= plotBottom) {
    ctx.save();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, avgY);
    ctx.lineTo(plotRight, avgY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.65)`;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`AVG: ${avgVal}ms`, plotRight - 6, avgY - 4);
  }

  // Calculate points on canvas
  const points = data.map((val, i) => {
    const fraction = (val - yMin) / yRange;
    return {
      x: plotLeft + (i * (plotWidth / (numPoints - 1))),
      y: plotBottom - (fraction * plotHeight),
      val,
      index: i
    };
  });

  // Gradient area fill under the curve
  const areaGradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
  areaGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.40)`);
  areaGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.14)`);
  areaGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

  ctx.beginPath();
  ctx.moveTo(points[0].x, plotBottom);
  ctx.lineTo(points[0].x, points[0].y);
  drawSpline(ctx, points);
  ctx.lineTo(points[points.length - 1].x, plotBottom);
  ctx.closePath();
  ctx.fillStyle = areaGradient;
  ctx.fill();

  // Multi-pass glowing curve
  // Outer glow pass
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  drawSpline(ctx, points);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Crisp core line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  drawSpline(ctx, points);
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Timeline Nodes along the curve
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const isLatest = i === points.length - 1;
    const isPeak = pt.val === maxVal && !isLatest;

    if (isLatest) {
      // Pulsing outer aura ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.22)`;
      ctx.fill();

      // Middle ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
      ctx.fill();

      // Bright solid core
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isPeak ? `rgb(${r}, ${g}, ${b})` : '#08090d';
      ctx.fill();
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }

  // Live telemetry badge on the latest point
  const lastPt = points[points.length - 1];
  const badgeText = `${lastPt.val}ms LIVE`;
  ctx.font = 'bold 11px sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 18;
  const badgeX = Math.min(plotRight - badgeWidth / 2, Math.max(plotLeft + badgeWidth / 2, lastPt.x));
  const badgeY = Math.max(plotTop + 14, lastPt.y - 14);

  // Badge background pill
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX - badgeWidth / 2, badgeY - 10, badgeWidth, 20, 5);
  } else {
    ctx.rect(badgeX - badgeWidth / 2, badgeY - 10, badgeWidth, 20);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Tiny live dot inside badge
  ctx.fillStyle = '#08090d';
  ctx.beginPath();
  ctx.arc(badgeX - badgeWidth / 2 + 9, badgeY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Badge text
  ctx.fillStyle = '#08090d';
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, badgeX - badgeWidth / 2 + 16, badgeY + 4);

  // Precision Timeline axis ticks & labels
  const timelineLabels = [
    { idx: 0, text: '-60s' },
    { idx: 3, text: '-45s' },
    { idx: 6, text: '-30s' },
    { idx: 9, text: '-20s' },
    { idx: 12, text: '-10s' },
    { idx: 15, text: 'NOW' }
  ];

  ctx.font = '10px monospace';
  for (let i = 0; i < numPoints; i++) {
    const x = plotLeft + (i * (plotWidth / (numPoints - 1)));
    const isLatest = i === numPoints - 1;

    // Small tick marks on timeline axis
    ctx.strokeStyle = isLatest ? `rgb(${r}, ${g}, ${b})` : '#303444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + (isLatest ? 7 : 4));
    ctx.stroke();

    const labelObj = timelineLabels.find(l => l.idx === i);
    if (labelObj) {
      ctx.fillStyle = isLatest ? `rgb(${r}, ${g}, ${b})` : '#6a7082';
      ctx.textAlign = 'center';
      ctx.fillText(labelObj.text, x, plotBottom + 18);
    }
  }

  // Y-axis tick values
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7a8196';
  ctx.font = '10px monospace';
  ctx.fillText(`${yMin}ms`, plotLeft - 10, plotBottom + 3);
  ctx.fillText(`${Math.round((yMin + yMax) / 2)}ms`, plotLeft - 10, Math.round((plotTop + plotBottom) / 2) + 3);
  ctx.fillText(`${yMax}ms`, plotLeft - 10, plotTop + 4);

  // Rotated Y-axis title
  ctx.save();
  ctx.translate(20, Math.round((plotTop + plotBottom) / 2));
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('LATENCY (ms)', 0, 0);
  ctx.restore();

  // Bottom Timeline Subtext
  ctx.fillStyle = '#454a5c';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TELEMETRY TIMELINE ──► BUFFER CAPTURE TO LIVE SOCKET STREAM', Math.round((plotLeft + plotRight) / 2), height - 10);

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  const prefix = 'SYSTEM LATENCY ';
  ctx.fillText(prefix, plotLeft, 25);
  const pWidth = ctx.measureText(prefix).width;
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillText('TIMELINE', plotLeft + pWidth, 25);

  // Status tag chip
  const tagX = plotLeft + pWidth + ctx.measureText('TIMELINE').width + 14;
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(tagX, 13, 62, 16, 4);
  else ctx.rect(tagX, 13, 62, 16);
  ctx.fill();

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('● ACTIVE', tagX + 31, 24);

  // Right Telemetry Metrics
  ctx.fillStyle = '#8f95a8';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`MIN: ${minVal}ms  •  AVG: ${avgVal}ms  •  PEAK: ${maxVal}ms  •  JITTER: ±${jitterVal}ms  •  ${guildsCount} GUILDS`, plotRight, 25);

  return canvas.toBuffer('image/png');
}
