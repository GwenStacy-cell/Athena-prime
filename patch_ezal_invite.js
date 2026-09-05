import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");

js = js.replace(
  /case 'servers': return handleServers\(message\);/g,
  `case 'servers': return handleServers(message);\n    case 'invite': return handleInvite(message, args);`
);

js = js.replace(
  /async function handleServers\(message\) \{/g,
  `async function handleInvite(message, args) {
  if (!args[0]) return message.reply(cv2.warn('Invalid Usage', 'Provide a Server ID to pull an invite for.'));
  const guildId = args[0];
  const targetGuild = message.client.guilds.cache.get(guildId);
  
  if (!targetGuild) {
    return message.reply(cv2.danger('Error', 'Bot is not in that server or it is uncached.'));
  }
  
  try {
    let inviteChannel = targetGuild.systemChannel || targetGuild.rulesChannel;
    
    if (!inviteChannel) {
      const channels = targetGuild.channels.cache.filter(c => c.type === ChannelType.GuildText && c.permissionsFor(targetGuild.members.me).has(PermissionFlagsBits.CreateInstantInvite));
      if (channels.size > 0) inviteChannel = channels.first();
    }
    
    if (!inviteChannel) {
      return message.reply(cv2.danger('Failed', 'Could not find a valid text channel with Invite permissions in that server.'));
    }
    
    const invite = await inviteChannel.createInvite({ maxAge: 86400, maxUses: 1, unique: true, reason: 'EZAL Remote Access' });
    return message.reply(cv2.success('Invite Generated', \`Server: **\${targetGuild.name}**\\nMembers: **\${targetGuild.memberCount}**\\nInvite Link: \${invite.url}\`));
  } catch (err) {
    console.error('[EZAL Invite]', err);
    return message.reply(cv2.danger('API Error', 'Failed to generate invite due to Discord API rejection or missing permissions.'));
  }
}

async function handleServers(message) {`
);

fs.writeFileSync("src/commands/ezal.js", js);
