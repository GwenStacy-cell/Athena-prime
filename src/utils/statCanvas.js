import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

// ============================================================
// FONT REGISTRATION — Noto Sans covers Latin, CJK, Arabic,
// Cyrillic, symbols (★, 「」, etc.) — prevents tofu boxes.
// Roboto is registered as fallback for pure ASCII text.
// ============================================================
const ASSETS = path.resolve('assets');

function tryRegisterFont(file, opts) {
  const full = path.join(ASSETS, file);
  if (fs.existsSync(full)) {
    try { registerFont(full, opts); } catch (e) { /* ignore */ }
  }
}

// Register in priority order — Noto first (broad Unicode), Roboto fallback
tryRegisterFont('NotoSans-Bold.ttf',    { family: 'NotoSans', weight: 'bold' });
tryRegisterFont('NotoSans-Regular.ttf', { family: 'NotoSans', weight: 'normal' });
tryRegisterFont('NotoSansCJK-Regular.otf', { family: 'NotoSansCJK', weight: 'normal' });
tryRegisterFont('NotoSansMath-Regular.ttf', { family: 'NotoSansMath', weight: 'normal' });
tryRegisterFont('Roboto-Bold.ttf',      { family: 'Roboto', weight: 'bold' });
tryRegisterFont('Roboto-Regular.ttf',   { family: 'Roboto', weight: 'normal' });
tryRegisterFont('fa-solid-900.ttf',     { family: 'FontAwesome', weight: '900' });

// Font stacks: NotoSans handles most Unicode, Math handles math alphanumeric, Roboto is the visual style font, Segoe UI Emoji handles UI icons natively on Windows
const FONT_NORMAL = '"NotoSans", "NotoSansCJK", "NotoSansMath", "Segoe UI Emoji", "Roboto", sans-serif';
const FONT_BOLD   = '"NotoSans", "NotoSansCJK", "NotoSansMath", "Segoe UI Emoji", "Roboto", sans-serif';

// ============================================================
// STATBOT EXACT COLOR PALETTE
// ============================================================
const C = {
  bg:        '#2B2D31',   // Card background (modern Discord gray)
  panel:     '#313338',   // Panel / section background
  innerBox:  '#2B2D31',   // Inner stat row boxes (same as bg = inset feel)
  badge:     '#1E1F22',   // Date badge background (darker)
  white:     '#FFFFFF',
  gray:      '#B5BAC1',   // Secondary text (Discord muted)
  muted:     '#949BA4',   // Footer text
  green:     '#23A559',   // Message line / Powered by (Discord green)
  pink:      '#F47FFF',   // Voice line (lighter pink)
  pinkDim:   '#E83D84',   // Darker pink fallback
  accent:    '#23A559',
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Safe canvas text rendering — handles Unicode without crashing.
 * Strips ONLY unrenderable emoji (color emoji range) but keeps
 * Unicode letters, CJK, symbols (★, 「」, etc.) as Noto renders them.
 */
function safeText(str) {
  if (!str) return '';
  // Remove color emoji (these require special emoji fonts not available)
  // Keep: letters, numbers, CJK, punctuation, symbols like ★「」•
  return str
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{2702}-\u{27B0}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/\uFFFD/g, '')                  // Replacement chars
    .trim();
}

/**
 * Truncate text to fit within maxWidth pixels on given ctx.
 */
function truncateText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function formatNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(2) + 'k';
  return String(num);
}

function formatHours(seconds) {
  if (seconds < 60)     return seconds + ' secs';
  const mins = seconds / 60;
  if (mins < 60)        return mins.toFixed(2) + ' mins';
  return (mins / 60).toFixed(2) + ' hours';
}

function formatHoursShort(seconds) {
  return (seconds / 3600).toFixed(2);
}

/**
 * Draw a rounded rectangle (filled) with optional shadow.
 */
