import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

// Helper to format numbers like 1.5k, 2.4m
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

// Helper to format hours
function formatHours(seconds) {
  if (seconds < 60) return seconds + ' secs';
  const mins = seconds / 60;
  if (mins < 60) return mins.toFixed(1) + ' mins';
  const hours = mins / 60;
  return hours.toFixed(2) + ' hours';
}

function drawPanel(ctx, x, y, width, height, radius = 10, fillStyle = '#2A2D32') {
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
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawText(ctx, text, x, y, font, color, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

export async function generateStatCard(user, member, stats, ranks, topChannels, chartData, guild) {
  const width = 800;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#181A1F'; // Dark dark background
  ctx.fillRect(0, 0, width, height);

  // Constants
  const panelColor = '#24262B';
  const innerPanelColor = '#1D1E22';
  const textColorPrimary = '#FFFFFF';
  const textColorSecondary = '#A3A6AA';
  
  // 1. HEADER (Avatar, Name, Dates)
  try {
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 128 });
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 20, 20, 80, 80);
    ctx.restore();
  } catch (e) {}

  drawText(ctx, user.username, 115, 60, 'bold 36px sans-serif', textColorPrimary);
  drawText(ctx, user.discriminator !== '0' ? `#${user.discriminator}` : '', 115 + ctx.measureText(user.username).width + 5, 60, '24px sans-serif', textColorSecondary);
  
  // Custom display name or nickname if any
  const nick = member ? member.displayName : user.username;
  if (nick) {
    // We intentionally skip rendering the AKA nickname to avoid unsupported font tofu boxes
  }

  // Dates
  const joinedDate = member ? new Date(member.joinedTimestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown';
  const createdDate = new Date(user.createdTimestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  
  // Created On Badge
  drawPanel(ctx, 450, 25, 150, 50, 8, '#2F3136');
  drawText(ctx, 'Created On', 460, 45, 'bold 12px sans-serif', '#FFFFFF');
  drawText(ctx, createdDate, 460, 65, '14px sans-serif', '#FFFFFF');

  // Joined On Badge
  drawPanel(ctx, 620, 25, 150, 50, 8, '#2F3136');
  drawText(ctx, 'Joined On', 630, 45, 'bold 12px sans-serif', '#FFFFFF');
  drawText(ctx, joinedDate, 630, 65, '14px sans-serif', '#FFFFFF');


  // 2. MIDDLE ROW (Ranks, Messages, Voice)
  const midY = 120;
  const colW = 240;
  const gap = 20;

  // Ranks Panel
  drawPanel(ctx, 20, midY, colW, 140, 10, panelColor);
  drawText(ctx, 'Server Ranks', 35, midY + 30, 'bold 20px sans-serif', textColorPrimary);
  
  drawPanel(ctx, 35, midY + 45, colW - 30, 35, 5, innerPanelColor);
  drawText(ctx, 'Message', 45, midY + 68, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, ranks.msg_rank ? `#${ranks.msg_rank}` : 'N/A', 20 + colW - 25, midY + 68, '18px sans-serif', textColorSecondary, 'right');

  drawPanel(ctx, 35, midY + 90, colW - 30, 35, 5, innerPanelColor);
  drawText(ctx, 'Voice', 45, midY + 113, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, ranks.vc_rank ? `#${ranks.vc_rank}` : 'N/A', 20 + colW - 25, midY + 113, '18px sans-serif', textColorSecondary, 'right');

  // Messages Panel
  const msgX = 20 + colW + gap;
  drawPanel(ctx, msgX, midY, colW, 140, 10, panelColor);
  drawText(ctx, 'Messages', msgX + 15, midY + 30, 'bold 20px sans-serif', textColorPrimary);
  
  const drawStatRow = (x, y, label, value, suffix) => {
    drawPanel(ctx, x + 15, y, colW - 30, 30, 5, innerPanelColor);
    drawText(ctx, label, x + 35, y + 20, 'bold 16px sans-serif', textColorPrimary);
    const valText = value;
    drawText(ctx, valText, x + 100, y + 20, '16px sans-serif', textColorSecondary);
    drawText(ctx, suffix, x + 100 + ctx.measureText(valText).width + 5, y + 20, 'italic 14px sans-serif', '#888');
  };

  drawStatRow(msgX, midY + 40, '1d', formatNumber(stats.msg_1d), 'messages');
  drawStatRow(msgX, midY + 75, '7d', formatNumber(stats.msg_7d), 'messages');
  drawStatRow(msgX, midY + 110, '30d', formatNumber(stats.msg_30d), 'messages');

  // Voice Panel
  const vcX = msgX + colW + gap;
  drawPanel(ctx, vcX, midY, colW, 140, 10, panelColor);
  drawText(ctx, 'Voice Activity', vcX + 15, midY + 30, 'bold 20px sans-serif', textColorPrimary);

  const drawVcRow = (x, y, label, value) => {
    drawPanel(ctx, x + 15, y, colW - 30, 30, 5, innerPanelColor);
    drawText(ctx, label, x + 35, y + 20, 'bold 16px sans-serif', textColorPrimary);
    
    // Split value and suffix manually for VC
    const valParts = value.split(' ');
    const num = valParts[0];
    const suff = valParts.slice(1).join(' ');
    
    drawText(ctx, num, x + 100, y + 20, '16px sans-serif', textColorSecondary);
    drawText(ctx, suff, x + 100 + ctx.measureText(num).width + 5, y + 20, 'italic 14px sans-serif', '#888');
  };

  drawVcRow(vcX, midY + 40, '1d', formatHours(stats.vc_1d));
  drawVcRow(vcX, midY + 75, '7d', formatHours(stats.vc_7d));
  drawVcRow(vcX, midY + 110, '30d', formatHours(stats.vc_30d));


  // 3. BOTTOM ROW (Top Channels, Chart)
  const botY = 280;
  const tcW = 380;
  
  // Top Channels Panel
  drawPanel(ctx, 20, botY, tcW, 130, 10, panelColor);
  drawText(ctx, 'Top Channels & Applications', 35, botY + 30, 'bold 18px sans-serif', textColorPrimary);

  // Messages Top Channel
  drawPanel(ctx, 35, botY + 45, tcW - 30, 30, 5, innerPanelColor);
  drawText(ctx, '#', 45, botY + 65, 'bold 16px sans-serif', textColorSecondary);
  const topMsg = topChannels.messages[0];
  let topMsgName = 'No Activity';
  if (topMsg) {
    const ch = guild?.channels.cache.get(topMsg.channel_id);
    const cleanName = ch ? ch.name.normalize('NFKC').replace(/[^\x20-\x7E]/g, '').trim() || 'channel' : 'deleted-channel';
    topMsgName = `# ${cleanName}`;
  }
  const topMsgVal = topMsg ? formatNumber(topMsg.total) : '0';
  drawText(ctx, topMsgName, 70, botY + 65, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, topMsgVal + ' msgs', 20 + tcW - 25, botY + 65, '14px sans-serif', textColorSecondary, 'right');

  // Voice Top Channel
  drawPanel(ctx, 35, botY + 85, tcW - 30, 30, 5, innerPanelColor);
  drawText(ctx, 'VC', 42, botY + 105, '14px sans-serif', textColorSecondary);
  const topVc = topChannels.voice[0];
  let topVcName = 'No Activity';
  if (topVc) {
    const ch = guild?.channels.cache.get(topVc.channel_id);
    const cleanName = ch ? ch.name.normalize('NFKC').replace(/[^\x20-\x7E]/g, '').trim() || 'channel' : 'deleted-channel';
    topVcName = cleanName;
  }
  const topVcVal = topVc ? formatHours(topVc.total) : '0 secs';
  drawText(ctx, topVcName, 70, botY + 105, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, topVcVal, 20 + tcW - 25, botY + 105, '14px sans-serif', textColorSecondary, 'right');

  // Charts Panel
  const chX = 20 + tcW + gap;
  const chW = width - chX - 20;
  drawPanel(ctx, chX, botY, chW, 130, 10, panelColor);
  drawText(ctx, 'Charts', chX + 15, botY + 30, 'bold 18px sans-serif', textColorPrimary);

  // Legend
  drawText(ctx, '● Message', chX + 180, botY + 30, '14px sans-serif', '#43B581');
  drawText(ctx, '● Voice', chX + 270, botY + 30, '14px sans-serif', '#E83D84');

  // Draw Line Charts
  const chartHeight = 70;
  const chartY = botY + 110;
  const chartWidth = chW - 30;
  const stepX = chartWidth / 29;

  let maxMsg = 0;
  let maxVc = 0;
  chartData.forEach(d => {
    if (d.messages > maxMsg) maxMsg = d.messages;
    if (d.voice_seconds > maxVc) maxVc = d.voice_seconds;
  });
  if (maxMsg === 0) maxMsg = 1;
  if (maxVc === 0) maxVc = 1;

  // Draw Voice (Pink)
  ctx.beginPath();
  ctx.moveTo(chX + 15, chartY);
  chartData.forEach((d, i) => {
    const x = chX + 15 + (i * stepX);
    const y = chartY - (d.voice_seconds / maxVc) * chartHeight;
    ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#E83D84';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Voice Gradient
  ctx.lineTo(chX + 15 + (29 * stepX), chartY);
  ctx.lineTo(chX + 15, chartY);
  const gradVc = ctx.createLinearGradient(0, chartY - chartHeight, 0, chartY);
  gradVc.addColorStop(0, 'rgba(232, 61, 132, 0.4)');
  gradVc.addColorStop(1, 'rgba(232, 61, 132, 0.0)');
  ctx.fillStyle = gradVc;
  ctx.fill();

  // Draw Messages (Green)
  ctx.beginPath();
  ctx.moveTo(chX + 15, chartY);
  chartData.forEach((d, i) => {
    const x = chX + 15 + (i * stepX);
    const y = chartY - (d.messages / maxMsg) * chartHeight;
    ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#43B581';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Message Gradient
  ctx.lineTo(chX + 15 + (29 * stepX), chartY);
  ctx.lineTo(chX + 15, chartY);
  const gradMsg = ctx.createLinearGradient(0, chartY - chartHeight, 0, chartY);
  gradMsg.addColorStop(0, 'rgba(67, 181, 129, 0.4)');
  gradMsg.addColorStop(1, 'rgba(67, 181, 129, 0.0)');
  ctx.fillStyle = gradMsg;
  ctx.fill();

  // FOOTER
  drawText(ctx, 'Server Lookback: Last 30 days — Timezone: IST', 20, height - 15, '12px sans-serif', '#888');
  drawText(ctx, 'Powered by Athena Prime', width - 20, height - 15, 'bold 12px sans-serif', '#43B581', 'right');

  return canvas.toBuffer();
}

export async function generateServerOverviewImage(guild, stats) {
  const width = 800;
  const height = 580;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#181A1F';
  ctx.fillRect(0, 0, width, height);

  const panelColor = '#24262B';
  const innerPanelColor = '#1D1E22';
  const textColorPrimary = '#FFFFFF';
  const textColorSecondary = '#A3A6AA';

  // Header
  try {
    if (guild.iconURL()) {
      const icon = await loadImage(guild.iconURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(icon, 20, 20, 80, 80);
      ctx.restore();
    }
  } catch (e) {}

  drawText(ctx, guild.name, 120, 50, 'bold 36px sans-serif', textColorPrimary);
  drawText(ctx, '📊 Server Overview', 120, 85, '24px sans-serif', textColorSecondary);

  const createdDate = new Date(guild.createdTimestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const joinedDate = guild.joinedTimestamp ? new Date(guild.joinedTimestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown';

  // Created On Badge
  drawPanel(ctx, 450, 25, 150, 50, 8, '#2F3136');
  drawText(ctx, 'Created On', 460, 45, 'bold 12px sans-serif', '#FFFFFF');
  drawText(ctx, createdDate, 460, 65, '14px sans-serif', '#FFFFFF');

  // Invited On Badge
  drawPanel(ctx, 620, 25, 150, 50, 8, '#2F3136');
  drawText(ctx, 'Invited Bot On', 630, 45, 'bold 12px sans-serif', '#FFFFFF');
  drawText(ctx, joinedDate, 630, 65, '14px sans-serif', '#FFFFFF');

  const drawListRow = (x, y, label, value, unit) => {
    drawPanel(ctx, x, y, 220, 35, 5, innerPanelColor);
    drawText(ctx, label, x + 15, y + 23, 'bold 16px sans-serif', textColorPrimary);
    const valText = value;
    drawText(ctx, valText, x + 60, y + 23, '16px sans-serif', textColorSecondary);
    drawText(ctx, unit, x + 60 + ctx.measureText(valText).width + 5, y + 23, 'italic 14px sans-serif', '#888');
  };

  // Row 1
  drawPanel(ctx, 20, 110, 240, 160, 10, panelColor);
  drawText(ctx, 'Messages', 35, 140, 'bold 20px sans-serif', textColorPrimary);
  drawListRow(30, 150, '1d', formatNumber(stats.overview.d1_msg), 'messages');
  drawListRow(30, 190, '7d', formatNumber(stats.overview.d7_msg), 'messages');
  drawListRow(30, 230, '14d', formatNumber(stats.overview.d14_msg), 'messages');

  drawPanel(ctx, 280, 110, 240, 160, 10, panelColor);
  drawText(ctx, 'Voice Activity', 295, 140, 'bold 20px sans-serif', textColorPrimary);
  drawListRow(290, 150, '1d', formatHours(stats.overview.d1_vc).split(' ')[0], 'hours');
  drawListRow(290, 190, '7d', formatHours(stats.overview.d7_vc).split(' ')[0], 'hours');
  drawListRow(290, 230, '14d', formatHours(stats.overview.d14_vc).split(' ')[0], 'hours');

  drawPanel(ctx, 540, 110, 240, 160, 10, panelColor);
  drawText(ctx, 'Contributors', 555, 140, 'bold 20px sans-serif', textColorPrimary);
  drawListRow(550, 150, '1d', formatNumber(stats.overview.d1_contributors), 'members');
  drawListRow(550, 190, '7d', formatNumber(stats.overview.d7_contributors), 'members');
  drawListRow(550, 230, '14d', formatNumber(stats.overview.d14_contributors), 'members');

  // Helpers
  const getUserName = async (id) => {
    if (!id) return 'Unknown';
    try {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) return member.user.username;
      const user = await guild.client.users.fetch(id).catch(() => null);
      return user ? user.username : 'Unknown';
    } catch { return 'Unknown'; }
  };

  const getChannelName = (id) => {
    if (!id) return 'Unknown';
    const ch = guild.channels.cache.get(id);
    return ch ? ch.name : 'Unknown';
  };

  const topMsgUserName = await getUserName(stats.topMembers.messages?.user_id);
  const topVcUserName = await getUserName(stats.topMembers.voice?.user_id);

  // Row 2
  drawPanel(ctx, 20, 290, 370, 120, 10, panelColor);
  drawText(ctx, 'Top Members', 35, 320, 'bold 18px sans-serif', textColorPrimary);
  drawPanel(ctx, 30, 330, 350, 30, 5, innerPanelColor);
  drawPanel(ctx, 30, 370, 350, 30, 5, innerPanelColor);
  
  drawText(ctx, '#', 45, 350, 'bold 16px sans-serif', textColorSecondary);
  drawText(ctx, topMsgUserName, 70, 350, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, formatNumber(stats.topMembers.messages?.total || 0) + ' msgs', 370, 350, '14px sans-serif', textColorSecondary, 'right');

  drawText(ctx, '🎙️', 42, 390, '14px sans-serif', textColorSecondary);
  drawText(ctx, topVcUserName, 70, 390, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, formatHours(stats.topMembers.voice?.total || 0), 370, 390, '14px sans-serif', textColorSecondary, 'right');

  drawPanel(ctx, 410, 290, 370, 120, 10, panelColor);
  drawText(ctx, 'Top Channels', 425, 320, 'bold 18px sans-serif', textColorPrimary);
  drawPanel(ctx, 420, 330, 350, 30, 5, innerPanelColor);
  drawPanel(ctx, 420, 370, 350, 30, 5, innerPanelColor);
  
  drawText(ctx, '#', 435, 350, 'bold 16px sans-serif', textColorSecondary);
  drawText(ctx, getChannelName(stats.topChannels.messages?.channel_id), 460, 350, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, formatNumber(stats.topChannels.messages?.total || 0) + ' msgs', 760, 350, '14px sans-serif', textColorSecondary, 'right');

  drawText(ctx, '🎙️', 432, 390, '14px sans-serif', textColorSecondary);
  drawText(ctx, getChannelName(stats.topChannels.voice?.channel_id), 460, 390, 'bold 16px sans-serif', textColorPrimary);
  drawText(ctx, formatHours(stats.topChannels.voice?.total || 0), 760, 390, '14px sans-serif', textColorSecondary, 'right');

  // Row 3: Charts
  drawPanel(ctx, 20, 430, 760, 110, 10, panelColor);
  drawText(ctx, 'Charts', 35, 460, 'bold 18px sans-serif', textColorPrimary);
  
  // Legend
  drawText(ctx, '● Message', 600, 460, '14px sans-serif', '#43B581');
  drawText(ctx, '● Voice', 690, 460, '14px sans-serif', '#E83D84');

  // Draw Line Charts
  if (stats.chart && stats.chart.length > 0) {
    const chartHeight = 50;
    const chartY = 530;
    const chartWidth = 730;
    const stepX = chartWidth / (stats.chart.length - 1 || 1);

    let maxMsg = Math.max(...stats.chart.map(d => d.messages), 1);
    let maxVc = Math.max(...stats.chart.map(d => d.voice_seconds), 1);

    // Voice
    ctx.beginPath();
    ctx.moveTo(35, chartY);
    stats.chart.forEach((d, i) => {
      const x = 35 + (i * stepX);
      const y = chartY - (d.voice_seconds / maxVc) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#E83D84';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(35 + chartWidth, chartY);
    ctx.lineTo(35, chartY);
    const gradVc = ctx.createLinearGradient(0, chartY - chartHeight, 0, chartY);
    gradVc.addColorStop(0, 'rgba(232, 61, 132, 0.4)');
    gradVc.addColorStop(1, 'rgba(232, 61, 132, 0.0)');
    ctx.fillStyle = gradVc;
    ctx.fill();

    // Messages
    ctx.beginPath();
    ctx.moveTo(35, chartY);
    stats.chart.forEach((d, i) => {
      const x = 35 + (i * stepX);
      const y = chartY - (d.messages / maxMsg) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#43B581';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(35 + chartWidth, chartY);
    ctx.lineTo(35, chartY);
    const gradMsg = ctx.createLinearGradient(0, chartY - chartHeight, 0, chartY);
    gradMsg.addColorStop(0, 'rgba(67, 181, 129, 0.4)');
    gradMsg.addColorStop(1, 'rgba(67, 181, 129, 0.0)');
    ctx.fillStyle = gradMsg;
    ctx.fill();
  }

  // Footer
  drawText(ctx, 'Server Lookback: Last 14 days — Timezone: IST', 20, 565, '12px sans-serif', '#888');
  drawText(ctx, 'Powered by Athena Prime', width - 20, 565, 'bold 12px sans-serif', '#43B581', 'right');

  return canvas.toBuffer('image/png');
}
