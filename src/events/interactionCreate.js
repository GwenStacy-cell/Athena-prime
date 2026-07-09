import { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { buildXpDashboard } from '../commands/leveling.js';
import commandMap from '../commands/loader.js';
import embed, { setGuildContext } from '../embed.js';
import db from '../database.js';
import { getAntinukeConfigPanel } from '../commands/security.js';
import { handleEnukeButton, handleEnukeModal } from '../commands/enuke.js';
import { handleSpamModal, handleSpamMoreButton } from '../commands/spam.js';
import { isBotOwnerSync, canModerate, isExtraOwner, isBotOwnerOrServerOwnerStrict } from '../utils/helpers.js';
import { handleJtcSelectMenu, handleJtcModal } from '../commands/jtc.js';
import { handleWelcomeManagerButton, handleWelcomeManagerModal, handleWelcomeManagerMenu } from '../commands/welcome.js';
import { handleAccentButton, handleAccentModal } from '../commands/accent.js';
import { convertMp4ToGif, uploadGifToDiscord } from '../utils/mediaConverter.js';
import fetch from 'node-fetch';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.user && db.isUserBotBlacklisted(interaction.user.id)) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: 'You have been globally blacklisted from using Athena Prime commands.', ephemeral: true }).catch(() => null);
      }
      return;
    }

    // ==========================================
    // 1. CHAT INPUT SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
      // Set guild accent context for all embed calls in this command
      if (interaction.guild) setGuildContext(interaction.guild.id);

      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) {
        return interaction.reply({
          embeds: [embed.warn('Unknown Command', `${interaction.user}  The command \`/${interaction.commandName}\` was not recognized.\n\nUse \`/help\` to see all available commands.`)],
          ephemeral: true
        });
      }

      // Verify permissions — bot owner AND extra owners bypass all checks in every server
      if (cmd.permissions && cmd.permissions.length > 0) {
        const isBypass = isBotOwnerSync(interaction.user.id) ||
          (interaction.guild && (
            interaction.user.id === interaction.guild.ownerId ||
            db.isExtraOwner(interaction.guild.id, interaction.user.id)
          ));

        if (!isBypass) {
          // interaction.member may be null in User App DM context — skip guild perm check
          const hasPerms = interaction.member
            ? cmd.permissions.every(perm => interaction.member.permissions.has(perm))
            : false;
          if (!hasPerms) {
            return interaction.reply({
              embeds: [embed.danger('Access Denied', `${interaction.user}  You do not possess the required permissions to execute this command.\n\n**Required:** ${cmd.permissions.map(p => `\`${Object.entries(PermissionFlagsBits).find(([, v]) => v === p)?.[0] || 'Unknown'}\``).join(', ')}`)],
              ephemeral: true
            });
          }
        }
      }

      try {
        await cmd.executeSlash(interaction);
      } catch (error) {
        console.error(`Error executing command ${cmd.name} via Slash:`, error);
        const errEmbed = embed.danger(
          'Execution Error', 
          `${interaction.user} An unexpected error occurred while executing \`/${cmd.name}\`.\n\n**Tip:** Check that all required options are filled in correctly. Use \`/help\` for command usage.`
        );

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        }
      }
      return;
    }

    // ==========================================
    // 1.5. AUTOCOMPLETE
    // ==========================================
    if (interaction.isAutocomplete()) {
      const cmd = commandMap.get(interaction.commandName);
      if (cmd && cmd.autocomplete) {
        try {
          await cmd.autocomplete(interaction);
        } catch (error) {
          console.error(`Error executing autocomplete for ${cmd.name}:`, error);
        }
      }
      return;
    }

    // ==========================================
    // 2. MODAL SUBMISSIONS
    // ==========================================
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('music_lyrics_modal')) {
        const songName = interaction.fields.getTextInputValue('song_name');
        if (!songName) return interaction.reply({ content: 'You must provide a song name.', ephemeral: true });

        const vc = interaction.member.voice?.channel;
        if (!vc) {
          return interaction.reply({ content: 'You must be in a Voice Channel to request lyrics.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          let lyrics = null;
          let trackName = songName;
          let artistName = 'Unknown Artist';

          try {
            const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(songName)}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0 && data[0].plainLyrics) {
                let fetchedLyrics = data[0].plainLyrics;
                // Heuristic: If it's a giant wall of text with no stanza breaks, format it nicely
                if (!fetchedLyrics.includes('\n\n') && fetchedLyrics.split('\n').length > 8) {
                  const lines = fetchedLyrics.split('\n');
                  const formattedLines = [];
                  for (let i = 0; i < lines.length; i++) {
                    formattedLines.push(lines[i]);
                    if ((i + 1) % 4 === 0) formattedLines.push('');
                  }
                  fetchedLyrics = formattedLines.join('\n');
                }
                lyrics = fetchedLyrics;
                trackName = data[0].trackName;
                artistName = data[0].artistName;
              }
            }
          } catch(e) {}

          if (!lyrics) {
            try {
              const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(songName + " lyrics genius")}`;
              const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
              const searchHtml = await searchRes.text();
              const cheerio = await import('cheerio');
              const $ = cheerio.load(searchHtml);
              
              let geniusUrl = null;
              $('a.result__url').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('genius.com')) {
                  const match = href.match(/uddg=([^&]+)/);
                  if (match) {
                    geniusUrl = decodeURIComponent(match[1]);
                    return false;
                  }
                }
              });

              if (geniusUrl) {
                const lyricsRes = await fetch(geniusUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
                const lyricsHtml = await lyricsRes.text();
                const $$ = cheerio.load(lyricsHtml);
                
                let scraped = '';
                $$('[data-lyrics-container="true"]').each((i, el) => {
                  $$(el).find('br').replaceWith('\n');
                  scraped += $$(el).text() + '\n\n';
                });
                
                if (scraped.trim()) {
                  lyrics = scraped.trim();
                  artistName = 'Genius Lyrics';
                }
              }
            } catch (e) {
              console.error("Genius scraper fallback failed:", e);
            }
          }

          if (!lyrics) {
            return interaction.editReply({ embeds: [embed.danger('Lyrics Not Found', `Could not find any lyrics for **${songName}**.`)] });
          }

          const cfg = db.getGuildConfig(interaction.guildId);
          const accentColor = cfg?.accentColor || '#2b2d31';

          const chunks = [];
          for (let i = 0; i < lyrics.length; i += 4000) {
            chunks.push(lyrics.substring(i, i + 4000));
          }

          for (let i = 0; i < chunks.length; i++) {
            const lyricsEmbed = embed.build({
              title: i === 0 ? `Lyrics: ${trackName}` : `Lyrics: ${trackName} (Part ${i + 1})`,
              description: chunks[i],
              author: { name: artistName },
              color: accentColor
            });
            await vc.send({ embeds: [lyricsEmbed] });
          }

          return interaction.editReply({ content: `<:emoji_16:1521464002046328944> Lyrics sent to <#${vc.id}>!` });

        } catch (error) {
          console.error('Lyrics error:', error);
          return interaction.editReply({ embeds: [embed.error('Error', 'An error occurred while fetching the lyrics.')] });
        }
      }

      if (interaction.customId === 'autonick_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        
        const layout = interaction.fields.getTextInputValue('layout') || '{name}';
        
        if (!layout.includes('{name}')) {
          return interaction.reply({ content: 'Your layout must include the `{name}` placeholder!', ephemeral: true });
        }
        
        let cfg = db.getGuildConfig(interaction.guild.id);
        if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
        
        // Extract prefix and suffix to preserve backward compatibility with the database and helpers
        const parts = layout.split('{name}');
        cfg.autonick.prefix = parts[0] || '';
        cfg.autonick.suffix = parts[1] || '';
        cfg.autonick.layout = layout;
        db.updateGuildConfig(interaction.guild.id, { autonick: cfg.autonick });
        
        const { buildAutonickDashboard } = await import('../commands/security.js');
        const payload = await buildAutonickDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      // Enuke Manager modal
      if (interaction.customId.startsWith('enuke_modal_')) {
        try {
          await handleEnukeModal(interaction);
        } catch (error) {
          console.error('Error handling Enuke modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' An error occurred during the nuke sequence.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Spam modal
      if (interaction.customId.startsWith('spam_modal_')) {
        try {
          await handleSpamModal(interaction);
        } catch (error) {
          console.error('Error handling Spam modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' An error occurred with the spam command.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // JTC modals
      if (interaction.customId.startsWith('jtc_') && interaction.customId.endsWith('_modal')) {
        try {
          await handleJtcModal(interaction);
        } catch (error) {
          console.error('Error handling JTC modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' An error occurred with the voice channel action.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Welcome/Leave modals
      if (interaction.customId.startsWith('welc_modal_') || interaction.customId.startsWith('leav_modal_')) {
        try {
          await handleWelcomeManagerModal(interaction);
        } catch (error) {
          console.error('Error handling Welcome modal:', error);
        }
        return;
      }

      // Accent hex modal
      if (interaction.customId === 'accent_hex_modal') {
        try {
          await handleAccentModal(interaction);
        } catch (error) {
          console.error('Error handling Accent modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' Failed to apply accent color.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }
      // Announcement Manager Modals
      if (interaction.customId === 'ann_text_modal') {
        try {
          let title = null;
          try { title = interaction.fields.getTextInputValue('ann_title'); } catch {}
          
          let desc = null;
          try { desc = interaction.fields.getTextInputValue('ann_desc'); } catch {}
          
          const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
          if (title !== null) oldEmbed.setTitle(title.slice(0, 256) || 'New Announcement');
          if (desc !== null) oldEmbed.setDescription(desc || 'No description provided.');

          await interaction.update({ embeds: [oldEmbed] }).catch(() => null);
        } catch (err) {
          console.error('Ann text modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'ann_media_modal') {
        try {
          await interaction.deferUpdate().catch(() => null);
          
          let img = null;
          try { img = interaction.fields.getTextInputValue('ann_image'); } catch {}
          
          let thumb = null;
          try { thumb = interaction.fields.getTextInputValue('ann_thumb'); } catch {}
          
          const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
          
          async function resolveTenor(url) {
            if (url && url.includes('tenor.com/view/')) {
              try {
                const res = await fetch(url);
                const text = await res.text();
                const match = text.match(/content="([^"]+media\.tenor\.com[^"]+\.gif)"/i);
                if (match) return match[1];
              } catch { }
            }
            return url;
          }
          
          if (img !== null) {
            let imgUrl = await resolveTenor(img);
            if (imgUrl && imgUrl.toLowerCase().endsWith('.mp4')) {
              try {
                const gifBuffer = await convertMp4ToGif(imgUrl);
                imgUrl = await uploadGifToDiscord(interaction, gifBuffer, 'large_image.gif');
              } catch (err) {
                console.error('Ann media modal img convert error:', err);
              }
            }
            try { oldEmbed.setImage(imgUrl || null); } catch { /* Ignore invalid URL */ }
          }
          
          if (thumb !== null) {
            let thumbUrl = await resolveTenor(thumb);
            if (!thumbUrl) {
              // Default to bot's avatar if left blank
              oldEmbed.setThumbnail(interaction.guild.members.me.displayAvatarURL({ dynamic: true, size: 512 }));
            } else {
              if (thumbUrl.toLowerCase().endsWith('.mp4')) {
                try {
                  const gifBuffer = await convertMp4ToGif(thumbUrl);
                  thumbUrl = await uploadGifToDiscord(interaction, gifBuffer, 'thumbnail.gif');
                } catch (err) {
                  console.error('Ann media modal thumb convert error:', err);
                }
              }
              try { oldEmbed.setThumbnail(thumbUrl); } catch { /* Ignore invalid URL */ }
            }
          }

          await interaction.editReply({ embeds: [oldEmbed] }).catch(() => null);
        } catch (err) {
          console.error('Ann media modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'ann_channel_modal') {
        try {
          let chanInput = '';
          try { chanInput = interaction.fields.getTextInputValue('ann_channel'); } catch {}
          
          const channelId = chanInput.replace(/[^0-9]/g, '');
          
          if (!channelId) {
            return interaction.reply({ content: 'Invalid channel ID provided.', ephemeral: true });
          }

          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) {
            return interaction.reply({ content: 'I could not find that channel in this server.', ephemeral: true });
          }

          const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
          oldEmbed.setFooter({ text: `Target Channel: ${channel.id}` });
          await interaction.update({ embeds: [oldEmbed] }).catch(() => null);
        } catch (err) {
          console.error('Ann channel modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'xp_announce_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        try {
          const chanInput = interaction.fields.getTextInputValue('xp_channel_id');
          const channelId = chanInput.replace(/[^0-9]/g, '');
          
          if (!channelId) return interaction.reply({ content: 'Invalid channel ID.', ephemeral: true });
          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) return interaction.reply({ content: 'I could not find that channel in this server.', ephemeral: true });

          const system = db.getXpSystem(interaction.guild.id);
          system.announceChannelId = channel.id;
          db.setXpSystem(interaction.guild.id, system);
          
          const payload = await buildXpDashboard(interaction.guild.id);
          return interaction.update(payload).catch(() => null);
        } catch (err) {
          console.error('XP announce modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'xp_cmd_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        try {
          const chanInput = interaction.fields.getTextInputValue('xp_channel_id');
          const channelId = chanInput.replace(/[^0-9]/g, '');
          
          if (!channelId) return interaction.reply({ content: 'Invalid channel ID.', ephemeral: true });
          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) return interaction.reply({ content: 'I could not find that channel in this server.', ephemeral: true });

          const system = db.getXpSystem(interaction.guild.id);
          system.cmdChannelId = channel.id;
          db.setXpSystem(interaction.guild.id, system);
          
          const payload = await buildXpDashboard(interaction.guild.id);
          return interaction.update(payload).catch(() => null);
        } catch (err) {
          console.error('XP cmd modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => null);
        }
        return;
      }
    }

    // ==========================================
    // 3. INTERACTIVE COMPONENT BUTTON CLICKS
    // ==========================================
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      // Global Server Invite Generator (Bot Owner DM)
      if (interaction.customId.startsWith('gen_invite_')) {
        const targetGuildId = interaction.customId.replace('gen_invite_', '');
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        if (!targetGuild) return interaction.reply({ content: 'I am no longer in that server or it is not cached.', ephemeral: true });
        
        try {
          const channels = await targetGuild.channels.fetch();
          const textChannel = channels.find(c => c && c.type === 0 && c.permissionsFor(interaction.client.user.id)?.has(PermissionFlagsBits.CreateInstantInvite));
          if (!textChannel) return interaction.reply({ content: 'Could not find a text channel where I have permission to create invites.', ephemeral: true });
          
          const invite = await textChannel.createInvite({ maxAge: 86400, maxUses: 1, reason: 'Requested by Bot Owner' });
          return interaction.reply({ content: `Here is your invite to **${targetGuild.name}**:\n${invite.url}`, ephemeral: true });
        } catch (err) {
          console.error('Invite gen error:', err);
          return interaction.reply({ content: 'An error occurred while generating the invite.', ephemeral: true });
        }
      }

      // Edit Rating Buttons
      if (interaction.customId.startsWith('rate_edit_')) {
        const messageId = interaction.message.id;
        const action = interaction.customId.replace('rate_edit_', '');
        
        const ratingData = db.getEditRating(messageId);
        if (!ratingData) {
          return interaction.reply({ content: 'Rating data for this edit is no longer available.', ephemeral: true });
        }

        if (action === 'delete') {
          if (interaction.user.id !== ratingData.authorId && (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))) {
            return interaction.reply({ content: 'Only the original poster or a moderator can remove this edit.', ephemeral: true });
          }
          await interaction.message.delete().catch(() => null);
          db.deleteEditRating(messageId);
          return interaction.reply({ content: 'Edit rating message removed.', ephemeral: true });
        }

        const starCount = parseInt(action);
        if (isNaN(starCount) || starCount < 1 || starCount > 5) return;

        // Ensure single vote
        if (ratingData.votes[interaction.user.id]) {
          return interaction.reply({ content: 'You have already rated this edit!', ephemeral: true });
        }

        db.updateEditRating(messageId, interaction.user.id, interaction.user.username, starCount);
        
        const updatedRatingData = db.getEditRating(messageId);
        const votes = Object.values(updatedRatingData.votes);
        const totalVotes = votes.length;
        const sumStars = votes.reduce((acc, curr) => acc + curr.stars, 0);
        const avgStars = totalVotes > 0 ? (sumStars / totalVotes).toFixed(1) : '0.0';

        const recentVotes = Object.entries(updatedRatingData.votes).slice(-15);
        let userRatingsStr = recentVotes.map(([uId, v]) => `${v.name}: ${'<a:1z:1517089474369032253>'.repeat(v.stars)}`).join('\n');
        if (!userRatingsStr) userRatingsStr = '_No ratings yet_';

        const guildConfig = interaction.guild ? db.getGuildConfig(interaction.guild.id) : null;
        const updatedEmbed = embed.build({
          title: `Rate ${updatedRatingData.authorName}'s Edit`,
          description: `<a:1z:1517089474369032253> **Current Rating**\n${avgStars}/5 (${totalVotes} vote${totalVotes !== 1 ? 's' : ''})\n\n**User Ratings**\n${userRatingsStr}`,
          color: guildConfig?.accentColor || '#2b2d31'
        });

        await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);
        return interaction.reply({ content: `You rated this edit ${starCount} <a:1z:1517089474369032253>`, ephemeral: true });
      }


      // --- SCANSERVER INTERACTIONS ---
      if (interaction.customId === 'scanserver_ban' && interaction.isStringSelectMenu()) {
         if (!isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild) && !isExtraOwner(interaction.guild.id, interaction.user.id)) {
           return interaction.reply({ content: 'Permission Denied.', ephemeral: true });
         }
         const botId = interaction.values[0];
         try {
           await interaction.guild.members.ban(botId, { reason: 'Unauthorized Bot (Scan Server)' });
           await interaction.reply({ content: `Successfully banned bot <@${botId}>.`, ephemeral: true });
         } catch(e) {
           await interaction.reply({ content: `Failed to ban bot: ${e.message}`, ephemeral: true });
         }
      }
      if (interaction.customId === 'scanserver_banall' && interaction.isButton()) {
         if (!isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild) && !isExtraOwner(interaction.guild.id, interaction.user.id)) {
           return interaction.reply({ content: 'Permission Denied.', ephemeral: true });
         }
         await interaction.deferReply({ ephemeral: true });
         const config = db.getGuildConfig(interaction.guild.id);
         const whitelistedIds = config.botWhitelist || [];
         const allBots = interaction.guild.members.cache.filter(m => m.user.bot);
         let count = 0;
         for (const bot of allBots.values()) {
           if (!whitelistedIds.includes(bot.id) && bot.id !== interaction.client.user.id) {
             try {
               await interaction.guild.members.ban(bot.id, { reason: 'Unauthorized Bot (Scan Server Mass Ban)' });
               count++;
             } catch(e) {}
           }
         }
         await interaction.editReply({ content: `Successfully banned ${count} unauthorized bots.` });
      }

      // Autonick Manager Buttons
      if (interaction.customId === 'autonick_toggle') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        let cfg = db.getGuildConfig(interaction.guild.id);
        if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
        
        cfg.autonick.enabled = !cfg.autonick.enabled;
        db.updateGuildConfig(interaction.guild.id, { autonick: cfg.autonick });
        
        const { buildAutonickDashboard } = await import('../commands/security.js');
        const payload = await buildAutonickDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'autonick_edit') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        
        let cfg = db.getGuildConfig(interaction.guild.id);
        const currentLayout = cfg.autonick?.layout || '{name}';

        const modal = new ModalBuilder()
          .setCustomId('autonick_modal')
          .setTitle('Edit Autonick Layout');
          
        const layoutInput = new TextInputBuilder()
          .setCustomId('layout')
          .setLabel('Layout Style (use {name} for username)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Dev {name} | VIP')
          .setValue(currentLayout)
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(layoutInput);
        modal.addComponents(row1);
        
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'autonick_sync') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        let cfg = db.getGuildConfig(interaction.guild.id);
        if (!cfg.autonick?.enabled) {
          return interaction.reply({ content: 'You must enable Autonick before syncing.', ephemeral: true });
        }
        
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply({ embeds: [embed.info('Autonick Sync', 'Starting sync across all members. This may take a moment...')] }).catch(() => null);
        
        const { applyAutonick } = await import('../utils/helpers.js');
        await interaction.guild.members.fetch();
        
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;
        
        for (const [id, member] of interaction.guild.members.cache) {
          if (isBotOwnerSync(id)) {
            skippedCount++;
            continue;
          }
          const changed = await applyAutonick(member, cfg.autonick);
          if (changed) {
            successCount++;
            if (successCount % 15 === 0) {
              await interaction.editReply({ embeds: [embed.info('Autonick Sync', `Syncing in progress...\n\n Renamed: **${successCount}**\n Failed/Skipped: **${failCount}**`)] }).catch(() => null);
            }
          } else {
            failCount++;
          }
        }
        
        return interaction.editReply({ embeds: [embed.success('Autonick Sync Complete', `Successfully renamed **${successCount}** members.\nSkipped/Failed: **${failCount}**\nBot Owners Ignored: **${skippedCount}**`)] }).catch(() => null);
      }

      if (interaction.customId === 'autonick_restore') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply({ embeds: [embed.info('Restoring Names', 'Starting to restore all nicknames to original Discord usernames...')] }).catch(() => null);
        await interaction.guild.members.fetch();
        
        let successCount = 0;
        let failCount = 0;
        
        for (const [id, member] of interaction.guild.members.cache) {
          if (isBotOwnerSync(id) || !member.nickname) continue;
          
          try {
            await member.setNickname(null);
            successCount++;
            if (successCount % 15 === 0) {
              await interaction.editReply({ embeds: [embed.info('Restoring Names', `Restore in progress...\n\n Restored: **${successCount}**\n Failed: **${failCount}**`)] }).catch(() => null);
            }
          } catch(e) {
            failCount++;
          }
        }
        
        return interaction.editReply({ embeds: [embed.success('Names Restored', `Successfully restored **${successCount}** members to their original Discord usernames.\nSkipped/Failed: **${failCount}**`)] }).catch(() => null);
      }

      // XP Manager Buttons
      if (interaction.customId === 'xp_toggle') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const system = db.getXpSystem(interaction.guild.id);
        system.enabled = !system.enabled;
        db.setXpSystem(interaction.guild.id, system);
        const payload = await buildXpDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'xp_clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const system = db.getXpSystem(interaction.guild.id);
        system.roleRewards = {};
        system.multipliers = {};
        system.announceChannelId = null;
        system.cmdChannelId = null;
        db.setXpSystem(interaction.guild.id, system);
        const payload = await buildXpDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'xp_save') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const payload = await buildXpDashboard(interaction.guild.id);
        // Turn embed green to indicate save
        payload.embeds[0].data.color = 0x2ECC71;
        payload.embeds[0].data.description = '** XP Setup Saved & Locked!**\n\n' + payload.embeds[0].data.description;
        // Disable components
        payload.components.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'xp_set_announce') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('xp_announce_modal').setTitle('Set Announce Channel');
        const chanInput = new TextInputBuilder()
          .setCustomId('xp_channel_id')
          .setLabel('Channel ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(chanInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'xp_set_cmd') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('xp_cmd_modal').setTitle('Set Command Channel');
        const chanInput = new TextInputBuilder()
          .setCustomId('xp_channel_id')
          .setLabel('Channel ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(chanInput));
        return interaction.showModal(modal);
      }

      // Announcement Builder Buttons
      if (interaction.customId === 'ann_edit_text') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('ann_text_modal').setTitle('Edit Content');
        
        const currentEmbed = interaction.message.embeds[0];
        
        const titleInput = new TextInputBuilder()
          .setCustomId('ann_title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(256)
          .setRequired(false)
          .setValue(currentEmbed?.title || '');
          
        const descInput = new TextInputBuilder()
          .setCustomId('ann_desc')
          .setLabel('Description (Supports Links/Newlines)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(currentEmbed?.description || '');
          
        modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === 'ann_edit_media') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('ann_media_modal').setTitle('Edit Media');
        
        const currentEmbed = interaction.message.embeds[0];
        
        const imgInput = new TextInputBuilder()
          .setCustomId('ann_image')
          .setLabel('Large Image URL (Supports GIF)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(currentEmbed?.image?.url || '');
          
        const thumbInput = new TextInputBuilder()
          .setCustomId('ann_thumb')
          .setLabel('Thumbnail URL (Supports GIF)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(currentEmbed?.thumbnail?.url || '');
          
        modal.addComponents(new ActionRowBuilder().addComponents(imgInput), new ActionRowBuilder().addComponents(thumbInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === 'ann_edit_channel') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('ann_channel_modal').setTitle('Set Target Channel');
        
        const chanInput = new TextInputBuilder()
          .setCustomId('ann_channel')
          .setLabel('Channel ID or #Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 123456789012345678 or #announcements');
          
        modal.addComponents(new ActionRowBuilder().addComponents(chanInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === 'ann_publish') {
        const currentEmbed = interaction.message.embeds[0];
        const footerText = currentEmbed?.footer?.text || '';
        const channelIdMatch = footerText.match(/Target Channel: (\d+)/);
        
        if (!channelIdMatch) {
          return interaction.reply({ content: 'You must set a Target Channel before publishing!', ephemeral: true });
        }
        
        const channelId = channelIdMatch[1];
        const targetChannel = interaction.guild.channels.cache.get(channelId);
        
        if (!targetChannel) {
          return interaction.reply({ content: 'The selected target channel no longer exists.', ephemeral: true });
        }
        
        const finalEmbed = EmbedBuilder.from(currentEmbed);
        // Remove the builder specific author and footer
        finalEmbed.setAuthor(null);
        finalEmbed.setFooter(null);
        
        try {
          await targetChannel.send({ embeds: [finalEmbed] });
          await interaction.reply({ content: `Announcement published seamlessly to <#${channelId}>!`, ephemeral: true });
          await interaction.message.delete().catch(() => null); // Clean up the builder
        } catch (err) {
          console.error('Publish error:', err);
          return interaction.reply({ content: 'I lack permissions to post in that channel.', ephemeral: true });
        }
        return;
      }
      // Set guild accent context for all embed calls in this button handler
      if (interaction.guild) setGuildContext(interaction.guild.id);
      // Enuke Manager button
      if (interaction.customId.startsWith('enuke_open_manager_')) {
        try {
          await handleEnukeButton(interaction);
        } catch (error) {
          console.error('Error handling Enuke button:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' Failed to open Enuke Manager.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Verify Button
      if (interaction.customId === 'verify_button') {
        try {
          const verifyData = db.getVerification(interaction.guild.id);
          if (!verifyData || !verifyData.roleId) {
            return interaction.reply({ content: 'The verification system is currently disabled or improperly configured.', ephemeral: true });
          }
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
            return interaction.reply({ content: 'The verification role no longer exists on this server!', ephemeral: true });
          }
          
          // Ensure we have a full GuildMember object, not an APIInteractionGuildMember
          const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) {
            return interaction.reply({ content: 'Could not resolve your server profile.', ephemeral: true });
          }

          if (member.roles.cache.has(role.id)) {
            return interaction.reply({ content: 'You are already verified!', ephemeral: true });
          }
          
          await member.roles.add(role);
          return interaction.reply({ content: `<a:emoji_18:1517214419996643509> You have been successfully verified! Access granted.`, ephemeral: true });
        } catch (err) {
          console.error('Verify error:', err);
          return interaction.reply({ content: 'I do not have permission to assign the verification role. Please contact an admin.', ephemeral: true }).catch(() => null);
        }
      }

      // Ticket Open Button
      if (interaction.customId === 'ticket_open') {
        try {
          const ticketConfig = db.getTickets(interaction.guild.id);
          if (!ticketConfig || !ticketConfig.categoryId) {
            return interaction.reply({ content: 'The ticket system is not fully configured.', ephemeral: true });
          }

          const category = interaction.guild.channels.cache.get(ticketConfig.categoryId);
          if (!category) {
            return interaction.reply({ content: 'The ticket category could not be found.', ephemeral: true });
          }

          // Ensure activeTickets is an object
          const activeTickets = ticketConfig.activeTickets || {};

          // Check if user already has an active ticket
          for (const [tId, ticket] of Object.entries(activeTickets)) {
            if (ticket.ownerId === interaction.user.id) {
              return interaction.reply({ content: `You already have an open ticket in <#${ticket.textId}>!`, ephemeral: true });
            }
          }

        await interaction.deferReply({ ephemeral: true });

        try {
          const permissionOverwrites = [
            {
              id: interaction.guild.id, // @everyone
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id, // Ticket creator
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
            },
            {
              id: interaction.client.user.id, // Bot
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
            }
          ];

          if (ticketConfig.staffRoleId) {
            permissionOverwrites.push({
              id: ticketConfig.staffRoleId, // Staff
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
            });
          }

          // Create Text Channel
          const textChannel = await interaction.guild.channels.create({
            name: `�-ticket-${interaction.user.username}`,
            type: 0, // GUILD_TEXT
            parent: category.id,
            permissionOverwrites
          });

          // Create Voice Channel
          const voiceChannel = await interaction.guild.channels.create({
            name: `� Ticket Voice`,
            type: 2, // GUILD_VOICE
            parent: category.id,
            permissionOverwrites
          });

          const ticketId = db.createTicket(interaction.guild.id, textChannel.id, voiceChannel.id, interaction.user.id);

          const ticketEmbed = embed.info(
            `Ticket #${ticketId}`,
            `Welcome ${interaction.user}!\n\nA staff member will be with you shortly. You have a dedicated text channel here, and a dedicated voice channel: <#${voiceChannel.id}>.\n\nClick the button below to close this ticket.`
          );

          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
          const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_close_${ticketId}`)
              .setLabel('Close Ticket')
              .setEmoji('<a:emoji_106:1517212811678453942>')
              .setStyle(ButtonStyle.Danger)
          );

          await textChannel.send({
            content: ticketConfig.staffRoleId ? `<@&${ticketConfig.staffRoleId}>` : undefined,
            embeds: [ticketEmbed],
            components: [closeRow]
          });

          return interaction.editReply({ content: `Your ticket has been created: <#${textChannel.id}>` });
        } catch (err) {
          console.error('Error creating ticket:', err);
          return interaction.editReply({ content: 'An error occurred while trying to create your ticket channels.' });
        }
      } catch (err) {
        console.error('Ticket open error:', err);
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply({ content: 'An unexpected error occurred while processing your ticket.', ephemeral: true }).catch(() => null);
        }
      }
    }
    
    // ==========================================
    // 7. MUSIC BUTTONS
    // ==========================================
    if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      import('../utils/musicManager.js').then(musicManager => {
        musicManager.handleInteraction(interaction);
      }).catch(err => {
        console.error('Failed to handle music button interaction:', err);
      });
      return;
    }

      // Ticket Close Button
      if (interaction.customId.startsWith('ticket_close_')) {
        const ticketId = interaction.customId.replace('ticket_close_', '');
        const ticketConfig = db.getTickets(interaction.guild.id);
        const ticketData = ticketConfig.activeTickets[ticketId];

        if (!ticketData) {
          return interaction.reply({ content: 'This ticket is no longer tracked in the database.', ephemeral: true });
        }

        // To prevent misclicks, let's defer update and immediately delete the channels
        await interaction.deferUpdate();

        try {
          const textChannel = interaction.guild.channels.cache.get(ticketData.textId);
          const voiceChannel = interaction.guild.channels.cache.get(ticketData.voiceId);

          if (textChannel) await textChannel.delete();
          if (voiceChannel) await voiceChannel.delete();

          db.removeTicket(interaction.guild.id, ticketId);
        } catch (err) {
          console.error('Error deleting ticket channels:', err);
        }
        return;
      }

      // Giveaway Join Button
      if (interaction.customId === 'gw_join') {
        const gwData = db.getGiveaway(interaction.message.id);
        if (!gwData) {
          return interaction.reply({ content: 'This giveaway has already ended or is invalid!', ephemeral: true });
        }
        
        const joined = db.addGiveawayParticipant(interaction.message.id, interaction.user.id);
        
        // Update embed footer with new entry count
        const newCount = db.getGiveaway(interaction.message.id).participants.length;
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = { ...originalEmbed.data, footer: { text: `${newCount} Entries` } };
        
        await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);

        if (joined) {
          return interaction.reply({ content: `<a:emoji_56:1517212375022047284> You have successfully entered the giveaway!`, ephemeral: true });
        } else {
          return interaction.reply({ content: `You have successfully left the giveaway.`, ephemeral: true });
        }
      }

      // Antinuke config panel buttons
      const validButtons = ['toggle_antinuke', 'toggle_spam', 'toggle_invite', 'toggle_blacklist_filter', 'cycle_punishment', 'save_panel'];

      // Spam "Send 5 More" button
      if (interaction.customId.startsWith('spam_more_')) {
        try {
          await handleSpamMoreButton(interaction);
        } catch (error) {
          console.error('Error handling spam more button:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '\u274c Failed to send more spam.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      // Welcome/Leave Manager buttons
      if (interaction.customId.startsWith('welcmgr_') || interaction.customId.startsWith('leavmgr_')) {
        try {
          await handleWelcomeManagerButton(interaction);
        } catch (error) {
          console.error('Error handling Welcome button:', error);
        }
        return;
      }

      // Accent color buttons
      if (interaction.customId.startsWith('accent_')) {
        try {
          await handleAccentButton(interaction);
        } catch (error) {
          console.error('Error handling Accent button:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' Failed to process accent action.', ephemeral: true }).catch(() => null);
          }
        }
        return;
      }

      if (!validButtons.includes(interaction.customId)) {
        // JTC control panel buttons
        if (interaction.customId.startsWith('jtc_setlimit_')) {
          try { await handleJtcLimitSelect(interaction); } catch (e) { console.error('[JTC limit]', e); }
          return;
        }
        if (interaction.customId.startsWith('jtc_setbitrate_')) {
          try { await handleJtcBitrateSelect(interaction); } catch (e) { console.error('[JTC bitrate]', e); }
          return;
        }
        if (interaction.customId.startsWith('jtc_')) {
          try { await handleJtcButton(interaction); } catch (e) { console.error('[JTC button]', e); }
          return;
        }
        return;
      }

      // Verify Administrator permissions for config buttons — bot owner + extra owners bypass
      const isBtnBypass = isBotOwnerSync(interaction.user.id) ||
        interaction.user.id === interaction.guild.ownerId ||
        db.isExtraOwner(interaction.guild.id, interaction.user.id);

      if (!isBtnBypass && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: ' Access Denied: You must possess the **Administrator** permission to adjust security panel configurations.',
          ephemeral: true
        });
      }

      const guildId = interaction.guild.id;
      const config = db.getGuildConfig(guildId);

      // Enforce dynamic adjustments on database disk cache
      if (interaction.customId === 'toggle_antinuke') {
        db.updateGuildConfig(guildId, { antiNukeEnabled: !config.antiNukeEnabled });
      } else if (interaction.customId === 'toggle_spam') {
        db.updateGuildConfig(guildId, { antiSpamEnabled: !config.antiSpamEnabled });
      } else if (interaction.customId === 'toggle_invite') {
        const inviteState = config.antiInviteEnabled !== false;
        db.updateGuildConfig(guildId, { antiInviteEnabled: !inviteState });
      } else if (interaction.customId === 'toggle_blacklist_filter') {
        const blacklistState = config.blacklistWords && config.blacklistWords.length > 0;
        if (blacklistState) {
          db.updateGuildConfig(guildId, { blacklistWords: [] });
        } else {
          // Default Swear filter words trigger
          db.addBlacklistWord(guildId, 'hack');
          db.addBlacklistWord(guildId, 'nuke');
          db.addBlacklistWord(guildId, 'spam');
        }
      } else if (interaction.customId === 'cycle_punishment') {
        const punishments = ['ban', 'kick', 'quarantine'];
        const currentIdx = punishments.indexOf(config.antiNukePunishment || 'ban');
        const nextIdx = (currentIdx + 1) % punishments.length;
        db.updateGuildConfig(guildId, { antiNukePunishment: punishments[nextIdx] });
      } else if (interaction.customId === 'save_panel') {
        const panel = await getAntinukeConfigPanel(interaction.guild);
        panel.components.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
        panel.embed.data.description = '** Panel configuration has been saved and is now being actively enforced.**';
        panel.embed.data.color = 0x2ECC71; // Success green color
        return interaction.update({ embeds: [panel.embed], components: panel.components });
      }

      // Re-compile layout and update message
      const panel = await getAntinukeConfigPanel(interaction.guild);
      await interaction.update({ embeds: [panel.embed], components: panel.components });
    }

    // ==========================================
    // 4. STRING SELECT MENU (JTC Dropdowns)
    // ==========================================
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'jtc_settings_menu' || interaction.customId === 'jtc_perms_menu') {
        try {
          await handleJtcSelectMenu(interaction);
        } catch (err) {
          console.error('[JTC SelectMenu]', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: ' An error occurred.', ephemeral: true }).catch(() => null);
          }
        }
      }
    }

    // ==========================================
    // 5. CHANNEL SELECT MENU (Welcome/Leave)
    // ==========================================
    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === 'welcmgr_channel' || interaction.customId === 'leavmgr_channel') {
        try {
          await handleWelcomeManagerMenu(interaction);
        } catch (err) {
          console.error('[Welcome SelectMenu]', err);
        }
        return;
      }
    }
    // ==========================================
    // 6. ROLE SELECT MENU (XP Manager)
    // ==========================================
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === 'xp_add_reward') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const system = db.getXpSystem(interaction.guild.id);
        const selectedRoles = interaction.values;
        
        // Find highest existing level
        let nextLevel = 5;
        if (Object.keys(system.roleRewards).length > 0) {
          const levels = Object.keys(system.roleRewards).map(Number);
          nextLevel = Math.max(...levels) + 5;
        }

        for (const roleId of selectedRoles) {
          system.roleRewards[String(nextLevel)] = roleId;
          nextLevel += 5;
        }
        
        db.setXpSystem(interaction.guild.id, system);
        const payload = await buildXpDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'xp_add_multiplier') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
        const system = db.getXpSystem(interaction.guild.id);
        const selectedRoles = interaction.values;
        
        for (const roleId of selectedRoles) {
          system.multipliers[roleId] = 1.5;
        }
        
        db.setXpSystem(interaction.guild.id, system);
        const payload = await buildXpDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }
    }
  }
};
