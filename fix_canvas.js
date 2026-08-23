import fs from 'fs';
let code = fs.readFileSync('src/utils/statCanvas.js', 'utf8');

const newFunction = `
export async function generateInviteTopImage(guild, topInvites) {
  const ROWS = 10;
  const ROW_H = 46;
  const HEADER_H = 100;
  const SECTION_TITLE_H = 40;
  const BOTTOM_PAD = 30;
  const H = HEADER_H + SECTION_TITLE_H + (Math.min(ROWS, Math.max(topInvites.length, 1)) * ROW_H) + BOTTOM_PAD + 26;
  const W = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const PAD = 18;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ---- HEADER ----
  const ICON_R = 36;
  const ICON_CX = PAD + ICON_R;
  const ICON_CY = PAD + ICON_R + 4;

  if (guild.iconURL()) {
    try {
      const gIcon = await loadImage(guild.iconURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(ICON_CX, ICON_CY, ICON_R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(gIcon, ICON_CX - ICON_R, ICON_CY - ICON_R, ICON_R * 2, ICON_R * 2);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = C.panel;
    ctx.beginPath();
    ctx.arc(ICON_CX, ICON_CY, ICON_R, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = C.white;
  ctx.font = \`600 24px \${FONT_BOLD}\`;
  ctx.fillText("Invite Leaderboard", ICON_CX + ICON_R + 15, ICON_CY - 5);

  ctx.fillStyle = C.gray;
  ctx.font = \`400 15px \${FONT_NORMAL}\`;
  ctx.fillText(guild.name, ICON_CX + ICON_R + 15, ICON_CY + 18);

  const Y_START = HEADER_H + SECTION_TITLE_H;

  ctx.fillStyle = C.white;
  ctx.font = \`600 16px \${FONT_BOLD}\`;
  ctx.fillText("Top Inviters", PAD, HEADER_H + 20);
  
  if (topInvites.length === 0) {
    ctx.fillStyle = C.gray;
    ctx.font = \`400 14px \${FONT_NORMAL}\`;
    ctx.fillText("No invite data found.", PAD, Y_START + 25);
  } else {
    for (let i = 0; i < topInvites.length && i < ROWS; i++) {
      const u = topInvites[i];
      const y = Y_START + (i * ROW_H);

      ctx.fillStyle = C.innerBox;
      ctx.fillRect(PAD, y, W - (PAD * 2), ROW_H - 6);

      // Rank badge
      ctx.fillStyle = C.badge;
      ctx.fillRect(PAD, y, 40, ROW_H - 6);
      ctx.fillStyle = (i === 0) ? '#F1C40F' : (i === 1) ? '#E67E22' : (i === 2) ? '#95A5A6' : C.white;
      ctx.font = \`600 14px \${FONT_BOLD}\`;
      ctx.textAlign = 'center';
      ctx.fillText(\`#\${i + 1}\`, PAD + 20, y + 25);
      ctx.textAlign = 'left';

      // Name
      ctx.fillStyle = C.white;
      ctx.font = \`500 14px \${FONT_NORMAL}\`;
      ctx.fillText(u.username, PAD + 55, y + 25);

      // Net Score
      const netText = \`\${u.net} Invites\`;
      ctx.font = \`600 14px \${FONT_BOLD}\`;
      const netW = ctx.measureText(netText).width;
      
      const statX = W - PAD - netW - 10;
      ctx.fillStyle = C.green;
      ctx.fillText(netText, statX, y + 25);
    }
  }

  // Footer
  ctx.fillStyle = C.muted;
  ctx.font = \`400 12px \${FONT_NORMAL}\`;
  ctx.textAlign = 'center';
  ctx.fillText("Data powered by Athena Prime Stats Engine", W / 2, H - 15);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}
`;

code = code + "\n" + newFunction;
fs.writeFileSync('src/utils/statCanvas.js', code);
