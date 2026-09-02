import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldAuth = `      // AUTH SELECTORS
      if (interaction.customId.startsWith('auth_select_')) {
        const tier = interaction.customId.split('_')[2]; // admin, mod, or staff
        const selectedRoles = interaction.values; // Array of Role IDs
        
        db.updateAuthRoles(interaction.guild.id, tier, selectedRoles);`;

const newAuth = `      // AUTH SELECTORS
      if (interaction.customId.startsWith('auth_select_')) {
        const { isServerAdmin } = await import('../utils/helpers.js');
        if (!isServerAdmin(interaction.member, interaction.guild.id)) {
          return await interaction.reply({ content: '-# **Access Denied. Only Server Admins can modify Auth Tiers.**', flags: 64 }).catch(()=>null);
        }
      
        const tier = interaction.customId.split('_')[2]; // admin, mod, or staff
        const selectedRoles = interaction.values; // Array of Role IDs
        
        db.updateAuthRoles(interaction.guild.id, tier, selectedRoles);`;

js = js.replace(oldAuth, newAuth);

fs.writeFileSync("src/events/interactionCreate.js", js);
