import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const brokenSubmit = `    if (interaction.customId === 'modal_app_submit') {
      const config = db.getAppConfig(interaction.guild.id);
      if (!config.logChannel) return interaction.reply({ content: 'Application log channel is not configured!', ephemeral: true }).catch(()=>{});
      
      const logChannel = interaction.guild.channels.cache.get(config.logChannel);
      if (!logChannel) return interaction.reply({ content: 'Application log channel not found!', ephemeral: true }).catch(()=>{});

      const embed = {
        type: 17,
        components: [
          { type: 10, content: \`# New Staff Application\` },
          { type: 14, divider: true },
          { type: 9, components: [{ type: 10, content: \`**Applicant:** <@\${interaction.user.id}>\` }, { type: 10, content: \`**User ID:** \${interaction.user.id}\` }], accessory: { type: 11, media: { url: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) } } },
          { type: 14, divider: true }
        ]
      };

      config.questions.forEach((q, i) => {
        const answer = interaction.fields.getTextInputValue(\`app_q_\${i}\`);
        embed.components.push({ type: 10, content: \`**\${q}**\` });
        embed.components.push({ type: 10, content: \`> \${answer}\` });
      });
      
      embed.components.push({ type: 14, divider: true });

      const btnAccept = new ButtonBuilder().setCustomId(\`btn_app_review_accept_\${interaction.user.id}\`).setLabel('Accept').setStyle(ButtonStyle.Success);
      const btnDeny = new ButtonBuilder().setCustomId(\`btn_app_review_deny_\${interaction.user.id}\`).setLabel('Deny').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(btnAccept, btnDeny);

      await logChannel.send({ components: [embed, row.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
      return interaction.reply({ content: 'Your application has been submitted successfully!', ephemeral: true }).catch(()=>{});
    }`;

const fixedSubmit = `    if (interaction.customId === 'modal_app_submit') {
      await interaction.deferReply({ ephemeral: true }).catch(()=>{});
      
      const config = db.getAppConfig(interaction.guild.id);
      if (!config.logChannel) return interaction.editReply({ content: 'Application log channel is not configured!' }).catch(()=>{});
      
      const logChannel = interaction.guild.channels.cache.get(config.logChannel);
      if (!logChannel) return interaction.editReply({ content: 'Application log channel not found!' }).catch(()=>{});

      const embed = {
        type: 17,
        components: [
          { type: 10, content: \`# New Staff Application\` },
          { type: 14, divider: true },
          { type: 9, components: [{ type: 10, content: \`**Applicant:** <@\${interaction.user.id}>\` }, { type: 10, content: \`**User ID:** \${interaction.user.id}\` }], accessory: { type: 11, media: { url: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) } } },
          { type: 14, divider: true }
        ]
      };

      config.questions.forEach((q, i) => {
        const answer = interaction.fields.getTextInputValue(\`app_q_\${i}\`);
        embed.components.push({ type: 10, content: \`**\${q}**\` });
        embed.components.push({ type: 10, content: \`> \${answer}\` });
      });
      
      embed.components.push({ type: 14, divider: true });

      const btnAccept = new ButtonBuilder().setCustomId(\`btn_app_review_accept_\${interaction.user.id}\`).setLabel('Accept').setStyle(ButtonStyle.Success);
      const btnDeny = new ButtonBuilder().setCustomId(\`btn_app_review_deny_\${interaction.user.id}\`).setLabel('Deny').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(btnAccept, btnDeny);

      await logChannel.send({ components: [embed, row.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
      return interaction.editReply({ content: 'Your application has been submitted successfully!' }).catch(()=>{});
    }`;

js = js.replace(brokenSubmit, fixedSubmit);
fs.writeFileSync("src/events/interactionCreate.js", js);
