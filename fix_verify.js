import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const searchStr = `      // ENUKE BUTTON`;
const injectStr = `      // VERIFICATION BUTTON
      if (interaction.customId === 'verify_button') {
        const verifyData = db.getVerification(interaction.guild.id);
        if (!verifyData || !verifyData.roleId) {
          return await interaction.reply({ content: '-# **Verification system is not properly configured.**', ephemeral: true }).catch(() => null);
        }
        
        try {
          const role = interaction.guild.roles.cache.get(verifyData.roleId);
          if (!role) {
             return await interaction.reply({ content: '-# **The verification role no longer exists.**', ephemeral: true }).catch(() => null);
          }
          if (interaction.member.roles.cache.has(verifyData.roleId)) {
             return await interaction.reply({ content: '-# **You are already verified.**', ephemeral: true }).catch(() => null);
          }
          await interaction.member.roles.add(role);
          return await interaction.reply({ content: '-# <:emoji_16:1521464002046328944> **Identity Authenticated! You have been granted access to the server.**', ephemeral: true }).catch(() => null);
        } catch (err) {
          return await interaction.reply({ content: '-# **Failed to assign the verification role. Ensure my role is higher than the verification role.**', ephemeral: true }).catch(() => null);
        }
      }

`;

code = code.replace(searchStr, injectStr + searchStr);
fs.writeFileSync('src/events/interactionCreate.js', code);
