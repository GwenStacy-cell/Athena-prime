import fs from "fs";
let js = fs.readFileSync("src/commands/tts.js", "utf8");

const oldAuto = `      if (subcommand === 'auto') {
        const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
        if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can enable Auto-TTS.'));
        const target = message.mentions.users.first();
        if (!target) return message.reply(cv2.warn('Usage', '\`!tts auto @user\`'));
        db.addAutoTtsUser(message.guild.id, target.id);
        return message.reply(cv2.success('Auto-TTS Enabled', \`\${target} will now have all their messages in this channel read aloud.\`));
      }`;

const newAuto = `      if (subcommand === 'auto') {
        const target = message.mentions.users.first();
        if (target) {
          const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
          if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can enable Auto-TTS for other users.'));
          db.addAutoTtsUser(message.guild.id, target.id);
          return message.reply(cv2.success('Auto-TTS Enabled', \`\${target} will now have all their messages read aloud.\`));
        } else {
          db.addAutoTtsUser(message.guild.id, message.author.id);
          return message.reply(cv2.success('Auto-TTS Enabled', \`Your messages will now be read aloud automatically.\`));
        }
      }`;

const oldUnauto = `      if (subcommand === 'unauto') {
        const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
        if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can disable Auto-TTS.'));
        const target = message.mentions.users.first();
        if (!target) return message.reply(cv2.warn('Usage', '\`!tts unauto @user\`'));
        db.removeAutoTtsUser(message.guild.id, target.id);
        return message.reply(cv2.success('Auto-TTS Disabled', \`\${target} will no longer have their messages read aloud.\`));
      }`;

const newUnauto = `      if (subcommand === 'unauto') {
        const target = message.mentions.users.first();
        if (target) {
          const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
          if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can disable Auto-TTS for other users.'));
          db.removeAutoTtsUser(message.guild.id, target.id);
          return message.reply(cv2.success('Auto-TTS Disabled', \`\${target} will no longer have their messages read aloud.\`));
        } else {
          db.removeAutoTtsUser(message.guild.id, message.author.id);
          return message.reply(cv2.success('Auto-TTS Disabled', \`Your messages will no longer be read aloud automatically.\`));
        }
      }

      if (subcommand === 'autovc') {
        const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
        if (!hasAdmin) return message.reply(cv2.danger('Access Denied', 'Only Admins can toggle global Auto-TTS for a Voice Channel.'));
        
        const currentVc = db.getAutoTtsVc(message.guild.id);
        const userVc = message.member.voice.channelId;
        
        if (currentVc) {
          db.setAutoTtsVc(message.guild.id, null);
          return message.reply(cv2.success('Auto-TTS VC Disabled', \`The global Auto-TTS Voice Channel has been disabled.\`));
        }
        
        if (!userVc) return message.reply(cv2.warn('Error', 'You must be in a Voice Channel to enable Auto-TTS for it.'));
        
        db.setAutoTtsVc(message.guild.id, userVc);
        return message.reply(cv2.success('Auto-TTS VC Enabled', \`Anyone who types in chat while inside <#\${userVc}> will now have their messages read aloud!\`));
      }`;

js = js.replace(oldAuto, newAuto);
js = js.replace(oldUnauto, newUnauto);
js = js.replace(
  "`!tts auto @user` - Enable auto-TTS for a user\\n`!tts unauto @user` - Disable auto-TTS",
  "`!tts auto [@user]` - Enable auto-TTS\\n`!tts unauto [@user]` - Disable auto-TTS\\n`!tts autovc` - Toggle global Auto-TTS for your VC"
);

fs.writeFileSync("src/commands/tts.js", js);
