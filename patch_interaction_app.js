import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// We need to add logic for btn_app_apply, btn_app_accept, btn_app_deny
const btnSearch = `  if (interaction.isButton()) {`;
const btnInsert = `  if (interaction.isButton()) {
    if (interaction.customId === 'btn_app_apply') {
      import('../database.js').then(db => {
        const config = db.default.getAppConfig(interaction.guild.id);
        if (!config.questions || config.questions.length === 0) return interaction.reply({ content: 'There are no questions configured for this application.', ephemeral: true });
        
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder().setCustomId('modal_app_submit').setTitle('Staff Application');
        
        config.questions.forEach((q, i) => {
          const input = new TextInputBuilder()
            .setCustomId(\`app_q_\${i}\`)
            .setLabel(q.length > 45 ? q.substring(0, 42) + '...' : q)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
        });
        
        interaction.showModal(modal).catch(console.error);
      });
      return;
    }

    if (interaction.customId.startsWith('btn_app_review_')) {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const action = interaction.customId.split('_')[3]; // 'accept' or 'deny'
      const targetId = interaction.customId.split('_')[4];
      
      const modal = new ModalBuilder().setCustomId(\`modal_app_review_\${action}_\${targetId}\`).setTitle(action === 'accept' ? 'Accept Application' : 'Deny Application');
      const input = new TextInputBuilder().setCustomId('review_reason').setLabel('Reason (sent to user)').setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      interaction.showModal(modal).catch(console.error);
      return;
    }
`;

js = js.replace(btnSearch, btnInsert);

// Now handle modal submissions
const modalSearch = `    if (interaction.customId === 'modal_quote_id' || interaction.customId === 'modal_quote_custom') {`;
const modalInsert = `    if (interaction.customId === 'modal_app_add_q') {
      import('../commands/app.js').then(m => m.handleAppManagerModals(interaction)).catch(console.error);
      return;
    }

    if (interaction.customId === 'modal_app_submit') {
      import('../database.js').then(async db => {
        const config = db.default.getAppConfig(interaction.guild.id);
        if (!config.logChannel) return interaction.reply({ content: 'Application log channel is not configured!', ephemeral: true });
        
        const logChannel = interaction.guild.channels.cache.get(config.logChannel);
        if (!logChannel) return interaction.reply({ content: 'Application log channel not found!', ephemeral: true });

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

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
        const btnAccept = new ButtonBuilder().setCustomId(\`btn_app_review_accept_\${interaction.user.id}\`).setLabel('Accept').setStyle(ButtonStyle.Success);
        const btnDeny = new ButtonBuilder().setCustomId(\`btn_app_review_deny_\${interaction.user.id}\`).setLabel('Deny').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(btnAccept, btnDeny);

        await logChannel.send({ components: [embed, row.toJSON()], flags: MessageFlags.IsComponentsV2 });
        return interaction.reply({ content: 'Your application has been submitted successfully!', ephemeral: true });
      });
      return;
    }

    if (interaction.customId.startsWith('modal_app_review_')) {
      const parts = interaction.customId.split('_');
      const action = parts[3]; // accept or deny
      const targetId = parts[4];
      const reason = interaction.fields.getTextInputValue('review_reason');
      
      const { MessageFlags } = require('discord.js');
      const embed = interaction.message.components[0].toJSON();
      
      // Remove buttons
      await interaction.message.edit({ components: [embed] });
      
      // Append review result to embed
      embed.components.push({ type: 10, content: \`### Result: \${action === 'accept' ? '✅ Accepted' : '❌ Denied'} by <@\${interaction.user.id}>\` });
      embed.components.push({ type: 10, content: \`**Reason:** \${reason}\` });
      
      await interaction.message.edit({ components: [embed, interaction.message.components[1]?.toJSON()].filter(Boolean), flags: MessageFlags.IsComponentsV2 });

      try {
        const target = await interaction.guild.members.fetch(targetId);
        import('../cv2.js').then(cv2 => {
           target.send(cv2.default[action === 'accept' ? 'success' : 'danger'](\`Application \${action === 'accept' ? 'Accepted' : 'Denied'}\`, \`**Server:** \${interaction.guild.name}\\n**Reason:** \${reason}\`)).catch(() => null);
        });
      } catch(e) {}
      
      return interaction.reply({ content: \`Application \${action}ed successfully.\`, ephemeral: true });
    }

    if (interaction.customId === 'modal_quote_id' || interaction.customId === 'modal_quote_custom') {`;

js = js.replace(modalSearch, modalInsert);
fs.writeFileSync("src/events/interactionCreate.js", js);