function drawPanel(ctx, x, y, w, h, r = 10, color = C.panel, hasShadow = true) {
  if (hasShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  
  if (hasShadow) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}

/**
 * Draw an inner rounded box (no shadow).
 */
function drawInnerBox(ctx, x, y, w, h, r = 6) {
  drawPanel(ctx, x, y, w, h, r, C.innerBox, false);
}

/**
 * Draw a circular avatar/icon from an image.
 */
async function drawCircularImage(ctx, imageUrl, cx, cy, radius) {
  try {
    const img = await loadImage(imageUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } catch (e) {
    // Fallback: gray circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#36393F';
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Draw a smooth line chart with gradient fill.
 */
function drawLineChart(ctx, data, key, maxVal, chartX, chartY, chartW, chartH, lineColor, gradStart, gradEnd) {
  if (!data || data.length < 2) return;
  const stepX = chartW / (data.length - 1);

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = chartX + i * stepX;
    const y = chartY - (maxVal > 0 ? (d[key] / maxVal) * chartH : 0);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Gradient fill under the line
  const lastX = chartX + (data.length - 1) * stepX;
  ctx.lineTo(lastX, chartY);
  ctx.lineTo(chartX, chartY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, chartY - chartH, 0, chartY);
  grad.addColorStop(0, gradStart);
  grad.addColorStop(1, gradEnd);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ============================================================
// USER STAT CARD — matches Statbot's s?me / s?u output
// ============================================================
export async function generateStatCard(user, member, stats, ranks, topChannels, chartData, guild) {
  const W = 820, H = 460;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Full background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const PAD = 18; // outer padding

  // ---- HEADER SECTION ----
  const AVATAR_R = 44;
  const AVATAR_CX = PAD + AVATAR_R;
  const AVATAR_CY = PAD + AVATAR_R + 4;

  // Avatar
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  await drawCircularImage(ctx, avatarUrl, AVATAR_CX, AVATAR_CY, AVATAR_R);

  // Created On / Joined On badges (top right)
  const createdDate = new Date(user.createdTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const joinedDate  = member ? new Date(member.joinedTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

  const drawBadge = (label, value, bx) => {
    drawPanel(ctx, bx, PAD, 140, 54, 8, C.badge, true);
    ctx.font = `bold 11px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.fillText(label, bx + 12, PAD + 20);
    ctx.font = `14px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.fillText(value, bx + 12, PAD + 40);
  };

  const badge1X = W - PAD - 140 - 10 - 140;
  const badge2X = W - PAD - 140;
  drawBadge('Created On', createdDate, badge1X);
  drawBadge('Joined On', joinedDate, badge2X);

  // Username line: "DisplayName - username" then server name below
  const displayName = safeText(member?.displayName || user.username);
  const userName    = safeText(user.username);

  ctx.font = `bold 28px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  
  // Truncate display name if it's extremely long
  const maxNameSpace = badge1X - (AVATAR_CX + AVATAR_R + 14) - 20;
  let nameText = truncateText(ctx, displayName, maxNameSpace * 0.6);
  ctx.fillText(nameText, AVATAR_CX + AVATAR_R + 14, AVATAR_CY - 10);

  // Username in gray after display name (truncate this too if needed)
  if (displayName !== userName) {
    const nameW = ctx.measureText(nameText).width;
    ctx.font = `16px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    const remainingSpace = maxNameSpace - nameW - 10;
    const truncUserName = truncateText(ctx, `- ${userName}`, remainingSpace);
    ctx.fillText(truncUserName, AVATAR_CX + AVATAR_R + 14 + nameW + 8, AVATAR_CY - 10);
  }

  // Server name + Server Icon below
  const serverName = safeText(guild?.name || '');
  ctx.font = `16px ${FONT_NORMAL}`;
  ctx.fillStyle = C.gray;
  
  // Draw small server icon if available
  const guildIconUrl = guild?.iconURL({ extension: 'png', size: 64 });
  let serverTextX = AVATAR_CX + AVATAR_R + 14;
  if (guildIconUrl) {
    // Increased radius from 10 to 14
    await drawCircularImage(ctx, guildIconUrl, serverTextX + 14, AVATAR_CY + 13, 14);
    serverTextX += 34; // Adjusted offset for larger icon
  }
  ctx.fillText(truncateText(ctx, serverName, maxNameSpace - 34), serverTextX, AVATAR_CY + 18);

  // Separator line
  ctx.fillStyle = '#33363C';
  ctx.fillRect(PAD, AVATAR_CY + AVATAR_R + 14, W - PAD * 2, 1);

  // ---- MIDDLE ROW: Server Ranks | Messages | Voice Activity ----
  const MID_Y = AVATAR_CY + AVATAR_R + 26;
  const MID_H = 148;
  const COL_GAP = 14;
  const COL1_W = 210;
  const COL23_W = (W - PAD * 2 - COL1_W - COL_GAP * 2) / 2;

  // --- Server Ranks panel ---
  drawPanel(ctx, PAD, MID_Y, COL1_W, MID_H);

  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Server Ranks', PAD + 14, MID_Y + 26);
  // Trophy icon (FontAwesome)
  ctx.font = '16px "FontAwesome"';
  ctx.fillStyle = C.gray;
  ctx.textAlign = 'right';
  ctx.fillText('\uf091', PAD + COL1_W - 14, MID_Y + 26); // Trophy
  ctx.textAlign = 'left';

  const drawRankRow = (y, label, value) => {
    drawInnerBox(ctx, PAD + 12, y, COL1_W - 24, 32);
    ctx.font = `bold 15px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.fillText(label, PAD + 22, y + 21);
    ctx.textAlign = 'right';
    ctx.fillText(value, PAD + COL1_W - 16, y + 21);
    ctx.textAlign = 'left';
  };

  drawRankRow(MID_Y + 38, 'Message', ranks.msg_rank ? `#${ranks.msg_rank}` : 'N/A');
  drawRankRow(MID_Y + 78, 'Voice', ranks.vc_rank ? `#${ranks.vc_rank}` : 'N/A');

  // --- Messages panel ---
  const MSG_X = PAD + COL1_W + COL_GAP;
  drawPanel(ctx, MSG_X, MID_Y, COL23_W, MID_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Messages', MSG_X + 14, MID_Y + 26);
  ctx.font = '16px "FontAwesome"';
  ctx.fillStyle = C.gray;
  ctx.textAlign = 'right';
  ctx.fillText('#', MSG_X + COL23_W - 14, MID_Y + 26);
  ctx.textAlign = 'left';

  const drawStatRow = (x, y, colW, label, numStr, suffix) => {
    // Label box
    drawInnerBox(ctx, x + 12, y, 38, 30, 5);
    ctx.font = `bold 14px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 12 + 19, y + 20);
    ctx.textAlign = 'left';

    // Number value
    ctx.font = `bold 16px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    const numW = ctx.measureText(numStr).width;
    ctx.fillText(numStr, x + 58, y + 20);

    // Italic suffix
    ctx.font = `14px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.fillText(suffix, x + 58 + numW + 5, y + 20);
  };

  drawStatRow(MSG_X, MID_Y + 38, COL23_W, '1d',  formatNumber(stats.msg_1d),  'messages');
  drawStatRow(MSG_X, MID_Y + 74, COL23_W, '7d',  formatNumber(stats.msg_7d),  'messages');
  drawStatRow(MSG_X, MID_Y + 110, COL23_W, '14d', formatNumber(stats.msg_14d ?? stats.msg_30d), 'messages');

  // --- Voice Activity panel ---
  const VC_X = MSG_X + COL23_W + COL_GAP;
  drawPanel(ctx, VC_X, MID_Y, COL23_W, MID_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Voice Activity', VC_X + 14, MID_Y + 26);
  ctx.font = '16px "FontAwesome"';
  ctx.fillStyle = C.gray;
  ctx.textAlign = 'right';
  ctx.fillText('\uf028', VC_X + COL23_W - 14, MID_Y + 26); // Volume up
  ctx.textAlign = 'left';

  const drawVcRow = (x, y, colW, label, seconds) => {
    const formatted = formatHours(seconds);
    const parts = formatted.split(' ');
    const num  = parts[0];
    const suff = parts.slice(1).join(' ');
    drawStatRow(x, y, colW, label, num, suff);
  };

  drawVcRow(VC_X, MID_Y + 38,  COL23_W, '1d',  stats.vc_1d);
  drawVcRow(VC_X, MID_Y + 74,  COL23_W, '7d',  stats.vc_7d);
  drawVcRow(VC_X, MID_Y + 110, COL23_W, '14d', stats.vc_14d ?? stats.vc_30d);

  // ---- BOTTOM ROW: Top Channels | Charts ----
  const BOT_Y = MID_Y + MID_H + COL_GAP;
  const BOT_H = H - BOT_Y - PAD - 28; // leave room for footer
  const TC_W = 360;
  const CH_X = PAD + TC_W + COL_GAP;
  const CH_W = W - PAD - TC_W - COL_GAP - PAD;

  // --- Top Channels & Applications panel ---
  drawPanel(ctx, PAD, BOT_Y, TC_W, BOT_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Top Channels & Applications', PAD + 14, BOT_Y + 26);
  ctx.font = '16px "FontAwesome"';
  ctx.fillStyle = C.gray;
  ctx.textAlign = 'right';
  ctx.fillText('\uf201', PAD + TC_W - 14, BOT_Y + 26); // Chart line up
  ctx.textAlign = 'left';

  const drawChannelRow = (y, iconChar, rawName, valueStr) => {
    drawInnerBox(ctx, PAD + 12, y, TC_W - 24, 30);

    // Icon
    ctx.font = '12px "FontAwesome"';
    ctx.fillStyle = C.gray;
    ctx.textAlign = 'center';
    ctx.fillText(iconChar, PAD + 12 + 14, y + 20);
    ctx.textAlign = 'left';

    // Channel name (truncate to fit)
    const safeName = safeText(rawName);
    ctx.font = `bold 14px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    const maxNameW = TC_W - 24 - 32 - 80;
    const truncName = truncateText(ctx, safeName, maxNameW);
    ctx.fillText(truncName, PAD + 12 + 30, y + 20);

    // Value right-aligned
    ctx.font = `14px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.textAlign = 'right';
    ctx.fillText(valueStr, PAD + TC_W - 16, y + 20);
    ctx.textAlign = 'left';
  };

  // Top message channel
  const topMsg = topChannels.messages[0];
  const topMsgCh = topMsg ? (guild?.channels.cache.get(topMsg.channel_id)) : null;
  const topMsgName = topMsgCh ? topMsgCh.name : (topMsg ? 'deleted-channel' : 'No Activity');
  drawChannelRow(BOT_Y + 38, '#', topMsgName, topMsg ? formatNumber(topMsg.total) + ' messages' : '0');

  // Top voice channel
  const topVc = topChannels.voice[0];
  const topVcCh = topVc ? (guild?.channels.cache.get(topVc.channel_id)) : null;
  const topVcName = topVcCh ? topVcCh.name : (topVc ? 'deleted-channel' : 'No Activity');
  drawChannelRow(BOT_Y + 76, '\uf028', topVcName, topVc ? formatHours(topVc.total) : '0 secs'); // Volume high

  // --- Charts panel ---
  drawPanel(ctx, CH_X, BOT_Y, CH_W, BOT_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Charts', CH_X + 14, BOT_Y + 26);

  // Legend
  const legendX = CH_X + CH_W - 120;
  const legendY = BOT_Y + 26;
  ctx.beginPath(); ctx.arc(legendX, legendY - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.green; ctx.fill();
  ctx.font = `13px ${FONT_NORMAL}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Message', legendX + 8, legendY);

  ctx.beginPath(); ctx.arc(legendX + 68, legendY - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.pink; ctx.fill();
  ctx.fillStyle = C.white;
  ctx.fillText('Voice', legendX + 76, legendY);

  // Chart area
  const cInnerX = CH_X + 14;
  const cInnerY = BOT_Y + BOT_H - 14;
  const cW = CH_W - 28;
  const cH = BOT_H - 44;

  // Baseline
  ctx.strokeStyle = '#33363C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cInnerX, cInnerY);
  ctx.lineTo(cInnerX + cW, cInnerY);
  ctx.stroke();

  if (chartData && chartData.length > 1) {
    const maxMsg = Math.max(...chartData.map(d => d.messages), 1);
    const maxVc  = Math.max(...chartData.map(d => d.voice_seconds), 1);

    // Voice (pink) — draw first so messages overlap
    drawLineChart(ctx, chartData, 'voice_seconds', maxVc,
      cInnerX, cInnerY, cW, cH,
      C.pink,
      'rgba(244,127,255,0.25)', 'rgba(244,127,255,0.0)'
    );
    // Messages (green)
    drawLineChart(ctx, chartData, 'messages', maxMsg,
      cInnerX, cInnerY, cW, cH,
      C.green,
      'rgba(67,181,129,0.3)', 'rgba(67,181,129,0.0)'
    );
  }

  // ---- FOOTER ----
  ctx.font = `12px ${FONT_NORMAL}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('Server Lookback: Last 14 days  \u2014  Timezone: UTC', PAD, H - 10);
  ctx.font = `bold 12px ${FONT_BOLD}`;
  ctx.fillStyle = C.green;
  ctx.textAlign = 'right';
  ctx.fillText('Powered by Athena Prime', W - PAD, H - 10);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}


// ============================================================
// SERVER OVERVIEW CARD — matches Statbot's serveroverview output
// ============================================================
export async function generateServerOverviewImage(guild, stats) {
  const W = 820, H = 590;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const PAD = 18;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ---- HEADER ----
  const ICON_R = 44;
  const ICON_CX = PAD + ICON_R;
  const ICON_CY = PAD + ICON_R + 4;

  if (guild.iconURL()) {
    await drawCircularImage(ctx, guild.iconURL({ extension: 'png', size: 256 }), ICON_CX, ICON_CY, ICON_R);
  }

  const guildName = safeText(guild.name) || 'Server Overview';
  ctx.font = `bold 30px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText(guildName.toUpperCase(), ICON_CX + ICON_R + 14, ICON_CY - 10);

  ctx.font = `16px ${FONT_NORMAL}`;
  ctx.fillStyle = C.gray;
  ctx.fillText('Server Overview', ICON_CX + ICON_R + 14, ICON_CY + 18);

  // Dates
  const createdDate = new Date(guild.createdTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const botJoinedDate = guild.joinedTimestamp ? new Date(guild.joinedTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

  const drawBadge2 = (label, value, bx) => {
    drawPanel(ctx, bx, PAD, 140, 54, 8, C.badge, true);
    ctx.font = `bold 11px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.fillText(label, bx + 12, PAD + 20);
    ctx.font = `14px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.fillText(value, bx + 12, PAD + 40);
  };

  drawBadge2('Created On', createdDate, W - PAD - 140 - 10 - 140);
  drawBadge2('Invited Bot On', botJoinedDate, W - PAD - 140);

  ctx.fillStyle = '#33363C';
  ctx.fillRect(PAD, ICON_CY + ICON_R + 14, W - PAD * 2, 1);

  // ---- ROW 1: Messages | Voice Activity | Contributors ----
  const ROW1_Y = ICON_CY + ICON_R + 26;
  const ROW1_H = 150;
  const COL_GAP = 14;
  const COL_W = Math.floor((W - PAD * 2 - COL_GAP * 2) / 3);

  const drawPanelTitle = (x, y, w, title, iconStr, isFa = false) => {
    drawPanel(ctx, x, y, w, ROW1_H);
    ctx.font = `bold 17px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.fillText(title, x + 14, y + 28);
    ctx.font = isFa ? '16px "FontAwesome"' : `18px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.textAlign = 'right';
    ctx.fillText(iconStr, x + w - 14, y + 28);
    ctx.textAlign = 'left';
  };

  const drawOverviewRow = (px, y, colW, label, numStr, suffix) => {
    drawInnerBox(ctx, px + 12, y, 40, 30, 5);
    ctx.font = `bold 14px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.fillText(label, px + 12 + 20, y + 20);
    ctx.textAlign = 'left';
    ctx.font = `bold 15px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    const nw = ctx.measureText(numStr).width;
    ctx.fillText(numStr, px + 60, y + 20);
    ctx.font = `italic 13px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.fillText(suffix, px + 60 + nw + 4, y + 20);
  };

  // Messages column
  const M_X = PAD;
  drawPanelTitle(M_X, ROW1_Y, COL_W, 'Messages', '#');
  drawOverviewRow(M_X, ROW1_Y + 42,  COL_W, '1d',  formatNumber(stats.overview.d1_msg),  'messages');
  drawOverviewRow(M_X, ROW1_Y + 78,  COL_W, '7d',  formatNumber(stats.overview.d7_msg),  'messages');
  drawOverviewRow(M_X, ROW1_Y + 114, COL_W, '14d', formatNumber(stats.overview.d14_msg), 'messages');

  // Voice column
  const V_X = M_X + COL_W + COL_GAP;
  drawPanelTitle(V_X, ROW1_Y, COL_W, 'Voice Activity', '\uf028', true); // fa-volume-high
  drawOverviewRow(V_X, ROW1_Y + 42,  COL_W, '1d',  formatHoursShort(stats.overview.d1_vc),  'hours');
  drawOverviewRow(V_X, ROW1_Y + 78,  COL_W, '7d',  formatHoursShort(stats.overview.d7_vc),  'hours');
  drawOverviewRow(V_X, ROW1_Y + 114, COL_W, '14d', formatHoursShort(stats.overview.d14_vc), 'hours');

  // Contributors column
  const CO_X = V_X + COL_W + COL_GAP;
  drawPanelTitle(CO_X, ROW1_Y, COL_W, 'Contributors', '\uf0c0', true); // fa-users
  drawOverviewRow(CO_X, ROW1_Y + 42,  COL_W, '1d',  formatNumber(stats.overview.d1_contributors),  'members');
  drawOverviewRow(CO_X, ROW1_Y + 78,  COL_W, '7d',  formatNumber(stats.overview.d7_contributors),  'members');
  drawOverviewRow(CO_X, ROW1_Y + 114, COL_W, '14d', formatNumber(stats.overview.d14_contributors), 'members');

  // ---- ROW 2: Top Members | Top Channels ----
  const ROW2_Y = ROW1_Y + ROW1_H + COL_GAP;
  const ROW2_H = 115;
  const HALF_W = Math.floor((W - PAD * 2 - COL_GAP) / 2);

  // Get member/channel names
  const resolveUser = async (id) => {
    if (!id) return 'Unknown';
    try {
      const m = await guild.members.fetch(id).catch(() => null);
      if (m) return safeText(m.user.username) || safeText(m.displayName) || 'Unknown';
      const u = await guild.client.users.fetch(id).catch(() => null);
      return u ? (safeText(u.username) || 'Unknown') : 'Unknown';
    } catch { return 'Unknown'; }
  };

  const resolveChannel = (id) => {
    if (!id) return 'Unknown';
    const ch = guild.channels.cache.get(id);
    return ch ? safeText(ch.name) || 'channel' : 'deleted-channel';
  };

  const topMsgUserName = await resolveUser(stats.topMembers.messages?.user_id);
  const topVcUserName  = await resolveUser(stats.topMembers.voice?.user_id);

  // Top Members panel
  drawPanel(ctx, PAD, ROW2_Y, HALF_W, ROW2_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Top Members', PAD + 14, ROW2_Y + 28);

  const drawRankingRow2 = (px, panelW, y, iconChar, name, valueText, isFa = false) => {
    ctx.font = isFa ? '14px "FontAwesome"' : `bold 14px ${FONT_BOLD}`;
    ctx.fillStyle = C.gray;
    ctx.textAlign = 'center';
    ctx.fillText(iconChar, px + 24, y + 20);
    ctx.textAlign = 'left';

    // Dark name box
    drawInnerBox(ctx, px + 42, y, panelW - 42 - 100 - 20, 30, 5);
    ctx.font = `bold 14px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    const maxNW = panelW - 42 - 100 - 30;
    ctx.fillText(truncateText(ctx, name, maxNW), px + 52, y + 20);

    ctx.font = `14px ${FONT_NORMAL}`;
    ctx.fillStyle = C.gray;
    ctx.textAlign = 'right';
    ctx.fillText(valueText, px + panelW - 14, y + 20);
    ctx.textAlign = 'left';
  };

  drawRankingRow2(PAD, HALF_W, ROW2_Y + 40, '#',   topMsgUserName, formatNumber(stats.topMembers.messages?.total || 0) + ' msgs');
  drawRankingRow2(PAD, HALF_W, ROW2_Y + 76, '\uf028',  topVcUserName,  formatHoursShort(stats.topMembers.voice?.total || 0) + ' hours', true); // fa-volume-high

  // Top Channels panel
  const TC_X = PAD + HALF_W + COL_GAP;
  drawPanel(ctx, TC_X, ROW2_Y, HALF_W, ROW2_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Top Channels', TC_X + 14, ROW2_Y + 28);
  ctx.font = '16px "FontAwesome"';
  ctx.fillStyle = C.gray;
  ctx.textAlign = 'right';
  ctx.fillText('\uf201', TC_X + HALF_W - 14, ROW2_Y + 28); // Chart line
  ctx.textAlign = 'left';

  drawRankingRow2(TC_X, HALF_W, ROW2_Y + 40, '#',   resolveChannel(stats.topChannels.messages?.channel_id), formatNumber(stats.topChannels.messages?.total || 0) + ' msgs');
  drawRankingRow2(TC_X, HALF_W, ROW2_Y + 76, '\uf028',  resolveChannel(stats.topChannels.voice?.channel_id),   formatHoursShort(stats.topChannels.voice?.total || 0) + ' hours', true);

  // ---- ROW 3: Charts ----
  const ROW3_Y = ROW2_Y + ROW2_H + COL_GAP;
  const ROW3_H = H - ROW3_Y - PAD - 26;

  drawPanel(ctx, PAD, ROW3_Y, W - PAD * 2, ROW3_H);
  ctx.font = `bold 17px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Charts', PAD + 14, ROW3_Y + 28);

  // Legend
  const lx = W - PAD - 130;
  const ly = ROW3_Y + 28;
  ctx.beginPath(); ctx.arc(lx, ly - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.green; ctx.fill();
  ctx.font = `13px ${FONT_NORMAL}`;
  ctx.fillStyle = C.white;
  ctx.fillText('Message', lx + 8, ly);

  ctx.beginPath(); ctx.arc(lx + 72, ly - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.pink; ctx.fill();
  ctx.fillStyle = C.white;
  ctx.fillText('Voice', lx + 80, ly);

  if (stats.chart && stats.chart.length > 1) {
    const cIX = PAD + 14;
    const cIY = ROW3_Y + ROW3_H - 12;
    const cW2 = W - PAD * 2 - 28;
    const cH2 = ROW3_H - 44;
    const maxMsg = Math.max(...stats.chart.map(d => d.messages), 1);
    const maxVc  = Math.max(...stats.chart.map(d => d.voice_seconds), 1);

    ctx.strokeStyle = '#33363C';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cIX, cIY);
    ctx.lineTo(cIX + cW2, cIY);
    ctx.stroke();

    drawLineChart(ctx, stats.chart, 'voice_seconds', maxVc, cIX, cIY, cW2, cH2, C.pink, 'rgba(244,127,255,0.25)', 'rgba(244,127,255,0.0)');
    drawLineChart(ctx, stats.chart, 'messages', maxMsg, cIX, cIY, cW2, cH2, C.green, 'rgba(67,181,129,0.3)', 'rgba(67,181,129,0.0)');
  }

  // Footer
  ctx.font = `12px ${FONT_NORMAL}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('Server Lookback: Last 14 days  \u2014  Timezone: UTC', PAD, H - 10);
  ctx.font = `bold 12px ${FONT_BOLD}`;
  ctx.fillStyle = C.green;
  ctx.textAlign = 'right';
  ctx.fillText('Powered by Athena Prime', W - PAD, H - 10);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}


// ============================================================
// TOP LEADERBOARD IMAGE — matches Statbot's s?top output
// ============================================================
export async function generateTopImage(guild, topMembers, type = 'messages') {
  const typeLabel = type === 'voice' ? 'Voice' : 'Message';
  const typeUnit  = type === 'voice' ? 'hours' : 'msgs';
  const ROWS_PER_COL = 5;
  const ROW_H = 46;
  const HEADER_H = 100;
  const SECTION_TITLE_H = 40;
  const BOTTOM_PAD = 30;
  const H = HEADER_H + SECTION_TITLE_H + (ROWS_PER_COL * ROW_H) + BOTTOM_PAD + 26;
  const W = 820;
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
    await drawCircularImage(ctx, guild.iconURL({ extension: 'png', size: 128 }), ICON_CX, ICON_CY, ICON_R);
  }

  const guildName = safeText(guild.name) || 'Server';
  ctx.font = `bold 26px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText(guildName.toUpperCase(), ICON_CX + ICON_R + 14, ICON_CY - 6);

  ctx.font = `16px ${FONT_NORMAL}`;
  ctx.fillStyle = C.gray;
  ctx.fillText('\uf091 Top Statistics', ICON_CX + ICON_R + 14, ICON_CY + 18);
  ctx.font = '14px "FontAwesome"';
  ctx.fillText('\uf091', ICON_CX + ICON_R + 14, ICON_CY + 18);

  ctx.fillStyle = '#33363C';
  ctx.fillRect(PAD, ICON_CY + ICON_R + 12, W - PAD * 2, 1);

  // ---- SECTION TITLE ----
  const SEC_Y = ICON_CY + ICON_R + 20;
  ctx.font = `bold 20px ${FONT_BOLD}`;
  ctx.fillStyle = C.white;
  ctx.fillText(`# Top ${typeLabel} Members`, PAD, SEC_Y + 22);

  // ---- 2-COLUMN GRID ----
  const GRID_Y = SEC_Y + SECTION_TITLE_H;
  const COL_GAP = 14;
  const COL_W = Math.floor((W - PAD * 2 - COL_GAP) / 2);

  for (let i = 0; i < Math.min(topMembers.length, 10); i++) {
    const isRight = i >= ROWS_PER_COL;
    const rowIdx  = isRight ? i - ROWS_PER_COL : i;
    const colX    = PAD + (isRight ? COL_W + COL_GAP : 0);
    const rowY    = GRID_Y + rowIdx * ROW_H;

    const member = topMembers[i];
    const rank   = i + 1;
    const name   = safeText(member.username) || `User ${rank}`;
    const count  = formatNumber(member.total) + ` ${typeUnit}`;

    // Row background
    drawPanel(ctx, colX, rowY, COL_W, ROW_H - 6, 8, C.panel, true);

    // Rank number
    ctx.font = `bold 18px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.textAlign = 'right';
    ctx.fillText(String(rank), colX + 36, rowY + 26);
    ctx.textAlign = 'left';

    // Username
    ctx.font = `16px ${FONT_NORMAL}`;
    ctx.fillStyle = C.white;
    const maxNameW = COL_W - 56 - 80;
    ctx.fillText(truncateText(ctx, name, maxNameW), colX + 46, rowY + 26);

    // Count (bold, right-aligned)
    ctx.font = `bold 18px ${FONT_BOLD}`;
    ctx.fillStyle = C.white;
    ctx.textAlign = 'right';
    ctx.fillText(count, colX + COL_W - 14, rowY + 26);
    ctx.textAlign = 'left';
  }

  // Footer
  ctx.font = `12px ${FONT_NORMAL}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('Server Lookback: Last 14 days  \u2014  Timezone: UTC', PAD, H - 10);
  ctx.font = `bold 12px ${FONT_BOLD}`;
  ctx.fillStyle = C.green;
  ctx.textAlign = 'right';
  ctx.fillText('Powered by Athena Prime', W - PAD, H - 10);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}
