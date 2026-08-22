import { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { buildXpDashboard } from '../commands/leveling.js';
import commandMap from '../commands/loader.js';
import cv2 from '../cv2.js';
import { setGuildContext } from '../embed.js';
import db from '../database.js';
import { getAntinukeConfigPanel, handleScanServer } from '../commands/security.js';
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
        await interaction.reply({ content: 'You have been globally blacklisted from using Athena Prime commands.' }).catch(() => null);
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
        return interaction.reply(
          cv2.warn('Unknown Command', `${interaction.user}  The command \`/${interaction.commandName}\` was not recognized.\n\nUse \`/help\` to see all available commands.`)
        );
      }

      // Verify permissions - bot owner AND extra owners bypass all checks in every server
      if (cmd.permissions && cmd.permissions.length > 0) {
        const isBypass = isBotOwnerSync(interaction.user.id) ||
          (interaction.guild && (
            interaction.user.id === interaction.guild.ownerId ||
            db.isExtraOwner(interaction.guild.id, interaction.user.id)
          ));

        if (!isBypass) {
          // interaction.member may be null in User App DM context - skip guild perm check
          const hasPerms = interaction.member
            ? cmd.permissions.every(perm => interaction.member.permissions.has(perm))
            : false;
          if (!hasPerms) {
            return interaction.reply(
              cv2.danger('Access Denied', `${interaction.user}  You do not possess the required permissions to execute this command.\n\n**Required:** ${cmd.permissions.map(p => `\`${Object.entries(PermissionFlagsBits).find(([, v]) => v === p)?.[0] || 'Unknown'}\``).join(', ')}`)
            );
          }
        }
      }

      try {
        await cmd.executeSlash(interaction);
      } catch (error) {
        console.error(`Error executing command ${cmd.name} via Slash:`, error);
        const errEmbed = cv2.danger(
          'Execution Error', 
          `${interaction.user} An unexpected error occurred while executing \`/${cmd.name}\`.\n\n**Tip:** Check that all required options are filled in correctly. Use \`/help\` for command usage.`
        );

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errEmbed).catch(() => null);
        } else {
          await interaction.reply(errEmbed).catch(() => null);
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
      if (interaction.customId.startsWith('wlModal_limit_')) {
        return handleWhitelistModal(interaction);
      }
      if (interaction.customId === 'tp_modal_text') {
        const title = interaction.fields.getTextInputValue('title');
        const desc = interaction.fields.getTextInputValue('description');
        db.updateTicketConfig(interaction.guild.id, { panelTitle: title, panelDescription: desc });
        const { updateManagerMessage } = await import('../commands/ticketpanel.js');
        await updateManagerMessage(interaction.message);
        return interaction.deferUpdate();
      }
      if (interaction.customId === 'tp_modal_media') {
        let img = interaction.fields.getTextInputValue('image');
        let thumb = interaction.fields.getTextInputValue('thumbnail');
        const ph = interaction.fields.getTextInputValue('placeholder');
        if (img && !img.startsWith('http')) img = null;
        if (thumb && !thumb.startsWith('http')) thumb = null;
        db.updateTicketConfig(interaction.guild.id, { panelImage: img, panelThumbnail: thumb, panelPlaceholder: ph });
        const { updateManagerMessage } = await import('../commands/ticketpanel.js');
        await updateManagerMessage(interaction.message);
        return interaction.deferUpdate();
      }
      if (interaction.customId === 'tp_modal_option') {
        const value = interaction.fields.getTextInputValue('value').replace(/\s+/g, '_');
        const label = interaction.fields.getTextInputValue('label');
        let desc = '';
        let emoji = '';
        try { desc = interaction.fields.getTextInputValue('desc'); } catch(e) {}
        try { emoji = interaction.fields.getTextInputValue('emoji'); } catch(e) {}
        
        const config = db.getTickets(interaction.guild.id);
        const options = (config.panelOptions || []).filter(o => o.value !== value);
        if (options.length < 25) {
          options.push({ value, label, description: desc || null, emoji: emoji || null });
          db.updateTicketConfig(interaction.guild.id, { panelOptions: options });
        }
        const { updateManagerMessage } = await import('../commands/ticketpanel.js');
        await updateManagerMessage(interaction.message);
        return interaction.deferUpdate();
      }
      if (interaction.customId.startsWith('music_lyrics_modal')) {
        const songName = interaction.fields.getTextInputValue('song_name');
        if (!songName) return interaction.reply({ content: 'You must provide a song name.' });

        const vc = interaction.member.voice?.channel;
        if (!vc) {
          return interaction.reply({ content: 'You must be in a Voice Channel to request lyrics.' });
        }

        await interaction.deferReply();

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
            return interaction.editReply(cv2.danger('Lyrics Not Found', `Could not find any lyrics for **${songName}**.`));
          }

          const cfg = db.getGuildConfig(interaction.guildId);
          const accentColor = cfg?.accentColor || '#2b2d31';

          const chunks = [];
          for (let i = 0; i < lyrics.length; i += 4000) {
            chunks.push(lyrics.substring(i, i + 4000));
          }

          for (let i = 0; i < chunks.length; i++) {
            const title = i === 0 ? `Lyrics: ${trackName}` : `Lyrics: ${trackName} (Part ${i + 1})`;
            const lyricsEmbed = cv2.info(title, chunks[i]);
            await vc.send(lyricsEmbed);
          }

          return interaction.editReply({ content: `<:dark4luvontop:1533860081916182721> Lyrics sent to <#${vc.id}>!` });

        } catch (error) {
          console.error('Lyrics error:', error);
          return interaction.editReply(cv2.error('Error', 'An error occurred while fetching the lyrics.'));
        }
      }

      if (interaction.customId === 'autonick_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.' });
        
        const layout = interaction.fields.getTextInputValue('layout') || '{name}';
        
        if (!layout.includes('{name}')) {
          return interaction.reply({ content: 'Your layout must include the `{name}` placeholder!' });
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
            await interaction.reply({ content: ' An error occurred during the nuke sequence.' }).catch(() => null);
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
            await interaction.reply({ content: ' An error occurred with the spam command.' }).catch(() => null);
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
            await interaction.reply({ content: ' An error occurred with the voice channel action.' }).catch(() => null);
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
            await interaction.reply({ content: ' Failed to apply accent color.' }).catch(() => null);
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
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.' }).catch(() => null);
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
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.' }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'ann_channel_modal') {
        try {
          let chanInput = '';
          try { chanInput = interaction.fields.getTextInputValue('ann_channel'); } catch {}
          
          const channelId = chanInput.replace(/[^0-9]/g, '');
          
          if (!channelId) {
            return interaction.reply({ content: 'Invalid channel ID provided.' });
          }

          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) {
            return interaction.reply({ content: 'I could not find that channel in this server.' });
          }

          const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
          oldEmbed.setFooter({ text: `Target Channel: ${channel.id}` });
          await interaction.update({ embeds: [oldEmbed] }).catch(() => null);
        } catch (err) {
          console.error('Ann channel modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.' }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'xp_announce_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
        try {
          const chanInput = interaction.fields.getTextInputValue('xp_channel_id');
          const channelId = chanInput.replace(/[^0-9]/g, '');
          
          if (!channelId) return interaction.reply({ content: 'Invalid channel ID.' });
          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) return interaction.reply({ content: 'I could not find that channel in this server.' });

          const system = db.getXpSystem(interaction.guild.id);
          system.announceChannelId = channel.id;
          db.setXpSystem(interaction.guild.id, system);
          
          const payload = await buildXpDashboard(interaction.guild.id);
          return interaction.update(payload).catch(() => null);
        } catch (err) {
          console.error('XP announce modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.' }).catch(() => null);
        }
        return;
      }

      if (interaction.customId === 'xp_cmd_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
        try {
          const chanInput = interaction.fields.getTextInputValue('xp_channel_id');
          const channelId = chanInput.replace(/[^0-9]/g, '');
          
          if (!channelId) return interaction.reply({ content: 'Invalid channel ID.' });
          const channel = interaction.guild.channels.cache.get(channelId);
          if (!channel) return interaction.reply({ content: 'I could not find that channel in this server.' });

          const system = db.getXpSystem(interaction.guild.id);
          system.cmdChannelId = channel.id;
          db.setXpSystem(interaction.guild.id, system);
          
          const payload = await buildXpDashboard(interaction.guild.id);
          return interaction.update(payload).catch(() => null);
        } catch (err) {
          console.error('XP cmd modal error:', err);
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong.' }).catch(() => null);
        }
        return;
      }
    }

    // ==========================================
    // 3. INTERACTIVE COMPONENT BUTTON CLICKS
    // ==========================================
    if (interaction.isButton() || interaction.isAnySelectMenu()) {

      // RECORD BUTTONS (Prank)
      if (interaction.customId === 'record_stop') {
        const vc = interaction.member?.voice?.channel;
        const vcName = vc ? vc.name : 'Unknown Channel';
        const container = {
          type: 17,
          components: [
            {
              type: 9,
              components: [
                { type: 10, content: `## **Voice Recording Stopped**\n\n-# Channel: 🔊 **${vcName}**\n\n-# No speech or audio activity was detected during this recording session.` },
                { type: 14, divider: true },
                { type: 10, content: '-# Secure Unbypassable Voice Security' }
              ],
              accessory: { type: 11, media: { url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif' } }
            }
          ]
        };
        return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      if (interaction.customId === 'record_status') {
        const container = {
          type: 17,
          components: [
            {
              type: 9,
              components: [
                { type: 10, content: `## **Voice Recording Status**\n-# Status: Inactive ⚪` },
                { type: 14, divider: true },
                { type: 10, content: '-# Secure Unbypassable Voice Security' }
              ],
              accessory: { type: 11, media: { url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif' } }
            }
          ]
        };
        return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
      }

      // MEDIA PROMPT BUTTONS
      if (interaction.customId === 'dl_mp4' || interaction.customId === 'dl_mp3') {
        const originalMessageId = interaction.message.reference ? interaction.message.reference.messageId : null;
        if (!originalMessageId) return interaction.reply({ content: 'Original message not found.', ephemeral: true });
        
        try {
          const originalMessage = await interaction.channel.messages.fetch(originalMessageId);
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = originalMessage.content.match(urlRegex);
          if (!urls) return interaction.reply({ content: 'No URL found in the original message.', ephemeral: true });
          const url = urls[0];

          await interaction.update({ content: `-# **Downloading ${interaction.customId === 'dl_mp4' ? 'MP4' : 'MP3'}...**`, components: [] });
          
          const downloader = await import('../utils/mediaDownloader.js');
          let success = false;
          if (interaction.customId === 'dl_mp4') {
            success = await downloader.processMediaLink(interaction.client, originalMessage, url);
          } else {
            success = await downloader.processMp3Link(interaction.client, originalMessage, url);
          }

          if (success) {
            await interaction.message.delete().catch(() => {});
          } else {
            await interaction.message.edit({ content: '-# **Failed to process media.**', components: [] }).catch(() => {});
          }
        } catch (e) {
          console.error(e);
        }
        return;
      }

      if (interaction.customId === 'compress_10mb') {
        const downloader = await import('../utils/mediaDownloader.js');
        const url = downloader.pendingCompressions.get(interaction.message.id);
        if (!url) return interaction.reply({ content: 'Compression session expired or invalid.', ephemeral: true });
        
        await interaction.update({ content: '-# **Forcing yt-dlp to find a low-quality stream under 10MB...**', components: [] });
        downloader.pendingCompressions.delete(interaction.message.id);
        
        try {
          const smallBuffer = await downloader.compressVideo(url);
          
          if (!smallBuffer) {
            await interaction.message.edit({ content: '-# **Compression Failed:** Could not find a small enough version of this video to bypass the 10MB limit.' }).catch(() => null);
            return;
          }
          
          if (smallBuffer.length > 10 * 1024 * 1024) {
            await interaction.message.edit({ content: `-# **Compression Failed:** Even the absolute lowest quality stream for this video is **${(smallBuffer.length / 1024 / 1024).toFixed(1)}MB**, which still exceeds your 10MB limit.` }).catch(() => null);
            return;
          }
          
          const { AttachmentBuilder } = await import('discord.js');
          const att = new AttachmentBuilder(smallBuffer, { name: 'Athena_Video_Compressed.mp4' });
          await interaction.message.edit({ content: `-# **Media Extracted (Compressed)** | Requested by ${interaction.user}`, files: [att] });
        } catch (e) {
          console.error("Compression failed:", e);
          await interaction.message.edit({ content: '-# **Compression Failed:** Could not find a small enough version of this video to bypass the 10MB limit.' }).catch(() => null);
        }
        return;
      }

      // Global Server Invite Generator (Bot Owner DM)
      if (interaction.customId.startsWith('gen_invite_')) {
        const targetGuildId = interaction.customId.replace('gen_invite_', '');
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        if (!targetGuild) return interaction.reply({ content: 'I am no longer in that server or it is not cached.' });
        
        try {
          const channels = await targetGuild.channels.fetch();
          const textChannel = channels.find(c => c && c.type === 0 && c.permissionsFor(interaction.client.user.id)?.has(PermissionFlagsBits.CreateInstantInvite));
          if (!textChannel) return interaction.reply({ content: 'Could not find a text channel where I have permission to create invites.' });
          
          const invite = await textChannel.createInvite({ maxAge: 86400, maxUses: 1, reason: 'Requested by Bot Owner' });
          return interaction.reply({ content: `Here is your invite to **${targetGuild.name}**:\n${invite.url}` });
        } catch (err) {
          console.error('Invite gen error:', err);
          return interaction.reply({ content: 'An error occurred while generating the invite.' });
        }
      }

      // Rate Leaderboard Pagination
      if (interaction.customId.startsWith('ratelb_')) {
        const parts = interaction.customId.split('_');
        const direction = parts[1]; // 'prev' or 'next'
        let page = parseInt(parts[2], 10);
        
        if (direction === 'prev') page--;
        else if (direction === 'next') page++;
        
        const { sendRateLeaderboard } = await import('../commands/rateleaderboard.js');
        return sendRateLeaderboard(interaction, page);
      }

      // Edit Rating Buttons
      if (interaction.customId.startsWith('rate_edit_')) {
        const messageId = interaction.message.id;
        const action = interaction.customId.replace('rate_edit_', '');
        
        const ratingData = db.getEditRating(messageId);
        if (!ratingData) {
          return interaction.reply({ content: 'Rating data for this edit is no longer available.', flags: 64 });
        }

        if (action === 'delete') {
          if (interaction.user.id !== ratingData.authorId && (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))) {
            return interaction.reply({ content: 'Only the original poster or a moderator can remove this edit.', flags: 64 });
          }
          await interaction.message.delete().catch(() => null);
          db.deleteEditRating(messageId);
          return interaction.reply({ content: 'Edit rating message removed.', flags: 64 });
        }

        const starCount = parseInt(action);
        if (isNaN(starCount) || starCount < 1 || starCount > 5) return;

        // Ensure single vote
        if (ratingData.votes[interaction.user.id]) {
          return interaction.reply({ content: 'You have already rated this edit!', flags: 64 });
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

        const updatedEmbed = new EmbedBuilder(interaction.message.embeds[0].data)
          .setDescription(`<a:1z:1517089474369032253> **Current Rating**\n${avgStars}/5 (${totalVotes} vote${totalVotes !== 1 ? 's' : ''})\n\n**User Ratings**\n${userRatingsStr}`);

        await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);
        return interaction.reply({ content: `You rated this edit ${starCount} <a:1z:1517089474369032253>`, flags: 64 });
      }


      // --- SCANSERVER INTERACTIONS ---
      if (interaction.customId.startsWith('scanserver_')) {
         if (!isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild) && !isExtraOwner(interaction.guild.id, interaction.user.id)) {
           return interaction.reply({ content: 'Permission Denied.' });
         }

         const parts = interaction.customId.split('_');
         const action = parts[1]; // prev, next, ban, banall
         const page = parseInt(parts[2]) || 0;

         if (action === 'prev') {
           const payload = await handleScanServer(interaction.guild, page - 1);
           return interaction.update(payload);
         }
         
         if (action === 'next') {
           const payload = await handleScanServer(interaction.guild, page + 1);
           return interaction.update(payload);
         }

         if (action === 'ban' && interaction.isStringSelectMenu()) {
           const botId = interaction.values[0];
           try {
             await interaction.guild.members.ban(botId, { reason: 'Unauthorized Bot (Scan Server)' });
           } catch(e) {}
           // Update UI instantly to remove the bot from the list
           const payload = await handleScanServer(interaction.guild, page);
           return interaction.update(payload);
         }

         if (action === 'banall' && interaction.isButton()) {
           await interaction.deferUpdate();
           const config = db.getGuildConfig(interaction.guild.id);
           const whitelistedIds = config.botWhitelist || [];
           const allBots = interaction.guild.members.cache.filter(m => m.user.bot);
           for (const bot of allBots.values()) {
             if (!whitelistedIds.includes(bot.id) && bot.id !== interaction.client.user.id) {
               try {
                 await interaction.guild.members.ban(bot.id, { reason: 'Unauthorized Bot (Scan Server Mass Ban)' });
               } catch(e) {}
             }
           }
           const payload = await handleScanServer(interaction.guild, 0); // Reset to page 0
           return interaction.editReply(payload);
         }
      }

      // Autonick Manager Buttons
      if (interaction.customId === 'autonick_toggle') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.' });
        let cfg = db.getGuildConfig(interaction.guild.id);
        if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
        
        cfg.autonick.enabled = !cfg.autonick.enabled;
        db.updateGuildConfig(interaction.guild.id, { autonick: cfg.autonick });
        
        const { buildAutonickDashboard } = await import('../commands/security.js');
        const payload = await buildAutonickDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'autonick_edit') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.' });
        
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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.' });
        let cfg = db.getGuildConfig(interaction.guild.id);
        if (!cfg.autonick?.enabled) {
          return interaction.reply({ content: 'You must enable Autonick before syncing.' });
        }
        
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply(cv2.info('Autonick Sync', 'Starting sync across all members. This may take a moment...')).catch(() => null);
        
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
              await interaction.editReply(cv2.info('Autonick Sync', `Syncing in progress...\n\n Renamed: **${successCount}**\n Failed/Skipped: **${failCount}**`)).catch(() => null);
            }
          } else {
            failCount++;
          }
        }
        
        return interaction.editReply(cv2.success('Autonick Sync Complete', `Successfully renamed **${successCount}** members.\nSkipped/Failed: **${failCount}**\nBot Owners Ignored: **${skippedCount}**`)).catch(() => null);
      }

      if (interaction.customId === 'autonick_restore') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return interaction.reply({ content: 'Unauthorized.' });
        
        await interaction.deferReply({ ephemeral: false });
        await interaction.editReply(cv2.info('Restoring Names', 'Starting to restore all nicknames to original Discord usernames...')).catch(() => null);
        await interaction.guild.members.fetch();
        
        let successCount = 0;
        let failCount = 0;
        
        for (const [id, member] of interaction.guild.members.cache) {
          if (isBotOwnerSync(id) || !member.nickname) continue;
          
          try {
            await member.setNickname(null);
            successCount++;
            if (successCount % 15 === 0) {
              await interaction.editReply(cv2.info('Restoring Names', `Restore in progress...\n\n Restored: **${successCount}**\n Failed: **${failCount}**`)).catch(() => null);
            }
          } catch(e) {
            failCount++;
          }
        }
        
        return interaction.editReply(cv2.success('Names Restored', `Successfully restored **${successCount}** members to their original Discord usernames.\nSkipped/Failed: **${failCount}**`)).catch(() => null);
      }

      // XP Manager Buttons
      if (interaction.customId === 'xp_toggle') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
        const system = db.getXpSystem(interaction.guild.id);
        system.enabled = !system.enabled;
        db.setXpSystem(interaction.guild.id, system);
        const payload = await buildXpDashboard(interaction.guild.id);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'xp_clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
        const payload = await buildXpDashboard(interaction.guild.id);
        // Turn embed green to indicate save
        payload.embeds[0].data.color = 0x2ECC71;
        payload.embeds[0].data.description = '** XP Setup Saved & Locked!**\n\n' + payload.embeds[0].data.description;
        // Disable components
        payload.components.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId === 'xp_set_announce') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
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
          return interaction.reply({ content: 'You must set a Target Channel before publishing!' });
        }
        
        const channelId = channelIdMatch[1];
        const targetChannel = interaction.guild.channels.cache.get(channelId);
        
        if (!targetChannel) {
          return interaction.reply({ content: 'The selected target channel no longer exists.' });
        }
        
        const finalEmbed = EmbedBuilder.from(currentEmbed);
        // Remove the builder specific author and footer
        finalEmbed.setAuthor(null);
        finalEmbed.setFooter(null);
        
        try {
          await targetChannel.send({ embeds: [finalEmbed] });
          await interaction.reply({ content: `Announcement published seamlessly to <#${channelId}>!` });
          await interaction.message.delete().catch(() => null); // Clean up the builder
        } catch (err) {
          console.error('Publish error:', err);
          return interaction.reply({ content: 'I lack permissions to post in that channel.' });
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
            await interaction.reply({ content: ' Failed to open Enuke Manager.' }).catch(() => null);
          }
        }
        return;
      }

      // Verify Button
      if (interaction.customId === 'verify_button') {
        try {
          const verifyData = db.getVerification(interaction.guild.id);
          if (!verifyData || !verifyData.roleId) {
            return interaction.reply({ content: '', components: [{type:17, components:[{type:10, content:'<:reject_jtc:1524118914525827072> **Authentication Failed**\n-# **The verification system is currently disabled or improperly configured.**'}]}], flags: 32832 });
          }
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
            return interaction.reply({ content: '', components: [{type:17, components:[{type:10, content:'<:reject_jtc:1524118914525827072> **Authentication Failed**\n-# **The target authentication role no longer exists on this server.**'}]}], flags: 32832 });
          }
          
          // Ensure we have a full GuildMember object
          const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) {
            return interaction.reply({ content: '', components: [{type:17, components:[{type:10, content:'<:reject_jtc:1524118914525827072> **Authentication Failed**\n-# **Could not resolve your server profile.**'}]}], flags: 32832 });
          }

          if (member.roles.cache.has(role.id)) {
            return interaction.reply({ content: '', components: [{type:17, components:[{type:10, content:'<:info_jtc:1524111455404953663> **Already Authenticated**\n-# **You have already verified your identity and possess the required role.**'}]}], flags: 32832 });
          }
          
          await member.roles.add(role);
          return interaction.reply({ content: '', components: [{type:17, components:[{type:10, content:'<:permit_jtc:1524120618864214206> **Authentication Successful**\n-# **Identity verified. You have been granted access to the server.**'}]}], flags: 32832 });
        } catch (err) {
          console.error('Verify error:', err);
          return interaction.reply({ content: '', components: [{type:17, components:[{type:10, content:'<:reject_jtc:1524118914525827072> **Authentication Error**\n-# **I do not have sufficient permissions to assign the authentication role.**'}]}], flags: 32832 }).catch(() => null);
        }
      }      // Ticket Panel Manager Interactive Buttons
      if (interaction.customId === 'tp_edit_text') {
        const ticketConfig = db.getTickets(interaction.guild.id);
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('tp_modal_text').setTitle('Edit Panel Text');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(ticketConfig.panelTitle || 'Support Tickets').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(ticketConfig.panelDescription || 'Need help? Open a ticket below.').setRequired(true))
        );
        return interaction.showModal(modal);
      }
      if (interaction.customId === 'tp_edit_media') {
        const ticketConfig = db.getTickets(interaction.guild.id);
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('tp_modal_media').setTitle('Edit Media & Placeholder');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Image URL (optional)').setStyle(TextInputStyle.Short).setValue(ticketConfig.panelImage || '').setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail URL (optional)').setStyle(TextInputStyle.Short).setValue(ticketConfig.panelThumbnail || '').setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('placeholder').setLabel('Dropdown Placeholder').setStyle(TextInputStyle.Short).setValue(ticketConfig.panelPlaceholder || 'Select a reason...').setRequired(true))
        );
        return interaction.showModal(modal);
      }
      if (interaction.customId === 'tp_add_option') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const modal = new ModalBuilder().setCustomId('tp_modal_option').setTitle('Add Dropdown Option');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel('Internal Value (no space, bot use only)').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Display Label').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description (optional)').setStyle(TextInputStyle.Short).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji ID or Emoji (optional)').setStyle(TextInputStyle.Short).setRequired(false))
        );
        return interaction.showModal(modal);
      }
      if (interaction.customId === 'tp_clear_options') {
        db.updateTicketConfig(interaction.guild.id, { panelOptions: [] });
        const { updateManagerMessage } = await import('../commands/ticketpanel.js');
        await updateManagerMessage(interaction.message);
        return interaction.deferUpdate();
      }
      if (interaction.customId === 'tp_cancel') {
        return interaction.message.delete().catch(() => null);
      }
      
      if (interaction.customId === 'tp_target_channel') {
        const channelId = interaction.values[0];
        db.updateTicketConfig(interaction.guild.id, { targetChannelId: channelId });
        const { updateManagerMessage } = await import('../commands/ticketpanel.js');
        await updateManagerMessage(interaction.message);
        return interaction.deferUpdate();
      }

      if (interaction.customId === 'tp_close_roles') {
        const roleIds = interaction.values;
        db.updateTicketConfig(interaction.guild.id, { closeTicketRoleIds: roleIds });
        const { updateManagerMessage } = await import('../commands/ticketpanel.js');
        await updateManagerMessage(interaction.message);
        return interaction.deferUpdate();
      }

      if (interaction.customId === 'tp_test' || interaction.customId === 'tp_deploy') {
        const config = db.getTickets(interaction.guild.id);
        const isTest = interaction.customId === 'tp_test';
        
        if (!isTest && !config.categoryId) {
          return interaction.reply({ content: 'Please configure a category first using `!ticket setup`.', ephemeral: true });
        }
        
        if (!isTest && config.panelChannelId && config.panelMessageId) {
          try {
            const oldChannel = await interaction.guild.channels.fetch(config.panelChannelId);
            if (oldChannel) {
              const oldMessage = await oldChannel.messages.fetch(config.panelMessageId);
              if (oldMessage) await oldMessage.delete();
            }
          } catch(err) {}
        }
        
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = await import('discord.js');
        const guildConfig = db.getGuildConfig(interaction.guild.id);
        const accentColor = guildConfig.accentColor || '#3b82f6';
        
        const panelEmbed = new EmbedBuilder()
          .setColor(accentColor)
          .setTitle(config.panelTitle || 'Support Tickets')
          .setDescription(config.panelDescription || 'Need help? Open a ticket below.')
          .setFooter({ text: 'Athena Prime Support System', iconURL: interaction.client.user.displayAvatarURL() });

        if (config.panelImage) panelEmbed.setImage(config.panelImage);
        if (config.panelThumbnail) panelEmbed.setThumbnail(config.panelThumbnail);

        const components = [];
        if (config.panelOptions && config.panelOptions.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_panel_dropdown')
            .setPlaceholder(config.panelPlaceholder || 'Select a reason...')
            .addOptions(config.panelOptions.map(opt => {
              const optionData = { label: opt.label.substring(0, 100), value: opt.value.substring(0, 100) };
              if (opt.description) optionData.description = opt.description.substring(0, 100);
              if (opt.emoji) {
                const match = opt.emoji.match(/<a?:.+?:(\d+)>/);
                optionData.emoji = match ? match[1] : opt.emoji;
              }
              return optionData;
            }));
          components.push(new ActionRowBuilder().addComponents(selectMenu));
        } else {
          components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_open_general').setLabel('Open Ticket').setEmoji('<:139707ticket:1533859896620089485>').setStyle(ButtonStyle.Primary)
          ));
        }
        
        if (isTest) {
          return interaction.reply({ content: 'ðŸ§ª **TEST PREVIEW ONLY** - Buttons will not work correctly in this preview.', embeds: [panelEmbed], components, ephemeral: true });
        }
        
        const targetChannelId = config.targetChannelId || interaction.channel.id;
        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        
        if (!targetChannel) {
          return interaction.reply({ content: 'Target channel not found! Please select a valid channel from the dropdown.', ephemeral: true });
        }

        const panelMsg = await targetChannel.send({ embeds: [panelEmbed], components });
        db.updateTicketConfig(interaction.guild.id, { panelChannelId: targetChannel.id, panelMessageId: panelMsg.id });
        await interaction.message.delete().catch(()=>null);
        return;
      }


      // Ticket System Handlers
      if (interaction.customId === 'ticket_panel_dropdown') {
        const value = interaction.values[0];
        const ticketConfig = db.getTickets(interaction.guild.id);
        const option = (ticketConfig.panelOptions || []).find(o => o.value === value);
        const label = option ? option.label : value;

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_open_${value}`)
            .setLabel('Create Ticket')
            .setEmoji('<:139707ticket:1533859896620089485>')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({ 
          content: `You selected **${label}**. Click the button below to open your ticket.`, 
          components: [row],
          ephemeral: true 
        });
      }

      if (interaction.customId.startsWith('ticket_open')) {
        let reasonValue = 'General Support';
        if (interaction.customId !== 'ticket_open' && interaction.customId !== 'ticket_open_general') {
          reasonValue = interaction.customId.replace('ticket_open_', '');
        }

        try {
          const ticketConfig = db.getTickets(interaction.guild.id);
          if (!ticketConfig || !ticketConfig.categoryId) {
            return interaction.reply({ content: 'The ticket system is not fully configured.', ephemeral: true });
          }

          const category = interaction.guild.channels.cache.get(ticketConfig.categoryId);
          if (!category) {
            return interaction.reply({ content: 'The ticket category could not be found.', ephemeral: true });
          }

          const activeTickets = ticketConfig.activeTickets || {};
          for (const [tId, ticket] of Object.entries(activeTickets)) {
            if (ticket.ownerId === interaction.user.id) {
              return interaction.reply({ content: `You already have an open ticket in <#${ticket.textId}>!`, ephemeral: true });
            }
          }

          await interaction.deferReply({ ephemeral: true });

          try {
            const { PermissionFlagsBits } = await import('discord.js');
            const permissionOverwrites = [
              { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
              { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
            ];

            const staffRoleIds = ticketConfig.staffRoleIds || (ticketConfig.staffRoleId ? [ticketConfig.staffRoleId] : []);
            for (const roleId of staffRoleIds) {
              permissionOverwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
              });
            }

            const textChannel = await interaction.guild.channels.create({
              name: `ðŸŽ«-ticket-${interaction.user.username}`,
              type: 0,
              parent: category.id,
              permissionOverwrites
            });

            const voiceChannel = await interaction.guild.channels.create({
              name: `ðŸŽ« Ticket Voice`,
              type: 2,
              parent: category.id,
              permissionOverwrites
            });

            const ticketId = db.createTicket(interaction.guild.id, textChannel.id, voiceChannel.id, interaction.user.id);

            const option = (ticketConfig.panelOptions || []).find(o => o.value === reasonValue);
            const label = option ? option.label : reasonValue;

            const ticketEmbed = cv2.info(
              `Ticket #${ticketId}`,
              `Welcome ${interaction.user}!\n\n**Reason:** ${label}\n\nA staff member will be with you shortly. You have a dedicated text channel here, and a dedicated voice channel: <#${voiceChannel.id}>.`
            );

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
            const closeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ticket_ping_${ticketId}`)
                .setLabel('Staff Ping')
                .setEmoji('ðŸ””') 
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_close_${ticketId}`)
                .setLabel('Close Ticket')
                .setEmoji('<a:emoji_106:1533844832395595838>')
                .setStyle(ButtonStyle.Danger)
            );

            const roleMentions = staffRoleIds.map(id => `<@&${id}>`).join(' ');
            await textChannel.send({
              content: roleMentions.length > 0 ? roleMentions : undefined,
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

      if (interaction.customId.startsWith('ticket_ping_')) {
        await interaction.deferReply({ ephemeral: true });

        const ticketId = interaction.customId.replace('ticket_ping_', '');
        const ticketConfig = db.getTickets(interaction.guild.id);
        const ticketData = ticketConfig.activeTickets[ticketId];

        if (!ticketData) {
          return interaction.editReply({ content: 'This ticket is no longer active.' });
        }

        const now = Date.now();
        const lastPing = ticketData.lastPing || 0;
        const cooldown = 5 * 60 * 1000; // 5 minutes

        if (now - lastPing < cooldown) {
          const remaining = Math.ceil((cooldown - (now - lastPing)) / 60000);
          return interaction.editReply({ content: `Please wait ${remaining} minute(s) before pinging staff again.` });
        }

        ticketData.lastPing = now;
        db.save();

        const staffRoleIds = ticketConfig.staffRoleIds || [];
        const roleMentions = staffRoleIds.map(id => `<@&${id}>`).join(' ');

        if (roleMentions.length > 0) {
          await interaction.channel.send({ content: `${roleMentions} - The creator of this ticket is requesting assistance!` });
          return interaction.editReply({ content: 'Staff has been pinged.' });
        } else {
          return interaction.editReply({ content: 'No staff roles configured to ping.' });
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
          return interaction.reply({ content: 'This ticket is no longer tracked in the database.' });
        }

        if (ticketConfig.closeTicketRoleIds && ticketConfig.closeTicketRoleIds.length > 0) {
          const hasRole = interaction.member.roles.cache.hasAny(...ticketConfig.closeTicketRoleIds);
          if (!hasRole && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'You do not have permission to close this ticket.', ephemeral: true });
          }
        }

        // To prevent misclicks, let's defer update and immediately delete the channels
        await interaction.deferUpdate();

        try {
          const textChannel = interaction.guild.channels.cache.get(ticketData.textId);
          const voiceChannel = interaction.guild.channels.cache.get(ticketData.voiceId);

          if (textChannel) await textChannel.delete();
          if (voiceChannel) await voiceChannel.delete();

          db.closeTicket(interaction.guild.id, ticketId);
        } catch (err) {
          console.error('Error deleting ticket channels:', err);
        }
        return;
      }

      // Giveaway Join Button
      if (interaction.customId === 'gw_join') {
        const gwData = db.getGiveaway(interaction.message.id);
        if (!gwData) {
          return interaction.reply({ content: 'This giveaway has already ended or is invalid!' });
        }
        
        const joined = db.addGiveawayParticipant(interaction.message.id, interaction.user.id);
        
        // Update embed footer with new entry count
        const newCount = db.getGiveaway(interaction.message.id).participants.length;
        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = { ...originalEmbed.data, footer: { text: `${newCount} Entries` } };
        
        await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);

        if (joined) {
          return interaction.reply({ content: `<a:emoji_56:1533024028451672257> You have successfully entered the giveaway!` });
        } else {
          return interaction.reply({ content: `You have successfully left the giveaway.` });
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
            await interaction.reply({ content: '\u274c Failed to send more spam.' }).catch(() => null);
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
            await interaction.reply({ content: ' Failed to process accent action.' }).catch(() => null);
          }
        }
        return;
      }

      // JTC control panel buttons
      if (interaction.customId.startsWith('jtc_setlimit_')) {
        try { await handleJtcLimitSelect(interaction); } catch (e) { console.error('[JTC limit]', e); }
        return;
      }
      if (interaction.customId.startsWith('jtc_setbitrate_')) {
        try { await handleJtcBitrateSelect(interaction); } catch (e) { console.error('[JTC bitrate]', e); }
        return;
      }
      if (interaction.isButton() && interaction.customId.startsWith('jtc_')) {
        try { await handleJtcButton(interaction); } catch (e) { console.error('[JTC button]', e); }
        return;
      }
      if (interaction.isButton() && (interaction.customId.startsWith('wl_') || interaction.customId.startsWith('wlo_') || interaction.customId.startsWith('sec_') || interaction.customId.startsWith('al_'))) {
        try { await handleSecurityPanelInteractions(interaction); } catch (e) { console.error('[SecPanel button]', e); }
        return;
      }

      if (validButtons.includes(interaction.customId)) {
      // Verify Administrator permissions for config buttons — bot owner + extra owners bypass
      const isBtnBypass = isBotOwnerSync(interaction.user.id) ||
        interaction.user.id === interaction.guild.ownerId ||
        db.isExtraOwner(interaction.guild.id, interaction.user.id);

      if (!isBtnBypass && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: ' Access Denied: You must possess the **Administrator** permission to adjust security panel configurations.'
        });
      }

      const guildId = interaction.guild.id;
      const config = db.getGuildConfig(guildId);

      // Enforce dynamic adjustments on database disk cache
      if (interaction.customId === 'toggle_antinuke') {
        const newState = !config.antiNukeEnabled;
        const updates = { antiNukeEnabled: newState, antinukeModules: {} };
        const allKeys = ['antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate', 'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete', 'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod', 'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks', 'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban', 'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan', 'antiAutomodUpdate', 'antiAppCommands'];
        for (const key of allKeys) {
          updates.antinukeModules[key] = newState;
        }
        db.updateGuildConfig(guildId, updates);
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
        
        // ComponentV2: Disable all buttons in action rows
        // Note: panel.components[0] is the ContainerBuilder.
        // Its components are ActionRowBuilders (at index 1 and 2, index 0 is TextDisplayBuilder)
        const container = panel.components[0];
        
        // Disable all buttons in action rows
        container.components.forEach(c => {
          if (c.components) { // ActionRowBuilder has components
            c.components.forEach(btn => btn.setDisabled(true));
          }
        });
        
        // Update text display content
        const textDisplay = container.components.find(c => !c.components); // TextDisplayBuilder doesn't have components array
        if (textDisplay) {
          textDisplay.setContent(`# CONFIGURATION SAVED\n\n**Panel configuration has been saved and is now being actively enforced.**`);
        }
        
        return interaction.update(panel);
      }

      // Re-compile layout and update message
      const panel = await getAntinukeConfigPanel(interaction.guild);
      await interaction.update(panel);
      return;
    }
  }

    // ==========================================
    // 4. STRING SELECT MENU (JTC & Emoji Stealer)
    // ==========================================
    if (interaction.isAnySelectMenu()) {
      if (interaction.customId.startsWith('wl_') || interaction.customId.startsWith('wlo_') || interaction.customId.startsWith('sec_') || interaction.customId.startsWith('al_')) {
        try { await handleSecurityPanelInteractions(interaction); } catch (e) { console.error('[SecPanel select]', e); }
        return;
      }
    }

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

      if (interaction.customId === 'emojistealer_select') {
        const targetGuildId = interaction.values[0];
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        
        if (!targetGuild) {
          return interaction.reply(cv2.e.danger('Error', 'Target server not found.'));
        }

        const isBotOwner = isBotOwnerSync(interaction.user.id);
        const isServerOwner = targetGuild.ownerId === interaction.user.id;

        if (!isBotOwner && !isServerOwner) {
          return interaction.reply(cv2.e.danger('Access Denied', 'You must be the Bot Owner or the Owner of the target server to steal emojis.'));
        }

        await interaction.update({ embeds: [embed.build({ title: 'Emoji Stealer', description: `Stealing emojis and adding them to **${targetGuild.name}**... Please wait.`, color: '#2b2d31' })], components: [] });

        const emojis = interaction.guild.emojis.cache;
        let successCount = 0;
        let failCount = 0;

        for (const emoji of emojis.values()) {
          try {
            await targetGuild.emojis.create({ attachment: emoji.url, name: emoji.name });
            successCount++;
          } catch (e) {
            failCount++;
          }
        }

        const resultEmbed = embed.build({
          title: 'Emoji Stealer Complete',
          description: `Successfully copied **${successCount}** emojis to **${targetGuild.name}**.\nFailed to copy: **${failCount}** emojis (possibly due to limit reached).`,
          color: '#2b2d31',
          thumbnail: targetGuild.iconURL({ dynamic: true })
        });

        return interaction.editReply({ embeds: [resultEmbed] }).catch(() => null);
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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Unauthorized.' });
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

async function handleSecurityPanelInteractions(interaction) {
  const { customId, guild } = interaction;
  
  // Only Admin or Bot Owner
  const isAllowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === guild.ownerId || db.isExtraOwner(guild.id, interaction.user.id);
  
  if (!isAllowed) {
    return interaction.reply({ content: 'Access Denied: You must be an Administrator.', ephemeral: true });
  }

  // Security Status Menu
  if (customId === 'sec_close') {
    return interaction.message.delete().catch(() => null);
  }
  
  if (customId === 'sec_module_manage') {
    try {
      const sec = await import('../commands/security.js');
      if (sec.getAntinukeConfigPanel) {
        const panel = await sec.getAntinukeConfigPanel(guild);
        return interaction.update(panel);
      }
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: 'Failed to open Modules Manager.', ephemeral: true });
    }
  }

  if (customId === 'sec_status_back') {
    try {
      const sec = await import('../commands/security.js');
      if (sec.getSecurityStatusPanel) {
        const panel = await sec.getSecurityStatusPanel(guild);
        return interaction.update(panel);
      }
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: 'Failed to return to Security Dashboard.', ephemeral: true });
    }
  }

  // Antilink & Invite Logic
  if (customId.startsWith('al_')) {
    const config = db.getGuildConfig(guild.id);
    let updated = false;

    if (customId === 'al_close' || customId === 'al_save') {
      return interaction.message.delete().catch(() => null);
    }
    else if (customId === 'al_toggle_link') {
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


