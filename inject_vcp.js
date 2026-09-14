const injectCode = `
    // --- VC PANEL BUTTONS ---
    if (interaction.customId.startsWith('vcp_')) {
      const botOwnerId = '1509084068619489331';
      if (interaction.user.id !== interaction.guild.ownerId && interaction.user.id !== botOwnerId) {
        return interaction.reply({ content: 'Only the Server Owner and Bot Owner can use this panel.', flags: 64 }).catch(()=>{});
      }

      const vc = interaction.member.voice.channel;
      if (!vc) {
        return interaction.reply({ content: 'You must be in a voice channel to use these controls!', flags: 64 }).catch(()=>{});
      }

      const everyoneRole = interaction.guild.roles.everyone;
      const i = interaction;

      try {
        if (i.customId === 'vcp_mute_all') {
          vc.members.forEach(m => { if (m.id !== i.user.id) m.voice.setMute(true).catch(()=>{}); });
          return i.reply({ content: 'Muted all other members.', flags: 64 }).catch(()=>{});
        } 
        else if (i.customId === 'vcp_unmute_all') {
          vc.members.forEach(m => { m.voice.setMute(false).catch(()=>{}); });
          return i.reply({ content: 'Unmuted all members.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_deafen_all') {
          vc.members.forEach(m => { if (m.id !== i.user.id) m.voice.setDeaf(true).catch(()=>{}); });
          return i.reply({ content: 'Deafened all other members.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_undeafen_all') {
          vc.members.forEach(m => { m.voice.setDeaf(false).catch(()=>{}); });
          return i.reply({ content: 'Undeafened all members.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_kick_all') {
          vc.members.forEach(m => { if (m.id !== i.user.id) m.voice.disconnect().catch(()=>{}); });
          return i.reply({ content: 'Kicked all other members from VC.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_ban_all') {
          vc.members.forEach(m => {
            if (m.id !== i.user.id) {
              vc.permissionOverwrites.edit(m.id, { Connect: false }).catch(()=>{});
              m.voice.disconnect().catch(()=>{});
            }
          });
          return i.reply({ content: 'Banned all other members from this VC.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_unban_all') {
          const overwrites = vc.permissionOverwrites.cache;
          overwrites.forEach(overwrite => {
            if (overwrite.type === 1) {
              vc.permissionOverwrites.delete(overwrite.id).catch(()=>{});
            }
          });
          return i.reply({ content: 'Unbanned all individual members from this VC.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_lock') {
          await vc.permissionOverwrites.edit(everyoneRole, { Connect: false }).catch(()=>{});
          return i.reply({ content: 'Voice channel Locked.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_unlock') {
          await vc.permissionOverwrites.edit(everyoneRole, { Connect: null }).catch(()=>{});
          return i.reply({ content: 'Voice channel Unlocked.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_hide') {
          await vc.permissionOverwrites.edit(everyoneRole, { ViewChannel: false }).catch(()=>{});
          return i.reply({ content: 'Voice channel Hidden.', flags: 64 }).catch(()=>{});
        }
        else if (i.customId === 'vcp_unhide') {
          await vc.permissionOverwrites.edit(everyoneRole, { ViewChannel: null }).catch(()=>{});
          return i.reply({ content: 'Voice channel Unhidden.', flags: 64 }).catch(()=>{});
        }
        else if (['vcp_mute_1', 'vcp_unmute_1', 'vcp_deafen_1', 'vcp_undeafen_1', 'vcp_kick_1', 'vcp_ban_1', 'vcp_unban_1'].includes(i.customId)) {
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
          let options = [];
          
          if (i.customId === 'vcp_unban_1') {
            const overwrites = vc.permissionOverwrites.cache.filter(o => o.type === 1 && o.deny.has('Connect'));
            if (overwrites.size === 0) return i.reply({ content: 'No users are banned from this VC.', flags: 64 }).catch(()=>{});
            for (const [id, overwrite] of overwrites) {
              options.push({ label: \`User ID: \${id}\`, value: \`\${i.customId}_\${id}\` });
            }
          } else {
            vc.members.forEach(m => {
              if (m.id !== i.user.id) {
                options.push({ label: m.user.tag, value: \`\${i.customId}_\${m.id}\` });
              }
            });
            if (options.length === 0) return i.reply({ content: 'No other members in VC to target.', flags: 64 }).catch(()=>{});
          }

          options = options.slice(0, 25);
          const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('vcp_select')
              .setPlaceholder(\`Select user to \${actionName}\`)
              .addOptions(options)
          );

          return i.reply({ content: \`Please select a user to **\${actionName}**:\`, components: [selectMenu], flags: 64 }).catch(()=>{});
        }
      } catch (error) {
        console.error('[VCPanel] Button error:', error);
        if (!i.replied && !i.deferred) return i.reply({ content: 'An error occurred.', flags: 64 }).catch(()=>{});
      }
    }
`;

