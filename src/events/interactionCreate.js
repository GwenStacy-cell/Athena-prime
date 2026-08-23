import { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { buildXpDashboard } from '../commands/leveling.js';
import commandMap from '../commands/loader.js';
import cv2 from '../cv2.js';
import { setGuildContext } from '../embed.js';

// Import all button handlers dynamically
import * as downloader from '../utils/mediaDownloader.js';
import db from '../database.js';

const isBotOwnerSync = (id) => id === '1509084068619489331';
const TOGGLE_ON = '<:emoji_16:1521464002046328944>';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
  try {
    const guild = interaction.guild;
    if (guild) setGuildContext(guild.id);
    
    // ==========================================
    // 1. SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Command not found.', ephemeral: true });
      }

      if (command.ownerOnly && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ content: 'Only the bot developer can use this command.', ephemeral: true });
      }

      if (command.permissions && command.permissions.length > 0) {
        if (!interaction.member.permissions.has(command.permissions) && !isBotOwnerSync(interaction.user.id) && interaction.user.id !== interaction.guild.ownerId) {
          return interaction.reply(cv2.e.danger('Access Denied', `You lack the required permissions (\`${command.permissions.join(', ')}\`) to run this command.`));
        }
      }

      try {
        await command.executeSlash(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
      return;
    }

    // ==========================================
    // 2. MODALS
    // ==========================================
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'vc_limit_modal') {
        const limitStr = interaction.fields.getTextInputValue('limit_input');
        const limit = parseInt(limitStr, 10);
        if (isNaN(limit) || limit < 0 || limit > 99) {
          return interaction.reply({ content: 'Invalid limit. Must be a number between 0 and 99.', ephemeral: true });
        }
        
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply({ content: 'You are not in a voice channel.', ephemeral: true });

        // Basic check: Is it a custom VC?
        const j2cConfig = db.getGuildConfig(interaction.guild.id).j2c;
        if (!j2cConfig || vc.parentId !== j2cConfig.categoryId) {
           return interaction.reply({ content: 'You can only manage your own custom voice channel.', ephemeral: true });
        }

        await vc.setUserLimit(limit);
        return interaction.reply({ content: `Channel limit set to ${limit}.`, ephemeral: true });
      }

      if (interaction.customId === 'vc_name_modal') {
        const newName = interaction.fields.getTextInputValue('name_input');
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply({ content: 'You are not in a voice channel.', ephemeral: true });

        const j2cConfig = db.getGuildConfig(interaction.guild.id).j2c;
        if (!j2cConfig || vc.parentId !== j2cConfig.categoryId) {
           return interaction.reply({ content: 'You can only manage your own custom voice channel.', ephemeral: true });
        }

        await vc.setName(newName);
        return interaction.reply({ content: `Channel renamed to \`${newName}\`.`, ephemeral: true });
      }
      
      if (interaction.customId.startsWith('enuke_modal_')) {
        const { handleEnukeModal } = await import('../commands/enuke.js');
        return handleEnukeModal(interaction);
      }

      // Handle Whitelist limit modal
      if (interaction.customId.startsWith('wlModal_limit_')) {
        await handleWhitelistModal(interaction);
        return;
      }
    }

    // ==========================================
    // 3. INTERACTIVE COMPONENT BUTTON CLICKS
    // ==========================================
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      // SERVER SCANNER BUTTONS
      if (interaction.customId.startsWith('scanserver_')) {
        const { handleScanServer } = await import('../commands/security.js');
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const page = parseInt(parts[2] || '0', 10);
        
        try {
          if (action === 'prev') {
            const newPanel = await handleScanServer(interaction.guild, page - 1);
            return await interaction.update(newPanel);
          }
          if (action === 'next') {
            const newPanel = await handleScanServer(interaction.guild, page + 1);
            return await interaction.update(newPanel);
          }
          if (action === 'ban') {
             const botId = interaction.values[0];
             await interaction.guild.members.ban(botId, { reason: 'Unauthorized Bot Banned via Scanner' }).catch(() => null);
             const newPanel = await handleScanServer(interaction.guild, page);
             return await interaction.update(newPanel);
          }
          if (action === 'banall') {
             await interaction.guild.members.fetch();
             const db = (await import('../database.js')).default;
             const config = db.getGuildConfig(interaction.guild.id);
             const whitelistedIds = config.botWhitelist || [];
             const allBots = interaction.guild.members.cache.filter(m => m.user.bot && !whitelistedIds.includes(m.id) && m.id !== interaction.client.user.id);
             
             for (const [id, bot] of allBots) {
                await interaction.guild.members.ban(id, { reason: 'Mass Ban via Scanner' }).catch(() => null);
             }
             const newPanel = await handleScanServer(interaction.guild, page);
             return await interaction.update(newPanel);
          }
        } catch (err) {
          console.error(err);
          return await interaction.reply({ content: 'An error occurred while processing the scanner action.', ephemeral: true }).catch(() => null);
        }
      }

      // ENUKE BUTTON
      if (interaction.customId.startsWith('enuke_open_manager_')) {
        const { handleEnukeButton } = await import('../commands/enuke.js');
        return handleEnukeButton(interaction);
      }

      // RATE EDIT BUTTONS
      if (interaction.customId.startsWith('rate_edit_')) {
        const action = interaction.customId.replace('rate_edit_', '');
        const ratingData = db.getEditRating(interaction.message.id);

        if (!ratingData) {
          return interaction.reply({ content: 'This rating session has expired or is invalid.', ephemeral: true }).catch(() => null);
        }

        if (action === 'delete') {
          // Only author or admin can delete
          if (interaction.user.id !== ratingData.authorId && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'You can only remove your own edits!', ephemeral: true }).catch(() => null);
          }
          db.deleteEditRating(interaction.message.id);
          await interaction.message.delete().catch(() => null);
          return interaction.reply({ content: 'Edit rating post removed.', ephemeral: true }).catch(() => null);
        }

        const stars = parseInt(action);
        if (isNaN(stars) || stars < 1 || stars > 5) return interaction.deferUpdate().catch(() => null);

        // Prevent self-rating
        if (interaction.user.id === ratingData.authorId) {
          return interaction.reply({ content: 'You cannot rate your own edit!', ephemeral: true }).catch(() => null);
        }

        // Save rating
        db.updateEditRating(interaction.message.id, interaction.user.id, interaction.user.username, stars);

        // Calculate new stats
        const updatedData = db.getEditRating(interaction.message.id);
        const votes = Object.values(updatedData.votes);
        const totalVotes = votes.length;
        const totalStars = votes.reduce((acc, v) => acc + v.stars, 0);
        const avgRating = (totalStars / totalVotes).toFixed(1);

        // Get last 5 ratings for the list
        const latestRatings = Object.entries(updatedData.votes)
          .reverse()
          .slice(0, 5)
          .map(([id, v]) => `**${v.name}** - ${v.stars} <:1z:1517089474369032253>`)
          .join('\n');

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(`<a:1z:1517089474369032253> **Current Rating**\n${avgRating}/5 (${totalVotes} votes)\n\n**User Ratings**\n${latestRatings || '_No ratings yet_'}`);

        await interaction.update({ embeds: [embed] }).catch(() => null);
        return;
      }


      // RECORD BUTTONS
      if (interaction.customId === 'record_stop') {
        const vc = interaction.member?.voice?.channel;
        const vcName = vc ? vc.name : 'Unknown Channel';
        const container = {
          type: 17,
          components: [
            { type: 10, content: `## **Voice Recording Stopped**\n\n-# Channel: 🔊 **${vcName}**\n\n-# Processing and exporting the audio file, please wait...` },
            { type: 14, divider: true },
            { type: 10, content: '-# Athena Bulletproof Security' }
          ]
        };
        try { await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 }); } catch(err) { console.error("INTERACTION ERROR:", err); await interaction.channel.send("UPDATE CRASHED: " + err.message); return; }
        
        try {
          const { stopRecording } = await import('../utils/audioRecorder.js');
          const mp3Path = await stopRecording(interaction.guild.id);
          if (!mp3Path) {
             const emptyContainer = { type: 17, components: [{ type: 10, content: '-# No active recording found for this server.' }] };
             return interaction.message.edit({ components: [emptyContainer] });
          }
          const successContainer = { type: 17, components: [{ type: 10, content: '-# **Audio Export Successful!**' }] };
          await interaction.message.edit({ components: [successContainer] });
          await interaction.followUp({ files: [mp3Path] });
          const fs = await import('fs');
          fs.unlink(mp3Path, () => {});
        } catch (err) {
          const errContainer = { type: 17, components: [{ type: 10, content: `-# **Recording Stopped:** ${err.message}` }] };
          await interaction.message.edit({ components: [errContainer] });
        }
        return;
      }

      if (interaction.customId === 'record_status') {
        const { getRecordingStatus } = await import('../utils/audioRecorder.js');
        const isActive = getRecordingStatus(interaction.guild.id);
        const container = {
          type: 17,
          components: [
            { type: 10, content: `## **Voice Recording Status**\n-# Status: ${isActive ? 'Active 🔴' : 'Inactive ⚪'}` },
            { type: 14, divider: true },
            { type: 10, content: '-# Athena Bulletproof Security' }
          ]
        };
        try { return await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: false }); } catch(err) { console.error("INTERACTION ERROR:", err); await interaction.channel.send("REPLY CRASHED: " + err.message); return; }
      }

      // MEDIA PROMPT BUTTONS
      if (interaction.customId === 'dl_mp4' || interaction.customId === 'dl_mp3') {
        const originalMessageId = interaction.message.reference ? interaction.message.reference.messageId : null;
        if (!originalMessageId) return interaction.reply({ content: 'Original message not found.', ephemeral: true });
        
        try {
          const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
          const urlMatch = originalMessage.content.match(/(https?:\/\/[^\s]+)/);
          const url = urlMatch ? urlMatch[0] : null;

          if (!url) return interaction.reply({ content: 'Could not extract URL.', ephemeral: true });

          await interaction.update({ content: `-# **Downloading ${interaction.customId === 'dl_mp4' ? 'MP4' : 'MP3'}...**`, components: [] });
          
          let success = false;
          if (interaction.customId === 'dl_mp4') {
            success = await downloader.processMediaLink(interaction.client, originalMessage, url);
          } else {
            success = await downloader.processMp3Link(interaction.client, originalMessage, url);
          }
          
          if (!success) {
            await interaction.message.edit({ content: `-# **Failed to download media.**` });
          } else {
            await interaction.message.delete().catch(() => null);
          }
        } catch (error) {
          console.error('Media Prompt Error:', error);
          await interaction.update({ content: `-# **An error occurred.**`, components: [] });
        }
        return;
      }

      // GIVEAWAY BUTTONS
      if (interaction.customId.startsWith('gw_join_')) {
        const messageId = interaction.customId.split('_')[2];
        const gwData = db.getGiveaway(interaction.guild.id, messageId);
        
        if (!gwData || !gwData.active) {
          return interaction.reply(cv2.e.danger('Giveaway Ended', 'This giveaway has already ended or does not exist.'));
        }

        if (gwData.participants.includes(interaction.user.id)) {
          // Remove them
          gwData.participants = gwData.participants.filter(id => id !== interaction.user.id);
          db.saveGiveaways();
          await interaction.reply(cv2.e.info('Left Giveaway', 'You have left the giveaway.'));
        } else {
          // Add them
          gwData.participants.push(interaction.user.id);
          db.saveGiveaways();
          await interaction.reply(cv2.e.success('Joined Giveaway', 'You have successfully entered the giveaway! Good luck!'));
        }

        // Update the embed participant count
        const { getActiveGiveawayPanel } = await import('../commands/giveaway.js');
        const panel = getActiveGiveawayPanel(gwData);
        await interaction.message.edit(panel).catch(console.error);
        return;
      }
      
      // LEVELING BUTTONS
      if (interaction.customId === 'xp_dash') {
        const panel = await buildXpDashboard(interaction.user, interaction.guild);
        return interaction.reply({ ...panel, ephemeral: true });
      }

      // VOICE CONTROL BUTTONS
      if (interaction.customId.startsWith('vc_')) {
        const vc = interaction.member.voice.channel;
        if (!vc) {
          return interaction.reply(cv2.e.danger('Not in VC', 'You must be in a Voice Channel to use this control.'));
        }
        
        const j2cConfig = db.getGuildConfig(interaction.guild.id).j2c;
        if (!j2cConfig || vc.parentId !== j2cConfig.categoryId) {
          return interaction.reply(cv2.e.danger('Not a Custom VC', 'You can only control your own Join-to-Create custom channel.'));
        }

        const action = interaction.customId.split('_')[1];

        if (action === 'lock') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
          return interaction.reply({ content: 'Channel Locked.', ephemeral: true });
        }
        if (action === 'unlock') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
          return interaction.reply({ content: 'Channel Unlocked.', ephemeral: true });
        }
        if (action === 'hide') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
          return interaction.reply({ content: 'Channel Hidden.', ephemeral: true });
        }
        if (action === 'unhide') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
          return interaction.reply({ content: 'Channel Visible.', ephemeral: true });
        }
        if (action === 'limit') {
          const modal = new ModalBuilder()
            .setCustomId('vc_limit_modal')
            .setTitle('Set User Limit');
          const input = new TextInputBuilder()
            .setCustomId('limit_input')
            .setLabel('Enter limit (0-99, 0 for unlimited)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
        if (action === 'name') {
          const modal = new ModalBuilder()
            .setCustomId('vc_name_modal')
            .setTitle('Change Channel Name');
          const input = new TextInputBuilder()
            .setCustomId('name_input')
            .setLabel('New Channel Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }
        if (action === 'info') {
          return interaction.reply({ content: `**Channel Info**\nName: ${vc.name}\nBitrate: ${vc.bitrate / 1000}kbps\nLimit: ${vc.userLimit === 0 ? 'None' : vc.userLimit}\nConnected: ${vc.members.size}`, ephemeral: true });
        }
        if (action === 'claim') {
          const currentOwner = vc.name.split("'s")[0]; 
          // It's a crude check, a real system tracks the owner ID in the DB.
          return interaction.reply({ content: 'Ownership claiming is not yet fully implemented.', ephemeral: true });
        }
      }

      await handleSecurityInteractions(interaction, guild);
    }

  } catch (error) {
    console.error('Interaction Error:', error);
  }
  } // close execute
}; // close object

