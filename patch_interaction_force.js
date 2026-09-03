import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Remove all app logic from the bottom
js = js.replace(/if \(interaction\.customId === 'btn_app_apply'\) \{[\s\S]*?return interaction\.showModal\(modal\)\.catch\(console\.error\);\n    \}/, "");
js = js.replace(/if \(interaction\.customId\.startsWith\('btn_app_review_'\)\) \{[\s\S]*?return interaction\.showModal\(modal\)\.catch\(console\.error\);\n    \}/, "");
js = js.replace(/if \(interaction\.customId === 'modal_app_submit'\) \{[\s\S]*?return interaction\.reply\(\{ content: 'Your application has been submitted successfully!', ephemeral: true \}\);\n    \}/, "");
js = js.replace(/if \(interaction\.customId\.startsWith\('modal_app_review_'\)\) \{[\s\S]*?return interaction\.reply\(\{ content: `Application \$\{action\}ed successfully\.`, ephemeral: true \}\);\n    \}/, "");

// Inject it cleanly at the very top of the execute function
const injectTarget = `  async execute(interaction) {
  if (!interaction.guild && !(interaction.isButton() && interaction.customId.startsWith('gen_invite_'))) return;`;

const newLogic = `  async execute(interaction) {
  if (!interaction.guild && !(interaction.isButton() && interaction.customId.startsWith('gen_invite_'))) return;

  // --- APP BUILDER ---
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_app_apply') {
      const config = db.getAppConfig(interaction.guild.id);
      if (!config.questions || config.questions.length === 0) return interaction.reply({ content: 'There are no questions configured for this application.', ephemeral: true }).catch(()=>{});
      
      const modal = new ModalBuilder().setCustomId('modal_app_submit').setTitle('Staff Application');
      
      config.questions.forEach((q, i) => {
        const input = new TextInputBuilder()
          .setCustomId(\`app_q_\${i}\`)
          .setLabel(q.length > 45 ? q.substring(0, 42) + '...' : q)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      });
      
      return interaction.showModal(modal).catch(console.error);
    }

    if (interaction.customId.startsWith('btn_app_review_')) {
      const action = interaction.customId.split('_')[3];
      const targetId = interaction.customId.split('_')[4];
      
      const modal = new ModalBuilder().setCustomId(\`modal_app_review_\${action}_\${targetId}\`).setTitle(action === 'accept' ? 'Accept Application' : 'Deny Application');
      const input = new TextInputBuilder().setCustomId('review_reason').setLabel('Reason (sent to user)').setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal).catch(console.error);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_app_submit') {
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
    }

    if (interaction.customId.startsWith('modal_app_review_')) {
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
    }
  }`;

js = js.replace(injectTarget, newLogic);
fs.writeFileSync("src/events/interactionCreate.js", js);
