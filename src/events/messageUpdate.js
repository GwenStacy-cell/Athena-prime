import { EmbedBuilder } from 'discord.js';
import { scanImageForScam, flaggedMessages } from '../utils/antiScam.js';
import { logToSecurityChannel } from '../utils/helpers.js';
import { logServerEvent } from '../utils/serverLogger.js';
import embed from '../embed.js';
export default {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (newMessage.author?.bot || newMessage.webhookId) return;
    if (!newMessage.guild) return;

    // ==========================================
    // SERVER LOGS: Message Edit
    // ==========================================
    if (oldMessage.content !== newMessage.content) {
      const oldContent = oldMessage.content ? (oldMessage.content.length > 1000 ? oldMessage.content.substring(0, 997) + '...' : oldMessage.content) : 'No old content';
      const newContent = newMessage.content ? (newMessage.content.length > 1000 ? newMessage.content.substring(0, 997) + '...' : newMessage.content) : 'No new content';

      const editEmbed = embed.build({
        description: `__**Message Edited |**__ <:emoji_16:1521464002046328944>\n> **Author:** ${newMessage.author?.tag} (<@${newMessage.author?.id}>)\n>  **Channel:** ${newMessage.channel}\n>  [Jump to Message](${newMessage.url})\n>  **Before:**\n>  ${oldContent}\n>  **After:**\n>  ${newContent}`,
        color: '#2b2d31'
      });

      logServerEvent(newMessage.guild, 'msgEdits', editEmbed);
    }

    // We only care about late unfurled embeds or late added attachments
    // If the old message didn't have embeds but the new one does:
    const urlsToScan = [];
    
    // Check Embeds
    if (newMessage.embeds && newMessage.embeds.length > 0) {
      newMessage.embeds.forEach(embed => {
        if (embed.image) urlsToScan.push(embed.image.url);
        if (embed.thumbnail) urlsToScan.push(embed.thumbnail.url);
      });
    }

    // Ensure we only scan if there is actually a new url that wasn't there before to avoid infinite loops,
    // though scanImageForScam is pretty safe, we don't want to spam OCR.
    
    if (urlsToScan.length > 0) {
      for (const url of urlsToScan) {
         scanImageForScam(url).then(async (isScam) => {
           if (isScam && !flaggedMessages.has(newMessage.id)) {
             flaggedMessages.add(newMessage.id);
             
             await newMessage.delete().catch(() => null);
             
             // 1. Channel Warning
             const scamEmbed = new EmbedBuilder()
               .setColor('#ff0000') // Pure red
               .setDescription(`<a:emoji_35:1517213876058329148> <@${newMessage.author.id}>, your image was flagged as a scam and removed.`);
             await newMessage.channel.send({ embeds: [scamEmbed] }).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
             
             // 2. Security Channel Log
             const logEmbed = new EmbedBuilder()
               .setColor('#2b2d31')
               .setTitle('LOG: MALICIOUS SCAM IMAGE DELETED')
               .setDescription(`**User:** <@${newMessage.author.id}> (${newMessage.author.tag})\n**Action:** Posted a fraudulent image containing known scam keywords (Mr. Beast/Kasowin/Helawin/Crypto Casino).`)
               .addFields([{ name: 'Channel', value: `<#${newMessage.channel.id}>` }])
               .setFooter({ text: 'Athena Prime Security' })
               .setTimestamp();
             
             try {
               const { default: db } = await import('../database.js');
               const config = db.getGuildConfig(newMessage.guild.id);
               if (config && config.accentColor) {
                 logEmbed.setColor(config.accentColor);
               }
             } catch(e) {}
             
             logToSecurityChannel(newMessage.guild, logEmbed);
             
             // 3. DM Server Owner
             try {
               const owner = await newMessage.guild.members.fetch(newMessage.guild.ownerId);
               if (owner) {
                 const dmEmbed = new EmbedBuilder()
                   .setColor('#ff0000')
                   .setTitle('<a:emoji_35:1517213876058329148> Automated Scam Intervention')
                   .setDescription(`Hello **${owner.user.username}**,\nI have successfully intercepted and deleted a fraudulent scam image in your server **${newMessage.guild.name}**.\n\n**Offender:** <@${newMessage.author.id}>\n**Location:** <#${newMessage.channel.id}>\n**Detected Keywords:** Mr. Beast / Kasowin / Helawin / Crypto Casino`)
                   .setFooter({ text: 'Athena Prime Security System' });
                 await owner.send({ embeds: [dmEmbed] }).catch(() => null);
               }
             } catch (e) {
               // Ignore if owner can't be DMed
             }
           }
         });
      }
    }
  }
};