async function handleSecurityInteractions(interaction, guild) {
  const customId = interaction.customId;
  const config = db.getGuildConfig(guild.id);

  // Security Overview Navigation
  if (customId === 'sec_back') {
    try {
      const sec = await import('../commands/security.js');
      const panel = sec.getSecurityOverviewPanel(guild);
      return interaction.update(panel);
    } catch(e) { console.error(e); }
  }

  // Antilink / Anti-Spam Menu
  if (customId === 'sec_antilink') {
    try {
      const sec = await import('../commands/security.js');
      const panel = await sec.getAntilinkModulePanel(guild);
      return interaction.update(panel);
    } catch(e) { console.error(e); }
  }

  if (customId.startsWith('al_')) {
    let updated = false;

    if (customId === 'al_toggle_link') {
      const newVal = !config.antiLinkEnabled;
      const updateData = { antiLinkEnabled: newVal };
      if (newVal) updateData.allowAllLinks = false; // Turn OFF Allow All if turning ON Anti-Link
      db.updateGuildConfig(guild.id, updateData);
      updated = true;
    }
    else if (customId === 'al_toggle_invite') {
      const newVal = !config.antiInviteEnabled;
      const updateData = { antiInviteEnabled: newVal };
      if (newVal) updateData.allowInvitesGlobally = false; // Turn OFF Allow Invites if turning ON Anti-Invite
      db.updateGuildConfig(guild.id, updateData);
      updated = true;
    }
    else if (customId === 'al_toggle_all_links') {
      const newVal = !config.allowAllLinks;
      const updateData = { allowAllLinks: newVal };
      if (newVal) updateData.antiLinkEnabled = false; // Turn OFF Anti-Link if turning ON Allow All
      db.updateGuildConfig(guild.id, updateData);
      updated = true;
    }
    else if (customId === 'al_toggle_spam_mention') {
      const newVal = !config.antiSpamMentionEnabled;
      db.updateGuildConfig(guild.id, { antiSpamMentionEnabled: newVal });
      updated = true;
    }
    else if (customId === 'al_toggle_global_invites') {
      const newVal = !config.allowInvitesGlobally;
      const updateData = { allowInvitesGlobally: newVal };
      if (newVal) updateData.antiInviteEnabled = false; // Turn OFF Anti-Invite if turning ON Allow Invites
      db.updateGuildConfig(guild.id, updateData);
      updated = true;
    }
    else if (customId === 'al_select_invite_channel') {
      const channelId = interaction.values[0];
      db.updateGuildConfig(guild.id, { inviteAllowedChannel: channelId });
      updated = true;
    }
    else if (customId === 'al_select_link_role') {
      const roleId = interaction.values[0];
      db.updateGuildConfig(guild.id, { linkBypassRole: roleId });
      updated = true;
    }
    else if (customId === 'al_select_invite_role') {
      const roleId = interaction.values[0];
      db.updateGuildConfig(guild.id, { inviteBypassRole: roleId });
      updated = true;
    }
    else if (customId === 'al_select_spam_mention_role') {
      const roleIds = interaction.values;
      db.updateGuildConfig(guild.id, { antiSpamMentionBypassRoles: roleIds });
      updated = true;
    }

    if (updated) {
      try {
        const sec = await import('../commands/security.js');
        const panel = await sec.getAntilinkModulePanel(guild);
        return interaction.update(panel);
      } catch (e) {
        console.error(e);
      }
    }
    return;
  }

  // Whitelist Logic
  if (customId === 'wl_close') {
    return interaction.message.delete().catch(() => null);
  }

  if (customId === 'wlo_back') {
    try {
      const sec = await import('../commands/security.js');
      const panel = await sec.getWhitelistOverviewPanel(guild);
      return interaction.update(panel);
    } catch(e) { console.error(e); }
  }

  if (customId.startsWith('wlo_')) {
    const actionParts = customId.split('_'); 
    
    if (interaction.isAnySelectMenu()) {
      if (customId.startsWith('wlo_select')) {
        let type, targetId, viewAction;
        const subAction = actionParts[1].replace('select', ''); 
        type = actionParts[2]; 
        
        if (interaction.isUserSelectMenu() || interaction.isRoleSelectMenu()) {
          targetId = interaction.values[0];
        } else if (interaction.isStringSelectMenu()) {
          if (interaction.values[0] === 'none') return interaction.deferUpdate();
          targetId = interaction.values[0];
        }
        
        try {
          const sec = await import('../commands/security.js');
          if (subAction === 'remove') {
            db.updateWhitelist(guild.id, targetId, type, null);
            const panel = await sec.getWhitelistOverviewPanel(guild);
            return interaction.update(panel);
          } else {
            const panel = await sec.getWhitelistPanel(guild, targetId, type, 'manage');
            return interaction.update(panel);
          }
        } catch(e) { console.error(e); }
        return;
      }
    }
    
    if (interaction.isButton()) {
      const subAction = actionParts[1];
      const type = actionParts[2];
      
      try {
        const sec = await import('../commands/security.js');
        const panel = await sec.getWhitelistSelectPanel(guild, type, subAction);
        return interaction.update(panel);
      } catch(e) { console.error(e); }
      return;
    }
  }

  const parts = customId.split('_');
  if (parts[0] !== 'wl') return;
  
  const action = parts[1];
  let type, targetId, limitVal;

  if (action === 'limit') {
    if (parts[2] === 'custom') {
      type = parts[3];
      targetId = parts[4];
      const modal = new ModalBuilder()
        .setCustomId(`wlModal_limit_${type}_${targetId}`)
        .setTitle('Custom Trigger Limit');
      
      const input = new TextInputBuilder()
        .setCustomId('limit_input')
        .setLabel('Enter custom limit (Number)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
        
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
    limitVal = parseInt(parts[2], 10);
    type = parts[3];
    targetId = parts[4];
  } else {
    type = parts[2];
    targetId = parts[3];
  }

  // Determine which view to render after update
  let viewToRender = 'manage';
  if (action === 'save') {
    viewToRender = 'overview';
  } else if (action === 'manage') {
    viewToRender = 'manage';
  }

  let wData = db.getWhitelist(guild.id, targetId, type) || { modules: [], triggerLimit: 0, currentUsage: 0 };

  if (action === 'select') {
    wData.modules = interaction.values;
  } else if (action === 'all') {
    wData.modules = ['all'];
  } else if (action === 'reset') {
    wData.modules = [];
    wData.currentUsage = 0;
    wData.triggerLimit = 0;
  } else if (action === 'limit') {
    wData.triggerLimit = limitVal;
    wData.currentUsage = 0;
  }

  if (wData.modules.length === 0) {
    db.updateWhitelist(guild.id, targetId, type, null); 
  } else {
    db.updateWhitelist(guild.id, targetId, type, wData);
  }

  try {
    const sec = await import('../commands/security.js');
    if (viewToRender === 'overview') {
      const panel = await sec.getWhitelistOverviewPanel(guild);
      await interaction.update(panel);
    } else {
      if (sec.getWhitelistPanel) {
        const panel = await sec.getWhitelistPanel(guild, targetId, type, viewToRender);
        await interaction.update(panel);
      } else {
        await interaction.update({ content: 'Saved.', components: [] });
      }
    }
  } catch(e) {
    console.error(e);
    await interaction.update({ content: 'Saved.', components: [] });
  }
}

// Handle Modal Submissions for Custom Limits
export async function handleWhitelistModal(interaction) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('wlModal_limit_')) return;
  
  const parts = interaction.customId.split('_');
  const type = parts[2];
  const targetId = parts[3];
  
  const limitStr = interaction.fields.getTextInputValue('limit_input');
  const limitVal = parseInt(limitStr, 10);
  
  if (isNaN(limitVal) || limitVal < 0) {
    return interaction.reply({ content: 'Invalid limit. Please enter a valid positive number.', ephemeral: true });
  }

  let wData = db.getWhitelist(interaction.guild.id, targetId, type) || { modules: [], triggerLimit: 0, currentUsage: 0 };
  wData.triggerLimit = limitVal;
  wData.currentUsage = 0;
  
  if (wData.modules.length === 0) {
    db.updateWhitelist(interaction.guild.id, targetId, type, null);
  } else {
    db.updateWhitelist(interaction.guild.id, targetId, type, wData);
  }
  
  try {
    const sec = await import('../commands/security.js');
    if (sec.getWhitelistPanel) {
      const panel = await sec.getWhitelistPanel(interaction.guild, targetId, type, 'manage');
      await interaction.update(panel);
    } else {
      await interaction.update({ content: 'Saved.', components: [] });
    }
  } catch(e) {
    console.error(e);
    await interaction.update({ content: 'Saved.', components: [] });
  }
}




