import { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
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
  if (!interaction.guild && !(interaction.isButton() && interaction.customId.startsWith('gen_invite_'))) return;

    try {
    const guild = interaction.guild;
    if (guild) setGuildContext(guild.id);
    
    // ==========================================
    // 1. SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Command not found.', flags: MessageFlags.Ephemeral });
      }

      if (command.ownerOnly && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ content: 'Only the bot developer can use this command.', flags: MessageFlags.Ephemeral });
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
          await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }

    // ==========================================
    // 2. MODALS
    // ==========================================
    
    
    
    if (interaction.isModalSubmit()) {


      if (interaction.customId === 'ytstats_bind_modal') {
        const { handleYtStatsModal } = await import('../commands/ytstats.js');
        return handleYtStatsModal(interaction);
      }
      if (interaction.customId.startsWith('autorole_modal_') || interaction.customId === 'autorole_vanity_modal') {

        const { handleAutoRoleModal } = await import('../commands/autorole.js');
        return handleAutoRoleModal(interaction);
      }
      if (interaction.customId.startsWith('autoreact_modal_')) {

        const { handleAutoReactModal } = await import('../commands/autoreact.js');
        return handleAutoReactModal(interaction);
      }

      if (interaction.customId === 'autonick_modal') {
        const { handleAutonickModal } = await import('../commands/security.js');
        return handleAutonickModal(interaction);
      }
      if (interaction.customId.startsWith('welc_modal_') || interaction.customId.startsWith('leav_modal_')) {
        const { handleWelcomeManagerModal } = await import('../commands/welcome.js');
        return handleWelcomeManagerModal(interaction);
      }

      if (interaction.customId.startsWith('modal_honeypot_')) {
        const channelId = interaction.customId.replace('modal_honeypot_', '');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url') || null;
        let timeoutVal = interaction.fields.getTextInputValue('timeout_minutes');
        let parsedTimeout = parseInt(timeoutVal);
        if (isNaN(parsedTimeout) || parsedTimeout < 1) parsedTimeout = 15;
        
        const db = (await import('../database.js')).default;
        db.updateGuildConfig(interaction.guild.id, { honeypotChannelId: channelId, honeypotTimeoutMinutes: parsedTimeout });
        
        const config = db.getGuildConfig(interaction.guild.id);
        const timeoutMinutes = config.honeypotTimeoutMinutes || 15;
        
        const { getAutoModPanel } = await import('../commands/security.js');
        const panel = await getAutoModPanel(interaction.guild);
        
        await interaction.update(panel).catch(() => null);
        
        const trapChannel = interaction.guild.channels.cache.get(channelId);
        if (trapChannel) {
          const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, EmbedBuilder, MessageFlags } = await import('discord.js');
          
          const container = new ContainerBuilder();
          
          const header = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Athena | Note**`));
            
          container.addSectionComponents(header);
          
          const trapText = `-# **This is trap channel don't send any \`messages\` here \`${timeoutMinutes} minutes timeout will happen\` if you send any \`fucking messages\` here**`;
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trapText));
          
          const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
          
          if (bannerUrl) {
            const embed = new EmbedBuilder().setImage(bannerUrl).setColor(config.accentColor || 0x2b2d31);
            payload.embeds = [embed];
          }
          
          trapChannel.send(payload).catch(() => null);
        }
        return;
      }

        if (interaction.customId === 'accent_modal') {
          const { handleAccentModal } = await import('../commands/accent.js');
          return handleAccentModal(interaction);
        }


      
      if (interaction.customId.startsWith('gw_setup_modal_')) {
        const { gwManagers, buildManagerContainer } = await import('../commands/giveaway.js');
        const ms = (await import('ms')).default;

        const managerId = interaction.customId.replace('gw_setup_modal_', '');
        const cfg = gwManagers.get(managerId);
        
        if (!cfg) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });

        const prize = interaction.fields.getTextInputValue('prize');
        const duration = interaction.fields.getTextInputValue('duration');
        const winners = parseInt(interaction.fields.getTextInputValue('winners')) || 1;

        const durationMs = ms(duration);
        if (!durationMs || durationMs < 10000) {
          return interaction.reply({ content: 'Invalid duration. Examples: 10m, 1h, 1d.', flags: MessageFlags.Ephemeral });
        }

        cfg.prize = prize;
        cfg.duration = duration;
        cfg.durationMs = durationMs;
        cfg.winners = Math.max(1, winners);

        gwManagers.set(managerId, cfg);
        return interaction.update({ components: [buildManagerContainer(managerId)], flags: 1 << 15 });
      }

      if (interaction.customId === 'vc_limit_modal') {
        const limitStr = interaction.fields.getTextInputValue('limit_input');
        const limit = parseInt(limitStr, 10);
        if (isNaN(limit) || limit < 0 || limit > 99) {
          return interaction.reply({ content: 'Invalid limit. Must be a number between 0 and 99.', flags: MessageFlags.Ephemeral });
        }
        
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply({ content: 'You are not in a voice channel.', flags: MessageFlags.Ephemeral });

        // Basic check: Is it a custom VC?
        const j2cConfig = db.getGuildConfig(interaction.guild.id).j2c;
        if (!j2cConfig || vc.parentId !== j2cConfig.categoryId) {
           return interaction.reply({ content: 'You can only manage your own custom voice channel.', flags: MessageFlags.Ephemeral });
        }

        await vc.setUserLimit(limit);
        return interaction.reply({ content: `Channel limit set to ${limit}.`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'vc_name_modal') {
        const newName = interaction.fields.getTextInputValue('name_input');
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply({ content: 'You are not in a voice channel.', flags: MessageFlags.Ephemeral });

        const j2cConfig = db.getGuildConfig(interaction.guild.id).j2c;
        if (!j2cConfig || vc.parentId !== j2cConfig.categoryId) {
           return interaction.reply({ content: 'You can only manage your own custom voice channel.', flags: MessageFlags.Ephemeral });
        }

        await vc.setName(newName);
        return interaction.reply({ content: `Channel renamed to \`${newName}\`.`, flags: MessageFlags.Ephemeral });
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
    
    if (interaction.isModalSubmit()) {
      
      
      if (interaction.customId === "modal_sec_extra_owner") {
          const targetId = interaction.fields.getTextInputValue("target_id");
          const db = (await import("../database.js")).default;
          db.addExtraOwner(interaction.guild.id, targetId);
          return interaction.reply({ content: `Successfully added Extra Owner: <@${targetId}>`, flags: MessageFlags.Ephemeral });
      }
if (interaction.customId === "modal_2fa_setup") {
        const email = interaction.fields.getTextInputValue("2fa_email");
        if (!email.includes("@")) return interaction.reply({ content: "Invalid email format.", flags: MessageFlags.Ephemeral });
        
        const code2fa = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const { send2FACode } = await import("../utils/mailer.js");
          send2FACode(email, code2fa, interaction.guild.name).catch(e => console.log('SMTP Error:', e.message));
          
          const db = (await import("../database.js")).default;
          db.updateGuildConfig(interaction.guild.id, {
            twoFactorEmail: email,
            pendingTwoFactorCode: code2fa,
            twoFactorVerified: false
          });

          
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("btn_verify_2fa").setLabel("Verify Code").setStyle(ButtonStyle.Success)
          );
          return interaction.editReply({ content: "A verification code has been dispatched to **" + email + "** (Check your Pterodactyl console if it doesn't arrive). Click below to enter it.", components: [row] });
        } catch (err) {
          return interaction.editReply({ content: "Failed to send email: " + err.message });
        }
      }
      
              if (interaction.customId === "btn_intercept_2fa") {
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import("discord.js");
            const modal = new ModalBuilder()
                .setCustomId("modal_2fa_verify")
                .setTitle("Two-Factor Authentication");
            const codeInput = new TextInputBuilder()
                .setCustomId("2fa_code")
                .setLabel("Enter the 6-digit code sent to your email")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(6)
                .setMinLength(6);
            const row = new ActionRowBuilder().addComponents(codeInput);
            modal.addComponents(row);
            return interaction.showModal(modal);
        }

        if (interaction.customId === "modal_2fa_verify") {
        const inputCode = interaction.fields.getTextInputValue("2fa_code");
        const db = (await import("../database.js")).default;
        const config = db.getGuildConfig(interaction.guild.id);
        
        if (config.pendingTwoFactorCode && config.pendingTwoFactorCode === inputCode) {
          db.updateGuildConfig(interaction.guild.id, {
            twoFactorVerified: true,
            pendingTwoFactorCode: null
          });
          
          return interaction.reply({ content: "? **Gmail 2FA Successfully Configured!** Your server is now heavily protected.", flags: MessageFlags.Ephemeral });
        } else {
          return interaction.reply({ content: "? Incorrect verification code.", flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.customId === "modal_2fa_intercept") {
        const inputCode = interaction.fields.getTextInputValue("2fa_code");
        const db = (await import("../database.js")).default;
        const config = db.getGuildConfig(interaction.guild.id);
        
        if (config.pendingTwoFactorCode && config.pendingTwoFactorCode === inputCode) {
           db.updateGuildConfig(interaction.guild.id, { pendingTwoFactorCode: null });
           
           const sec = await import("../commands/security.js");
           if (sec.executeInterceptedAction) {
             return sec.executeInterceptedAction(interaction);
           } else {
             return interaction.reply({ content: "? Code verified. You may proceed.", flags: MessageFlags.Ephemeral });
           }
        } else {
           return interaction.reply({ content: "? Incorrect 2FA code. Action permanently blocked.", flags: MessageFlags.Ephemeral });
        }
      }
    }

    
    
    
    
    if (interaction.isButton() || interaction.isAnySelectMenu()) {


      if (interaction.customId === 'ytstats_refresh') {
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const { forceUpdateYtStats } = await import('../utils/ytStatsEngine.js');
        try {
          await forceUpdateYtStats(interaction.guild);
          return interaction.editReply({ content: '-# **Forced refresh complete!** Note: If the name did not change, Discord may be rate-limiting the channel.' }).catch(()=>null);
        } catch (e) {
          return interaction.editReply({ content: `-# **Refresh failed:** ${e.message}` }).catch(()=>null);
        }
      }
      if (interaction.customId.startsWith('ytstats_')) {
        const { handleYtStatsButton } = await import('../commands/ytstats.js');
        if (interaction.isButton()) return handleYtStatsButton(interaction);
      }
      if (interaction.customId.startsWith('autorole_')) {

        const { handleAutoRoleButton, handleAutoRoleMenu } = await import('../commands/autorole.js');
        if (interaction.isButton()) return handleAutoRoleButton(interaction);
        if (interaction.isAnySelectMenu()) return handleAutoRoleMenu(interaction);
      }
      if (interaction.customId.startsWith('autoreact_')) {

        const { handleAutoReactButton, handleAutoReactMenu } = await import('../commands/autoreact.js');
        if (interaction.isButton()) return handleAutoReactButton(interaction);
        if (interaction.isAnySelectMenu()) return handleAutoReactMenu(interaction);
      }

      if (interaction.customId.startsWith('calc_')) {
        const { handleCalculatorButton } = await import('../commands/utility.js');
        return handleCalculatorButton(interaction);
      }

      if (interaction.customId.startsWith('autonick_')) {
        const { handleAutonickButton } = await import('../commands/security.js');
        return handleAutonickButton(interaction);
      }
      if (interaction.customId.startsWith('welcmgr_') || interaction.customId.startsWith('leavmgr_')) {
        const { handleWelcomeManagerButton, handleWelcomeManagerMenu } = await import('../commands/welcome.js');
        if (interaction.isButton()) return handleWelcomeManagerButton(interaction);
        if (interaction.isAnySelectMenu()) return handleWelcomeManagerMenu(interaction);
      }

        if (interaction.customId.startsWith('accent_') && !interaction.isModalSubmit()) {
          const { handleAccentButton } = await import('../commands/accent.js');
          return handleAccentButton(interaction);
        }


      // GIVEAWAY MANAGER HANDLERS
      if (interaction.customId.startsWith('gw_mode_') || interaction.customId.startsWith('gw_setup_') || interaction.customId.startsWith('gw_start_') || interaction.customId.startsWith('gw_manage_') || interaction.customId.startsWith('gw_end_') || interaction.customId.startsWith('gw_reroll_') || interaction.customId === 'gw_join') {
        const { gwManagers, buildManagerContainer } = await import('../commands/giveaway.js');
        const ms = (await import('ms')).default;
        
        if (interaction.customId === 'gw_join') {
          const messageId = interaction.message.id;
          const gwData = db.getGiveaway(messageId);
          if (!gwData || gwData.ended) return interaction.reply({ content: 'This giveaway is over or invalid!', flags: MessageFlags.Ephemeral });
          
          if (!gwData.participants.includes(interaction.user.id)) {
            gwData.participants.push(interaction.user.id);
            db.saveGiveaway(messageId, gwData);
            
            const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
            originalEmbed.setFooter({ text: `${gwData.participants.length} Entries` });
            await interaction.update({ embeds: [originalEmbed] });
          } else {
            return interaction.reply({ content: 'You have already entered this giveaway!', flags: MessageFlags.Ephemeral });
          }
          return;
        }

        if (interaction.customId.startsWith('gw_end_')) {
          const { endGiveaway } = await import('../commands/giveaway.js');
          const targetMsgId = interaction.customId.replace('gw_end_', '');
          const gwData = db.getGiveaway(targetMsgId);
          if (!gwData || gwData.ended) return interaction.reply({ content: 'Giveaway not found or already ended.', flags: MessageFlags.Ephemeral });
          
          await interaction.reply({ content: 'Ending giveaway...', flags: MessageFlags.Ephemeral });
          await endGiveaway(interaction.client, targetMsgId, gwData);
          return interaction.editReply({ content: 'Giveaway ended successfully!' });
        }

        if (interaction.customId.startsWith('gw_reroll_')) {
          const targetMsgId = interaction.customId.replace('gw_reroll_', '');
          const gwData = db.getGiveaway(targetMsgId);
          if (!gwData || !gwData.ended) return interaction.reply({ content: 'Giveaway not found or is still active. End it first!', flags: MessageFlags.Ephemeral });
          
          const participants = gwData.participants || [];
          if (participants.length === 0) return interaction.reply({ content: 'Nobody entered this giveaway.', flags: MessageFlags.Ephemeral });
          
          const newWinnerId = participants[Math.floor(Math.random() * participants.length)];
          const EMOJI_WINNER = '<a:giveaway:1533844904604864603>';
          
          // Reply publicly in the channel instead of ephemeral
          return interaction.channel.send({ content: `Rerolled the giveaway! The new winner is <@${newWinnerId}>! ${EMOJI_WINNER}` });
        }

        const managerId = interaction.customId.split('_').slice(2).join('_');
        const cfg = gwManagers.get(managerId);

        if (!cfg) {
          return interaction.reply({ content: 'This giveaway manager session has expired.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.user.id !== cfg.hostId) {
          return interaction.reply({ content: 'You are not the host of this manager.', flags: MessageFlags.Ephemeral });
        }

        
        if (interaction.customId.startsWith('gw_manage_')) {
          const allGw = db.getActiveGiveaways() || [];
          const guildGw = allGw.filter(g => g.guildId === interaction.guild.id);
          
          if (guildGw.length === 0) {
            return interaction.reply({ content: 'There are no active or ended giveaways stored in this server.', flags: MessageFlags.Ephemeral });
          }

          const recentGw = guildGw.slice(-25).reverse();

          const options = recentGw.map(gw => {
            return {
              label: gw.prize.length > 50 ? gw.prize.substring(0, 47) + '...' : gw.prize,
              description: `${gw.ended ? 'Ended' : 'Active'} | ${gw.participants?.length || 0} Entries`,
              value: gw.messageId
            };
          });

          const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('gw_manage_select')
              .setPlaceholder('Select a giveaway to manage...')
              .addOptions(options)
          );

          return interaction.reply({ content: 'Select a giveaway from the list below:', components: [selectRow], flags: MessageFlags.Ephemeral });
        }
        
        if (interaction.isStringSelectMenu() && interaction.customId === 'gw_manage_select') {
          const targetMsgId = interaction.values[0];
          const gwData = db.getGiveaway(targetMsgId);
          
          if (!gwData) {
            return interaction.update({ content: 'Giveaway no longer exists in database.', components: [] });
          }

          const embed = new EmbedBuilder()
            .setTitle('Manage Giveaway')
            .setDescription(`Prize: **${gwData.prize}**\nStatus: **${gwData.ended ? 'Ended' : 'Active'}**\nEntries: **${(gwData.participants || []).length}**`)
            .setColor('#5865F2');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gw_end_${targetMsgId}`).setLabel('End Giveaway').setStyle(ButtonStyle.Danger).setDisabled(gwData.ended),
            new ButtonBuilder().setCustomId(`gw_reroll_${targetMsgId}`).setLabel('Reroll Winner').setStyle(ButtonStyle.Secondary).setDisabled(!gwData.ended)
          );

          return interaction.update({ content: '', embeds: [embed], components: [row] });
        }

        
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gw_mode_')) {
          cfg.mode = interaction.values[0];
          gwManagers.set(managerId, cfg);
          return interaction.update({ components: [buildManagerContainer(managerId)], flags: 1 << 15 });
        }

        if (interaction.customId.startsWith('gw_setup_')) {
          const modal = new ModalBuilder()
            .setCustomId(`gw_setup_modal_${managerId}`)
            .setTitle('Giveaway Setup');

          const prizeInput = new TextInputBuilder()
            .setCustomId('prize')
            .setLabel('Prize')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.prize === 'Not Set' ? '' : cfg.prize)
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (e.g. 10m, 1h, 1d)')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.duration === 'Not Set' ? '' : cfg.duration)
            .setRequired(true);

          const winnersInput = new TextInputBuilder()
            .setCustomId('winners')
            .setLabel('Number of Winners')
            .setStyle(TextInputStyle.Short)
            .setValue(cfg.winners.toString())
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(prizeInput),
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(winnersInput)
          );

          return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('gw_start_')) {
          if (cfg.prize === 'Not Set' || cfg.durationMs < 10000) {
            return interaction.reply({ content: 'Please configure the prize and duration first! Minimum duration is 10s.', flags: MessageFlags.Ephemeral });
          }

          const endsAt = Date.now() + cfg.durationMs;
          const endsAtTimestamp = Math.floor(endsAt / 1000);

          const guildConfig = db.getGuildConfig(interaction.guild.id) || {};
          const accentColor = guildConfig.accentColor || '#5865F2';
          
          const EMOJI_HEADER = '<a:emoji_11:1533024044075454464>';
          const EMOJI_JOIN = '<a:emoji_56:1533024028451672257>';

          const gwEmbed = new EmbedBuilder()
            .setDescription(`## ${EMOJI_HEADER} GIVEAWAY ${EMOJI_HEADER}\n\n**Prize:** ${cfg.prize}\n**Ends:** <t:${endsAtTimestamp}:R> (<t:${endsAtTimestamp}:f> IST)\n**Hosted By:** <@${cfg.hostId}>\n**Winners:** ${cfg.winners}\n\nClick the button below to enter!`)
            .setColor(accentColor)
            .setFooter({ text: '0 Entries' })
            .setTimestamp(new Date(endsAt));

          const joinButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('gw_join')
              .setLabel('Join')
              .setStyle(ButtonStyle.Primary)
              .setEmoji(EMOJI_JOIN)
          );

          await interaction.message.delete().catch(() => null);

          const message = await interaction.channel.send({ embeds: [gwEmbed], components: [joinButton] });

          db.saveGiveaway(message.id, {
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            hostId: cfg.hostId,
            prize: cfg.prize,
            winnersCount: cfg.winners,
            endsAt: endsAt,
            mode: cfg.mode,
            participants: []
          });

          gwManagers.delete(managerId);
          return;
        }
      }

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
          return await interaction.reply({ content: 'An error occurred while processing the scanner action.', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
      }

      // VERIFICATION BUTTON
      if (interaction.customId === 'verify_button') {
        const verifyData = db.getVerification(interaction.guild.id);
        if (!verifyData || !verifyData.roleId) {
          return await interaction.reply({ content: '-# **Verification system is not properly configured.**', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
        
        try {
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
             return await interaction.reply({ content: '-# **The verification role no longer exists.**', flags: MessageFlags.Ephemeral }).catch(() => null);
          }
          if (interaction.member.roles.cache.has(verifyData.roleId)) {
             return await interaction.reply({ content: '-# **You are already verified.**', flags: MessageFlags.Ephemeral }).catch(() => null);
          }
          await interaction.member.roles.add(role);
          return await interaction.reply({ content: '-# <:emoji_16:1521464002046328944> **Identity Authenticated! You have been granted access to the server.**', flags: MessageFlags.Ephemeral }).catch(() => null);
        } catch (err) {
          return await interaction.reply({ content: '-# **Failed to assign the verification role. Ensure my role is higher than the verification role.**', flags: MessageFlags.Ephemeral }).catch(() => null);
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
          return interaction.reply({ content: 'This rating session has expired or is invalid.', flags: MessageFlags.Ephemeral }).catch(() => null);
        }

        if (action === 'delete') {
          // Only author or admin can delete
          if (interaction.user.id !== ratingData.authorId && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'You can only remove your own edits!', flags: MessageFlags.Ephemeral }).catch(() => null);
          }
          db.deleteEditRating(interaction.message.id);
          await interaction.message.delete().catch(() => null);
          return interaction.reply({ content: 'Edit rating post removed.', flags: MessageFlags.Ephemeral }).catch(() => null);
        }

        const stars = parseInt(action);
        if (isNaN(stars) || stars < 1 || stars > 5) return interaction.deferUpdate().catch(() => null);

        // Prevent self-rating
        if (interaction.user.id === ratingData.authorId) {
          return interaction.reply({ content: 'You cannot rate your own edit!', flags: MessageFlags.Ephemeral }).catch(() => null);
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
      if (interaction.customId.startsWith('record_stop')) {
          const targetGuildId = interaction.customId.split('_')[2] || interaction.guild?.id;
          if (!targetGuildId) return interaction.reply({ content: 'Cannot determine target server.', flags: 64 });
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
          const result = await stopRecording(targetGuildId);
            if (!result) {
             const emptyContainer = { type: 17, components: [{ type: 10, content: '-# No active recording found for this server.' }] };
             return interaction.message.edit({ components: [emptyContainer] });
          }
          const successContainer = { type: 17, components: [{ type: 10, content: '-# **Audio Export Successful!**' }] };
          await interaction.message.edit({ components: [successContainer] });
          await interaction.followUp({ files: [result.mp3Path] });
            const fs = await import('fs');
            fs.unlink(result.mp3Path, () => {});
        } catch (err) {
          const errContainer = { type: 17, components: [{ type: 10, content: `-# **Recording Stopped:** ${err.message}` }] };
          await interaction.message.edit({ components: [errContainer] });
        }
        return;
      }

      if (interaction.customId.startsWith('record_status')) {
          const targetGuildId = interaction.customId.split('_')[2] || interaction.guild?.id;
          if (!targetGuildId) return interaction.reply({ content: 'Cannot determine target server.', flags: 64 });
        const { getRecordingStatus } = await import('../utils/audioRecorder.js');
        const isActive = getRecordingStatus(targetGuildId);
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
        if (!originalMessageId) return interaction.reply({ content: 'Original message not found.', flags: MessageFlags.Ephemeral });
        
        try {
          const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
          const urlMatch = originalMessage.content.match(/(https?:\/\/[^\s]+)/);
          const url = urlMatch ? urlMatch[0] : null;

          if (!url) return interaction.reply({ content: 'Could not extract URL.', flags: MessageFlags.Ephemeral });

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
        return interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
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
          return interaction.reply({ content: 'Channel Locked.', flags: MessageFlags.Ephemeral });
        }
        if (action === 'unlock') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
          return interaction.reply({ content: 'Channel Unlocked.', flags: MessageFlags.Ephemeral });
        }
        if (action === 'hide') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
          return interaction.reply({ content: 'Channel Hidden.', flags: MessageFlags.Ephemeral });
        }
        if (action === 'unhide') {
          await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
          return interaction.reply({ content: 'Channel Visible.', flags: MessageFlags.Ephemeral });
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
          return interaction.reply({ content: `**Channel Info**\nName: ${vc.name}\nBitrate: ${vc.bitrate / 1000}kbps\nLimit: ${vc.userLimit === 0 ? 'None' : vc.userLimit}\nConnected: ${vc.members.size}`, flags: MessageFlags.Ephemeral });
        }
        if (action === 'claim') {
          const currentOwner = vc.name.split("'s")[0]; 
          // It's a crude check, a real system tracks the owner ID in the DB.
          return interaction.reply({ content: 'Ownership claiming is not yet fully implemented.', flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.isButton() && interaction.customId.startsWith('gen_invite_')) {
        const targetGuildId = interaction.customId.split('_')[2];
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
          return interaction.reply({ content: 'I am no longer in that server.', flags: 64 });
        }
        
        // Find a suitable channel to create an invite
        const channel = targetGuild.channels.cache.find(c => c.type === 0 && c.permissionsFor(targetGuild.members.me).has('CreateInstantInvite'));
        if (!channel) {
          return interaction.reply({ content: 'I do not have permission to create invites in that server, or there are no text channels.', flags: 64 });
        }
        
        try {
          const invite = await channel.createInvite({ maxAge: 86400, maxUses: 1 });
          return interaction.reply({ content: `Here is your invite for **${targetGuild.name}**: ${invite.url}`, flags: 64 });
        } catch (err) {
          console.error(err);
          return interaction.reply({ content: 'Failed to create invite.', flags: 64 });
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
  if (!guild) return;
  const customId = interaction.customId;
  const config = db.getGuildConfig(guild.id);

    if (customId === 'sec_module_manage') {
      try {
        const sec = await import('../commands/security.js');
        const panel = await sec.getAntinukeConfigPanel(guild);
        return interaction.update(panel);
      } catch(e) { console.error(e); }
    }

    
    if (customId === "sec_close_dash") {
      try {
        return interaction.message.delete();
      } catch(e) {}
    }

    if (customId === "sec_rescan_dash") {
      try {
        const sec = await import("../commands/security.js");
        const panel = await sec.getSecureDashboardPanel(guild);
        return interaction.update(panel);
      } catch(e) { console.error(e); }
    }

            if (customId === "sec_extra_owner") {
      const modal = new ModalBuilder().setCustomId("modal_sec_extra_owner").setTitle("Add Extra Owner");
      const input = new TextInputBuilder().setCustomId("target_id").setLabel("User ID to add").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
    
    if (customId === "sec_wl_user" || customId === "sec_wl_role") {
      const { getWhitelistOverviewPanel } = await import("../commands/security.js");
      const panel = await getWhitelistOverviewPanel(interaction.guild);
      return interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
    }

    if (customId === "sec_2fa_gmail") {
      const modal = new ModalBuilder().setCustomId("modal_2fa_setup").setTitle("Configure Gmail 2FA");
      const emailInput = new TextInputBuilder().setCustomId("2fa_email").setLabel("Your Athena Gmail Address").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("admin@gmail.com");
      modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
      return interaction.showModal(modal);
    }

    if (customId === 'sec_close') {
      try {
        return interaction.message.delete();
      } catch(e) { console.error(e); }
    }

    if (['toggle_antinuke', 'toggle_spam', 'toggle_invite', 'cycle_punishment', 'sec_status_back', 'save_panel'].includes(customId)) {
      try {
        let updated = false;
        const updateData = {};
        
        if (customId === 'toggle_antinuke') {
          updateData.antiNukeEnabled = !config.antiNukeEnabled;
          updated = true;
        }
        if (customId === 'toggle_spam') {
          updateData.antiSpamEnabled = !config.antiSpamEnabled;
          updated = true;
        }
        if (customId === 'toggle_invite') {
          updateData.antiInviteEnabled = (config.antiInviteEnabled === true) ? false : true;
          updated = true;
        }
        if (customId === 'cycle_punishment') {
          const current = config.antiNukePunishment || 'ban';
          updateData.antiNukePunishment = current === 'ban' ? 'kick' : current === 'kick' ? 'quarantine' : 'ban';
          updated = true;
        }
        if (customId === 'sec_status_back') {
           const sec = await import('../commands/security.js');
           return interaction.update(await sec.getSecurityStatusPanel(guild));
        }
        if (customId === 'save_panel') {
           return interaction.message.delete();
        }

        if (updated) {
          const db = (await import('../database.js')).default;
          db.updateGuildConfig(guild.id, updateData);
          const sec = await import('../commands/security.js');
          return interaction.update(await sec.getAntinukeConfigPanel(guild));
        }
      } catch (e) { console.error(e); }
    }
    
    if (customId === 'toggle_blacklist_filter') {
        return interaction.reply({ content: 'Use `!blacklist add <word>` to enable the word filter, or `!blacklist remove <word>` to disable it.', flags: MessageFlags.Ephemeral });
    }

  // Security Overview Navigation
  if (customId === 'sec_back') {
    try {
      const sec = await import('../commands/security.js');
      const panel = await sec.getSecurityStatusPanel(guild);
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

  
    if (customId && customId.startsWith('ann_')) {
      try {
        const announce = await import('../commands/announce.js');
        return announce.handleAnnouncementInteractions(interaction);
      } catch (e) { console.error(e); }
    }

    if (customId.startsWith('am_') || customId.startsWith('bp_')) {
      let updated = false;
      let targetRoleForBypass = null;

      if (customId === 'am_tgl_massmention') {
        db.updateGuildConfig(guild.id, { antiSpamMentionEnabled: !config.antiSpamMentionEnabled });
        updated = true;
      }
      else if (customId === 'am_tgl_flood') {
        db.updateGuildConfig(guild.id, { antiFloodEnabled: !(config.antiFloodEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_link') {
        const newVal = !config.antiLinkEnabled;
        const updateData = { antiLinkEnabled: newVal };
        if (newVal) updateData.allowAllLinks = false;
        db.updateGuildConfig(guild.id, updateData);
        updated = true;
      }
      else if (customId === 'am_tgl_invite') {
        const newVal = !config.antiInviteEnabled;
        const updateData = { antiInviteEnabled: newVal };
        if (newVal) updateData.allowInvitesGlobally = false;
        db.updateGuildConfig(guild.id, updateData);
        updated = true;
      }
      else if (customId === 'am_tgl_word') {
        db.updateGuildConfig(guild.id, { wordFilterEnabled: !(config.wordFilterEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_fonts') {
        db.updateGuildConfig(guild.id, { bigFontsEnabled: !(config.bigFontsEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_hiddenurl') {
        db.updateGuildConfig(guild.id, { hiddenUrlEnabled: !(config.hiddenUrlEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_filecheck') {
        db.updateGuildConfig(guild.id, { fileCheckEnabled: !(config.fileCheckEnabled !== false) });
        updated = true;
      }
      else if (customId === 'am_tgl_global_links') {
        const newVal = !config.allowAllLinks;
        const updateData = { allowAllLinks: newVal };
        if (newVal) updateData.antiLinkEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        const { getAdvancedConfigPanel } = await import('../commands/security.js');
        const newPanel = await getAdvancedConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_tgl_selfbot') {
        const current = config.selfbotDetectionEnabled !== false;
        db.updateGuildConfig(guild.id, { selfbotDetectionEnabled: !current });
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_tgl_global_invites') {
        const config = db.getGuildConfig(guildId);
        const newVal = !config.allowInvitesGlobally;
        const updateData = { allowInvitesGlobally: newVal };
        if (newVal) updateData.antiInviteEnabled = false;
        db.updateGuildConfig(guild.id, updateData);
        const { getAdvancedConfigPanel } = await import('../commands/security.js');
        const newPanel = await getAdvancedConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_advanced_configs') {
        const { getAdvancedConfigPanel } = await import('../commands/security.js');
        const newPanel = await getAdvancedConfigPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_back_to_main') {
        const { getAutoModPanel } = await import('../commands/security.js');
        const newPanel = await getAutoModPanel(guild);
        return interaction.update(newPanel).catch(() => null);
      }
      else if (customId === 'am_timeout_cycle') {
        const current = config.honeypotTimeoutMinutes || 15;
        let next = 15;
        if (current === 15) next = 60;
        else if (current === 60) next = 1440;
        else if (current === 1440) next = 5;
        else next = 15;
        db.updateGuildConfig(guild.id, { honeypotTimeoutMinutes: next });
        updated = true;
      }
      else if (customId === 'am_save') {
        return interaction.message.delete().catch(() => null);
      }
      else if (customId === 'am_select_invite_channel') {
        db.updateGuildConfig(guild.id, { inviteAllowedChannel: interaction.values[0] });
        updated = true;
      }
      else if (customId === 'am_select_honeypot_channel') {
        const channelId = interaction.values[0];
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`modal_honeypot_${channelId}`)
          .setTitle('Honeypot Trap Setup');
          
        const bannerInput = new TextInputBuilder()
          .setCustomId('banner_url')
          .setLabel('Banner Image URL (Optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('https://example.com/banner.png');
          
                const timeoutInput = new TextInputBuilder()
          .setCustomId('timeout_minutes')
          .setLabel('Timeout Duration (Minutes)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('15');
          
        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput), new ActionRowBuilder().addComponents(timeoutInput));
        return interaction.showModal(modal);
      }
      else if (customId === 'am_select_granular_role') {
        targetRoleForBypass = interaction.values[0];
        updated = true;
      }
      else if (customId.startsWith('bp_')) {
        const parts = customId.split('_');
        if (parts[1] === 'back') {
          updated = true;
        } else if (parts[1] === 'all') {
          targetRoleForBypass = parts[2];
          const bypasses = config.automodBypasses || {};
          bypasses[targetRoleForBypass] = ['Anti Invite', 'Swear Words', 'URL Filter', 'Spam Filter', 'Mass Mentions', 'Anti Flood', 'Hidden URL Filter', 'Selfbot Detection', 'File Check', 'Big Fonts'];
          db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
          updated = true;
        } else if (parts[1] === 'reset') {
            targetRoleForBypass = parts[2];
            const bypasses = config.automodBypasses || {};
            bypasses[targetRoleForBypass] = [];
            db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
            updated = true;
          } else if (parts[1] === 'save') {
            targetRoleForBypass = parts[2];
            const bypasses = config.automodBypasses || {};
            const roleBypasses = bypasses[targetRoleForBypass] || [];
            const filterStr = roleBypasses.length >= 10 ? 'All Automoderation Events' : (roleBypasses.length > 0 ? roleBypasses.join(', ') : 'None');
            
            await interaction.message.delete().catch(() => null);
            
            const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = await import('discord.js');
            const c = new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`-# > **[${interaction.member?.displayName || interaction.user.displayName || interaction.user.username}](https://discord.com/users/${interaction.user.id})** Has Bypass **${filterStr}** For <@&${targetRoleForBypass}>`)
            );
            return interaction.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
          } else {
          const filterName = parts[1];
          targetRoleForBypass = parts[2];
          const bypasses = config.automodBypasses || {};
          if (!bypasses[targetRoleForBypass]) bypasses[targetRoleForBypass] = [];
          
          if (bypasses[targetRoleForBypass].includes(filterName)) {
            bypasses[targetRoleForBypass] = bypasses[targetRoleForBypass].filter(f => f !== filterName);
          } else {
            bypasses[targetRoleForBypass].push(filterName);
          }
          db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
          updated = true;
        }
      }

      if (updated) {
        try {
          const sec = await import('../commands/security.js');
          let panel;
          if (targetRoleForBypass) {
            panel = await sec.getGranularBypassPanel(guild, targetRoleForBypass);
          } else {
            panel = await sec.getAutoModPanel(guild);
          }
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
    return interaction.reply({ content: 'Invalid limit. Please enter a valid positive number.', flags: MessageFlags.Ephemeral });
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