const selectInject = `
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'vcp_select') {
      const botOwnerId = '1509084068619489331';
      const i = interaction;
      if (i.user.id !== i.guild.ownerId && i.user.id !== botOwnerId) {
        return i.reply({ content: 'Only the Server Owner and Bot Owner can use this panel.', flags: 64 }).catch(()=>{});
      }

      const vc = i.member.voice.channel;
      if (!vc) return i.reply({ content: 'You must be in a voice channel!', flags: 64 }).catch(()=>{});

      const actionFull = i.values[0].substring(0, i.values[0].lastIndexOf('_'));
      const targetId = i.values[0].substring(i.values[0].lastIndexOf('_') + 1);

      try {
        if (actionFull === 'vcp_unban_1') {
           await vc.permissionOverwrites.delete(targetId).catch(()=>{});
           return i.update({ content: \`Successfully unbanned user ID \${targetId}.\`, components: [] }).catch(()=>{});
        }

        const targetMember = vc.members.get(targetId);
        if (!targetMember) return i.update({ content: 'That user is no longer in the VC.', components: [] }).catch(()=>{});

        if (actionFull === 'vcp_mute_1') {
          await targetMember.voice.setMute(true).catch(()=>{});
          return i.update({ content: \`Muted \${targetMember.user.tag}.\`, components: [] }).catch(()=>{});
        } else if (actionFull === 'vcp_unmute_1') {
          await targetMember.voice.setMute(false).catch(()=>{});
          return i.update({ content: \`Unmuted \${targetMember.user.tag}.\`, components: [] }).catch(()=>{});
        } else if (actionFull === 'vcp_deafen_1') {
          await targetMember.voice.setDeaf(true).catch(()=>{});
          return i.update({ content: \`Deafened \${targetMember.user.tag}.\`, components: [] }).catch(()=>{});
        } else if (actionFull === 'vcp_undeafen_1') {
          await targetMember.voice.setDeaf(false).catch(()=>{});
          return i.update({ content: \`Undeafened \${targetMember.user.tag}.\`, components: [] }).catch(()=>{});
        } else if (actionFull === 'vcp_kick_1') {
          await targetMember.voice.disconnect().catch(()=>{});
          return i.update({ content: \`Kicked \${targetMember.user.tag}.\`, components: [] }).catch(()=>{});
        } else if (actionFull === 'vcp_ban_1') {
          await vc.permissionOverwrites.edit(targetId, { Connect: false }).catch(()=>{});
          await targetMember.voice.disconnect().catch(()=>{});
          return i.update({ content: \`Banned \${targetMember.user.tag} from the VC.\`, components: [] }).catch(()=>{});
        }
      } catch (error) {
        console.error('[VCPanel] Dropdown error:', error);
        if (!i.replied && !i.deferred) return i.update({ content: 'Failed to apply action.', components: [] }).catch(()=>{});
      }
    }
`;

import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

if (!js.includes("vcp_mute_all")) {
    js = js.replace("if (interaction.isButton()) {", "if (interaction.isButton()) {\n" + injectCode);
}
if (!js.includes("vcp_select")) {
    js = js.replace("if (interaction.isStringSelectMenu()) {", selectInject);
}

fs.writeFileSync("src/events/interactionCreate.js", js);
console.log("Injected globally!");
