import fs from "fs";
let js = fs.readFileSync("src/events/guildMemberAdd.js", "utf8");

const oldHook = `      // ==========================================
      // 4. AUTOROLE
      // ==========================================
      if (config.autoroleIds && config.autoroleIds.length > 0) {
        try {
          const rolesToAdd = [];
          for (const roleId of config.autoroleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role && role.editable) {
              rolesToAdd.push(role);
            }
          }
          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, 'Athena Prime: Autorole').catch(() => null);
          }
        } catch (err) {
          console.error('Failed to assign autoroles:', err);
        }
      }`;

const newHook = `      // ==========================================
      // 4. AUTOROLE (HUMAN & BOT)
      // ==========================================
      try {
        const roleId = member.user.bot ? config.autoroleBot : config.autoroleHuman;
        if (roleId) {
          const role = guild.roles.cache.get(roleId);
          if (role && role.editable) {
            await member.roles.add(role, 'Athena Prime: Autorole (Human/Bot Configuration)').catch(() => null);
          }
        }
      } catch (err) {
        console.error('Failed to assign autoroles:', err);
      }`;

js = js.replace(oldHook, newHook);
fs.writeFileSync("src/events/guildMemberAdd.js", js);
