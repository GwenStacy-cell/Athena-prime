import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const brokenBlock = `      else if (customId === 'am_select_honeypot_channel') {
        const channelId = interaction.values[0];
        import('discord.js').then(({ ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder }) => {
        const modal = new ModalBuilder()
          .setCustomId(\`modal_honeypot_\${channelId}\`)
          .setTitle('Honeypot Trap Setup');
          
        const bannerInput = new TextInputBuilder()
          .setCustomId('banner_url')
          .setLabel('Banner Image URL (Optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('https://example.com/banner.png');
          
                const timeoutInput = new TextInputBuilder()
          .setCustomId('timeout_minutes')
          .setLabel('Timeout Duration (Minutes)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('15');
          
        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput), new ActionRowBuilder().addComponents(timeoutInput));
        return interaction.showModal(modal);
      }`;

const fixedBlock = `      else if (customId === 'am_select_honeypot_channel') {
        const channelId = interaction.values[0];
        import('discord.js').then(({ ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder }) => {
          const modal = new ModalBuilder()
            .setCustomId(\`modal_honeypot_\${channelId}\`)
            .setTitle('Honeypot Trap Setup');
            
          const bannerInput = new TextInputBuilder()
            .setCustomId('banner_url')
            .setLabel('Banner Image URL (Optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://example.com/banner.png');
            
          const timeoutInput = new TextInputBuilder()
            .setCustomId('timeout_minutes')
            .setLabel('Timeout Duration (Minutes)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('15');
            
          modal.addComponents(new ActionRowBuilder().addComponents(bannerInput), new ActionRowBuilder().addComponents(timeoutInput));
          return interaction.showModal(modal).catch(console.error);
        }).catch(console.error);
      }`;

js = js.replace(brokenBlock, fixedBlock);

// While we are at it, let's also fix btn_app_review_ because it had the exact same structure!
const brokenReviewBlock = `    if (interaction.customId.startsWith('btn_app_review_')) {
      import('discord.js').then(({ ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder }) => {
      const action = interaction.customId.split('_')[3]; // 'accept' or 'deny'
      const targetId = interaction.customId.split('_')[4];
      
      const modal = new ModalBuilder().setCustomId(\`modal_app_review_\${action}_\${targetId}\`).setTitle(action === 'accept' ? 'Accept Application' : 'Deny Application');
      const input = new TextInputBuilder().setCustomId('review_reason').setLabel('Reason (sent to user)').setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      interaction.showModal(modal).catch(console.error);
      });
      return;
    }`;

// That one actually looks properly closed! `});` is right above `return;`

// Check where the syntax error was exactly by running node --check again
fs.writeFileSync("src/events/interactionCreate.js", js);
