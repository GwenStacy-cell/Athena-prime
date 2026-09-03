import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const broken = `  if (interaction.isButton()) {
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
    }`;

const fixed = `  if (interaction.isButton()) {
    if (interaction.customId === 'btn_app_apply') {
      try {
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
        
        return await interaction.showModal(modal);
      } catch (err) {
        return interaction.reply({ content: \`Crash detected: \${err.message}\`, ephemeral: true }).catch(console.error);
      }
    }`;

js = js.replace(broken, fixed);
fs.writeFileSync("src/events/interactionCreate.js", js);
