import fs from "fs";
let js = fs.readFileSync("src/commands/quote.js", "utf8");

const oldCode = `      if (args.length === 0) {
        return message.reply(cv2.warn('Quote System', \`\\\`!quote <message_id> [dark|light|transparent]\\\`\\n\\\`!quote @user <custom text>\\\`\\n\\\`!quotemaker\\\`\`));
      }`;

const newCode = `      if (args.length === 0) {
        return message.reply(cv2.warn('Quote System', \`\\\`!quote <message_id> [dark|light|transparent]\\\`\\n\\\`!quote @user <custom text>\\\`\\n\\\`!quotemaker\\\`\\n\\\`!quote setchannel <#channel|none>\\\`\`));
      }

      // Check for Admin setchannel Route
      if (args[0].toLowerCase() === 'setchannel') {
        const { isServerAdmin } = await import('../utils/helpers.js');
        if (!isServerAdmin(message.member, message.guild)) {
          return message.reply(cv2.danger('Access Denied', 'Only Admins can bind the Auto-Quote channel.'));
        }
        
        if (args[1]?.toLowerCase() === 'none' || args[1]?.toLowerCase() === 'off') {
          const { default: db } = await import('../database.js');
          db.updateGuildConfig(message.guild.id, { quoteChannelId: null });
          return message.reply(cv2.success('Auto-Quote Disabled', 'The dedicated Auto-Quote channel has been disabled.'));
        }
        
        const targetChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
        if (!targetChannel) return message.reply(cv2.warn('Usage', '\`!quote setchannel <#channel>\` or \`!quote setchannel none\`'));
        
        const { default: db } = await import('../database.js');
        db.updateGuildConfig(message.guild.id, { quoteChannelId: targetChannel.id });
        return message.reply(cv2.success('Auto-Quote Channel Bound', \`Any message typed in <#\${targetChannel.id}> will now be automatically converted into an aesthetic canvas quote image!\`));
      }`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/commands/quote.js", js);
