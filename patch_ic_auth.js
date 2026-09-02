import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const authInterceptors = `
      // AUTH SELECTORS
      if (interaction.customId.startsWith('auth_select_')) {
        const tier = interaction.customId.split('_')[2]; // admin, mod, or staff
        const selectedRoles = interaction.values; // Array of Role IDs
        
        db.updateAuthRoles(interaction.guild.id, tier, selectedRoles);
        
        const { buildAuthPayload } = await import('../commands/auth.js');
        const payload = buildAuthPayload(interaction.guild.id);
        
        return await interaction.update(payload).catch(() => null);
      }
`;

// Insert it right after "// RATE EDIT BUTTONS" section (or before)
js = js.replace("      // ENUKE BUTTON", authInterceptors + "      // ENUKE BUTTON");

fs.writeFileSync("src/events/interactionCreate.js", js);
