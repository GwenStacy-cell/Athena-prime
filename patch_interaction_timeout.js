import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const brokenModal = `    if (interaction.customId.startsWith('modal_app_review_')) {
      const parts = interaction.customId.split('_');
      const action = parts[3];
      const targetId = parts[4];
      const reason = interaction.fields.getTextInputValue('review_reason');
      
      const embed = interaction.message.components[0].toJSON();
      
      await interaction.message.edit({ components: [embed] }).catch(()=>{});
      
      embed.components.push({ type: 10, content: \`### Result: \${action === 'accept' ? '✅ Accepted' : '❌ Denied'} by <@\${interaction.user.id}>\` });
      embed.components.push({ type: 10, content: \`**Reason:** \${reason}\` });
      
      await interaction.message.edit({ components: [embed, interaction.message.components[1]?.toJSON()].filter(Boolean), flags: MessageFlags.IsComponentsV2 }).catch(()=>{});

      try {
        const target = await interaction.guild.members.fetch(targetId);
        target.send(cv2[action === 'accept' ? 'success' : 'danger'](\`Application \${action === 'accept' ? 'Accepted' : 'Denied'}\`, \`**Server:** \${interaction.guild.name}\\n**Reason:** \${reason}\`)).catch(() => null);
      } catch(e) {}
      
      return interaction.reply({ content: \`Application \${action}ed successfully.\`, ephemeral: true }).catch(()=>{});
    }`;

const fixedModal = `    if (interaction.customId.startsWith('modal_app_review_')) {
      const parts = interaction.customId.split('_');
      const action = parts[3];
      const targetId = parts[4];
      const reason = interaction.fields.getTextInputValue('review_reason');
      
      const embed = interaction.message.components[0].toJSON();
      
      embed.components.push({ type: 10, content: \`### Result: \${action === 'accept' ? '<:emoji_16:1521464002046328944> Accepted' : '<:cross_red:1533860128015519895> Denied'} by <@\${interaction.user.id}>\` });
      embed.components.push({ type: 10, content: \`**Reason:** \${reason}\` });
      
      await interaction.update({ components: [embed], flags: MessageFlags.IsComponentsV2 }).catch(console.error);

      // Async DM task so it doesn't block interaction timeout
      interaction.guild.members.fetch(targetId).then(target => {
        if (target) {
          target.send(cv2[action === 'accept' ? 'success' : 'danger'](\`Application \${action === 'accept' ? 'Accepted' : 'Denied'}\`, \`**Server:** \${interaction.guild.name}\\n**Reason:** \${reason}\`)).catch(() => null);
        }
      }).catch(()=>{});
      return;
    }`;

js = js.replace(brokenModal, fixedModal);
fs.writeFileSync("src/events/interactionCreate.js", js);
