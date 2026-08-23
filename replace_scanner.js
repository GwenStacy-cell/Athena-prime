import fs from 'fs';

let code = fs.readFileSync('src/commands/security.js', 'utf8');

const targetStart = "export async function handleScanServer(guild, page = 0) {";
const targetEnd = "export async function getAntilinkModulePanel(guild) {";

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find start or end block.");
    process.exit(1);
}

const replacement = `export async function handleScanServer(guild, page = 0) {
  const config = db.getGuildConfig(guild.id);
  const whitelistedIds = config.botWhitelist || [];
  
  await guild.members.fetch(); 
  const allMembers = guild.members.cache;
  const allBots = allMembers.filter(m => m.user.bot);
  const allHumans = allMembers.filter(m => !m.user.bot);
  
  const unauthorizedBots = [];
  const whitelistedBots = [];
  
  const dangerousPerms = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers
  ];

  allBots.forEach(bot => {
     if (whitelistedIds.includes(bot.id) || bot.id === guild.client.user.id) {
       whitelistedBots.push(bot);
     } else {
       unauthorizedBots.push(bot);
     }
  });

  const getDangerousRoles = (member) => {
    return member.roles.cache.filter(role => dangerousPerms.some(perm => role.permissions.has(perm)) && role.id !== guild.id);
  };
  
  const highRiskHumans = [];
  const trustedHumans = [];
  
  allHumans.forEach(h => {
     if (h.id === guild.ownerId || isExtraOwner(guild.id, h.id)) {
       trustedHumans.push(h);
       return;
     }
     const badRoles = getDangerousRoles(h);
     if (badRoles.size > 0) {
       highRiskHumans.push({ member: h, roles: badRoles });
     }
  });

  const highRiskBots = [];
  allBots.forEach(b => {
     if (b.id === guild.client.user.id) return;
     const badRoles = getDangerousRoles(b);
     if (badRoles.size > 0) {
       highRiskBots.push({ member: b, roles: badRoles });
     }
  });

  const ITEMS_PER_PAGE = 15;
  const totalPages = Math.max(
    1,
    Math.ceil(highRiskHumans.length / ITEMS_PER_PAGE),
    Math.ceil(unauthorizedBots.length / ITEMS_PER_PAGE),
    Math.ceil(whitelistedBots.length / ITEMS_PER_PAGE),
    Math.ceil(trustedHumans.length / ITEMS_PER_PAGE)
  );
  
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;

  const startIdx = page * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;

  const cv2Components = [];
  
  cv2Components.push({ type: 10, content: \`## **SERVER SECURITY SCANNER**\` });
  cv2Components.push({ type: 14, divider: true });
  
  cv2Components.push({ type: 10, content: \`# **SECURITY DIAGNOSTICS**\\n-# **Total Humans:** \\\`\${allHumans.size}\\\`\\n-# **Total Bots:** \\\`\${allBots.size}\\\` (Whitelisted: \\\`\${whitelistedBots.length}\\\` | Unauthorized: \\\`\${unauthorizedBots.length}\\\`)\` });
  
  const humansToShow = trustedHumans.slice(startIdx, endIdx);
  if (humansToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = \`# **TRUSTED PERSONNEL**\\n\`;
    humansToShow.forEach(h => {
      content += \`-# - **@\${h.user.username}** [\\\`\${h.id}\\\`]\\n\`;
    });
    if (trustedHumans.length > endIdx) content += \`-# *...and \${trustedHumans.length - endIdx} more.*\\n\`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  const whitelistedBotsToShow = whitelistedBots.slice(startIdx, endIdx);
  if (whitelistedBotsToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = \`# **WHITELISTED BOTS**\\n\`;
    whitelistedBotsToShow.forEach(b => {
      content += \`-# - **@\${b.user.username}** [\\\`\${b.id}\\\`]\\n\`;
    });
    if (whitelistedBots.length > endIdx) content += \`-# *...and \${whitelistedBots.length - endIdx} more.*\\n\`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  const highRiskHumansToShow = highRiskHumans.slice(startIdx, endIdx);
  if (highRiskHumansToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = \`# **HIGH-RISK PERSONNEL**\\n\`;
    highRiskHumansToShow.forEach(h => {
      content += \`-# - **@\${h.member.user.username}** [\\\`\${h.member.id}\\\`] - \${h.roles.map(r => \`<@&\${r.id}>\`).join(', ')}\\n\`;
    });
    if (highRiskHumans.length > endIdx) content += \`-# *...and \${highRiskHumans.length - endIdx} more.*\\n\`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  const unauthorizedBotsToShow = unauthorizedBots.slice(startIdx, endIdx);
  if (unauthorizedBotsToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = \`# **UNAUTHORIZED BOTS**\\n\`;
    unauthorizedBotsToShow.forEach(b => {
      const badRoles = getDangerousRoles(b);
      content += \`-# - **@\${b.user.username}** [\\\`\${b.id}\\\`] \${badRoles.size > 0 ? \`(\${badRoles.map(r => \`<@&\${r.id}>\`).join(', ')})\` : ''}\\n\`;
    });
    if (unauthorizedBots.length > endIdx) content += \`-# *...and \${unauthorizedBots.length - endIdx} more.*\\n\`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  if (unauthorizedBots.length === 0 && highRiskHumans.length === 0) {
     cv2Components.push({ type: 14, divider: true });
     cv2Components.push({ type: 10, content: \`-# *Server security is optimal. No unauthorized bots or untrusted high-risk users detected.*\` });
  }
  
  cv2Components.push({ type: 14, divider: true });
  cv2Components.push({ type: 10, content: \`-# **Page \${page + 1} of \${totalPages}**\` });

  const container = {
    type: 17,
    components: cv2Components
  };

  const actionRows = [];

  // Pagination buttons
  if (totalPages > 1) {
    const prevBtn = new ButtonBuilder()
      .setCustomId(\`scanserver_prev_\${page}\`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);
      
    const nextBtn = new ButtonBuilder()
      .setCustomId(\`scanserver_next_\${page}\`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages - 1);
      
    actionRows.push(new ActionRowBuilder().addComponents(prevBtn, nextBtn));
  }

  if (unauthorizedBots.length > 0) {
    const options = unauthorizedBots.map(b => ({
      label: b.user.username.substring(0, 100),
      description: b.id,
      value: b.id
    })).slice(0, 25);
    
    // Required because we might be returning inside an interaction update
    const { StringSelectMenuBuilder } = await import('discord.js');
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(\`scanserver_ban_\${page}\`)
      .setPlaceholder('Select an unauthorized bot to ban')
      .addOptions(options);
      
    const banAllBtn = new ButtonBuilder()
      .setCustomId(\`scanserver_banall_\${page}\`)
      .setLabel('Ban All Unauthorized')
      .setStyle(ButtonStyle.Danger);
      
    actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
    actionRows.push(new ActionRowBuilder().addComponents(banAllBtn));
  }
  
  return { components: [container, ...actionRows], flags: MessageFlags.IsComponentsV2 };
}

`;

const newCode = code.slice(0, startIndex) + replacement + code.slice(endIndex);
fs.writeFileSync('src/commands/security.js', newCode);
console.log("Replaced handleScanServer successfully.");
