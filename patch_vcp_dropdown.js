const selectInject = `
    // --- VC PANEL DROPDOWNS ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'vcp_select') {
      const i = interaction;
      if (i.user.id !== i.guild.ownerId && !isBotOwnerSync(i.user.id) && !isExtraOwner(i.guild.id, i.user.id)) {
        return i.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.', flags: 64 }).catch(()=>{});
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

js = js.replace("async execute(interaction) {", "async execute(interaction) {\n" + selectInject);

fs.writeFileSync("src/events/interactionCreate.js", js);
console.log("Injected missing vcp_select handler!");
