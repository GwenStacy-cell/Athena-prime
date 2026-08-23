import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const searchStr = `      // ENUKE BUTTON`;
const injectStr = `      // SERVER SCANNER BUTTONS
      if (interaction.customId.startsWith('scanserver_')) {
        const { handleScanServer } = await import('../commands/security.js');
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const page = parseInt(parts[2] || '0', 10);
        
        try {
          if (action === 'prev') {
            const newPanel = await handleScanServer(interaction.guild, page - 1);
            return await interaction.update(newPanel);
          }
          if (action === 'next') {
            const newPanel = await handleScanServer(interaction.guild, page + 1);
            return await interaction.update(newPanel);
          }
          if (action === 'ban') {
             const botId = interaction.values[0];
             await interaction.guild.members.ban(botId, { reason: 'Unauthorized Bot Banned via Scanner' }).catch(() => null);
             const newPanel = await handleScanServer(interaction.guild, page);
             return await interaction.update(newPanel);
          }
          if (action === 'banall') {
             await interaction.guild.members.fetch();
             const db = (await import('../database.js')).default;
             const config = db.getGuildConfig(interaction.guild.id);
             const whitelistedIds = config.botWhitelist || [];
             const allBots = interaction.guild.members.cache.filter(m => m.user.bot && !whitelistedIds.includes(m.id) && m.id !== interaction.client.user.id);
             
             for (const [id, bot] of allBots) {
                await interaction.guild.members.ban(id, { reason: 'Mass Ban via Scanner' }).catch(() => null);
             }
             const newPanel = await handleScanServer(interaction.guild, page);
             return await interaction.update(newPanel);
          }
        } catch (err) {
          console.error(err);
          return await interaction.reply({ content: 'An error occurred while processing the scanner action.', ephemeral: true }).catch(() => null);
        }
      }

`;

code = code.replace(searchStr, injectStr + searchStr);
fs.writeFileSync('src/events/interactionCreate.js', code);
