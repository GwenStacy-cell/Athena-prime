import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ComponentType,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags
} from 'discord.js';

export const commands = [
  {
    name: 'vcpanel',
    description: 'Server Owner Voice Control Panel',
    category: 'moderation',
    async executePrefix(message, args) {
      // 1. Permission Check (Guild Owner or Bot Owner only)
      const botOwnerId = process.env.OWNER_ID;
      if (message.author.id !== message.guild.ownerId && message.author.id !== botOwnerId) {
        return; // Ignore completely if not authorized
      }

      // 2. VC Check
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        return message.reply("You must be connected to a voice channel to use the Control Panel.");
      }

      // 3. Build UI
      const connectedMembers = voiceChannel.members;
      const connectedTags = connectedMembers.map(m => `<@${m.id}>`).join(', ');
      
      
      const textContent = 
          `# Server Owner Voice | Control Panel\n\n` +
          `-# **Server Owner:** <@${message.guild.ownerId}> | **Voice Channel:** <#${voiceChannel.id}>\n` +
          `-# **Connected Members (${connectedMembers.size}):** ${connectedTags}\n\n` +
          `**Button Controls:**\n` +
          `\`Mute All\` \`Unmute All\` \`VMute 1\` \`VUnmute 1\`\n` +
          `\`VC Kick\` \`VC Ban\` \`VC Kick All\` \`VC Ban All\`\n` +
          `\`VC Unban\` \`VC Unban All\`\n` +
          `\`Deafen 1\` \`Undeafen 1\` \`Deafen All\` \`Undeafen All\`\n` +
          `\`Lock VC\` \`Unlock VC\` \`Hide VC\` \`Unhide VC\``;

      const mainDisplay = new TextDisplayBuilder().setContent(textContent);

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vcp_mute_all').setLabel('Mute All').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_unmute_all').setLabel('Unmute All').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_mute_1').setLabel('VMute 1').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_unmute_1').setLabel('VUnmute 1').setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vcp_kick_1').setLabel('VC Kick').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_ban_1').setLabel('VC Ban').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_kick_all').setLabel('VC Kick All').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_ban_all').setLabel('VC Ban All').setStyle(ButtonStyle.Secondary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vcp_unban_1').setLabel('VC Unban').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_unban_all').setLabel('VC Unban All').setStyle(ButtonStyle.Secondary)
      );

      const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vcp_deafen_1').setLabel('Deafen 1').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_undeafen_1').setLabel('Undeafen 1').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_deafen_all').setLabel('Deafen All').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_undeafen_all').setLabel('Undeafen All').setStyle(ButtonStyle.Secondary)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vcp_lock').setLabel('Lock VC').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_unlock').setLabel('Unlock VC').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_hide').setLabel('Hide VC').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcp_unhide').setLabel('Unhide VC').setStyle(ButtonStyle.Secondary)
      );

      const panelContainer = new ContainerBuilder()
        .addTextDisplayComponents(mainDisplay)
        .addActionRowComponents(row1, row2, row3, row4, row5);

      const panelMsg = await message.channel.send({
        components: [panelContainer],
        flags: MessageFlags.IsComponentsV2
      });

      // 4. Collector setup
      const collector = panelMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 900000 }); // 15 mins

      collector.on('collect', async (i) => {
        // Refresh VC
        const vc = i.member.voice.channel;
        if (!vc) {
          return i.reply({ content: 'You are no longer in a voice channel!', ephemeral: true });
        }

        const everyoneRole = i.guild.roles.everyone;

        try {
          if (i.customId === 'vcp_mute_all') {
            vc.members.forEach(m => { if (m.id !== i.user.id) m.voice.setMute(true).catch(()=>{}); });
            await i.reply({ content: 'Muted all other members.', ephemeral: true });
          } 
          else if (i.customId === 'vcp_unmute_all') {
            vc.members.forEach(m => { m.voice.setMute(false).catch(()=>{}); });
            await i.reply({ content: 'Unmuted all members.', ephemeral: true });
          }
          else if (i.customId === 'vcp_deafen_all') {
            vc.members.forEach(m => { if (m.id !== i.user.id) m.voice.setDeaf(true).catch(()=>{}); });
            await i.reply({ content: 'Deafened all other members.', ephemeral: true });
          }
          else if (i.customId === 'vcp_undeafen_all') {
            vc.members.forEach(m => { m.voice.setDeaf(false).catch(()=>{}); });
            await i.reply({ content: 'Undeafened all members.', ephemeral: true });
          }
          else if (i.customId === 'vcp_kick_all') {
            vc.members.forEach(m => { if (m.id !== i.user.id) m.voice.disconnect().catch(()=>{}); });
            await i.reply({ content: 'Kicked all other members from VC.', ephemeral: true });
          }
          else if (i.customId === 'vcp_ban_all') {
            vc.members.forEach(m => {
              if (m.id !== i.user.id) {
                vc.permissionOverwrites.edit(m.id, { Connect: false }).catch(()=>{});
                m.voice.disconnect().catch(()=>{});
              }
            });
            await i.reply({ content: 'Banned all other members from this VC.', ephemeral: true });
          }
          else if (i.customId === 'vcp_unban_all') {
            // Remove user-specific overwrites that deny Connect
            const overwrites = vc.permissionOverwrites.cache;
            overwrites.forEach(overwrite => {
              if (overwrite.type === 1) { // member type
                vc.permissionOverwrites.delete(overwrite.id).catch(()=>{});
              }
            });
            await i.reply({ content: 'Unbanned all individual members from this VC.', ephemeral: true });
          }
          else if (i.customId === 'vcp_lock') {
            await vc.permissionOverwrites.edit(everyoneRole, { Connect: false });
            await i.reply({ content: 'Voice channel Locked.', ephemeral: true });
          }
          else if (i.customId === 'vcp_unlock') {
            await vc.permissionOverwrites.edit(everyoneRole, { Connect: null });
            await i.reply({ content: 'Voice channel Unlocked.', ephemeral: true });
          }
          else if (i.customId === 'vcp_hide') {
            await vc.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
            await i.reply({ content: 'Voice channel Hidden.', ephemeral: true });
          }
          else if (i.customId === 'vcp_unhide') {
            await vc.permissionOverwrites.edit(everyoneRole, { ViewChannel: null });
            await i.reply({ content: 'Voice channel Unhidden.', ephemeral: true });
          }
          else if (['vcp_mute_1', 'vcp_unmute_1', 'vcp_deafen_1', 'vcp_undeafen_1', 'vcp_kick_1', 'vcp_ban_1', 'vcp_unban_1'].includes(i.customId)) {
            // Single target actions require a Select Menu
            const actionMap = {
              'vcp_mute_1': 'Mute',
              'vcp_unmute_1': 'Unmute',
              'vcp_deafen_1': 'Deafen',
              'vcp_undeafen_1': 'Undeafen',
              'vcp_kick_1': 'Kick',
              'vcp_ban_1': 'Ban',
              'vcp_unban_1': 'Unban'
            };
            const actionName = actionMap[i.customId];
            
            // Build options based on current members, excluding the owner themselves (usually)
            let options = [];
            
            if (i.customId === 'vcp_unban_1') {
              // Unban lists users who are denied
              const overwrites = vc.permissionOverwrites.cache.filter(o => o.type === 1 && o.deny.has('Connect'));
              if (overwrites.size === 0) return i.reply({ content: 'No users are banned from this VC.', ephemeral: true });
              
              for (const [id, overwrite] of overwrites) {
                options.push({ label: `User ID: ${id}`, value: `${i.customId}_${id}` });
              }
            } else {
              // Other actions list connected members
              vc.members.forEach(m => {
                if (m.id !== i.user.id) {
                  options.push({ label: m.user.tag, value: `${i.customId}_${m.id}` });
                }
              });
              if (options.length === 0) return i.reply({ content: 'No other members in VC to target.', ephemeral: true });
            }

            // Select menus max 25 options
            options = options.slice(0, 25);

            const selectMenu = new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('vcp_select')
                .setPlaceholder(`Select user to ${actionName}`)
                .addOptions(options)
            );

            await i.reply({ content: `Please select a user to **${actionName}**:`, components: [selectMenu], ephemeral: true });
          }
        } catch (error) {
          console.error('[VCPanel] Error:', error);
          if (!i.replied && !i.deferred) await i.reply({ content: 'An error occurred.', ephemeral: true });
        }
      });

      // Handle the Dropdown Select Menu interactions
      const selectCollector = panelMsg.channel.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && i.customId === 'vcp_select',
        time: 900000
      });

      selectCollector.on('collect', async (i) => {
        const vc = i.member.voice.channel;
        if (!vc) return i.reply({ content: 'You are no longer in a voice channel!', ephemeral: true });

        const [action, targetId] = i.values[0].split('_', 2);
        const actionFull = i.values[0].substring(0, i.values[0].lastIndexOf('_')); // gets vcp_mute_1 etc

        try {
          if (actionFull === 'vcp_unban_1') {
             await vc.permissionOverwrites.delete(targetId);
             return i.update({ content: `Successfully unbanned user ID ${targetId}.`, components: [] });
          }

          const targetMember = vc.members.get(targetId);
          if (!targetMember) return i.update({ content: 'That user is no longer in the VC.', components: [] });

          if (actionFull === 'vcp_mute_1') {
            await targetMember.voice.setMute(true);
            await i.update({ content: `Muted ${targetMember.user.tag}.`, components: [] });
          } else if (actionFull === 'vcp_unmute_1') {
            await targetMember.voice.setMute(false);
            await i.update({ content: `Unmuted ${targetMember.user.tag}.`, components: [] });
          } else if (actionFull === 'vcp_deafen_1') {
            await targetMember.voice.setDeaf(true);
            await i.update({ content: `Deafened ${targetMember.user.tag}.`, components: [] });
          } else if (actionFull === 'vcp_undeafen_1') {
            await targetMember.voice.setDeaf(false);
            await i.update({ content: `Undeafened ${targetMember.user.tag}.`, components: [] });
          } else if (actionFull === 'vcp_kick_1') {
            await targetMember.voice.disconnect();
            await i.update({ content: `Kicked ${targetMember.user.tag}.`, components: [] });
          } else if (actionFull === 'vcp_ban_1') {
            await vc.permissionOverwrites.edit(targetId, { Connect: false });
            await targetMember.voice.disconnect();
            await i.update({ content: `Banned ${targetMember.user.tag} from the VC.`, components: [] });
          }
        } catch (error) {
          console.error('[VCPanel] Dropdown error:', error);
          if (!i.replied && !i.deferred) await i.update({ content: 'Failed to apply action.', components: [] });
        }
      });
    }
  }
];
