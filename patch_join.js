import fs from "fs";
let js = fs.readFileSync("src/events/guildMemberAdd.js", "utf8");

const oldLogic = `      // ==========================================
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

const newLogic = `      // ==========================================
      // 4. AUTOROLE (HUMAN & BOT)
      // ==========================================
      try {
        const rawRoleIds = member.user.bot ? config.autoroleBot : config.autoroleHuman;
        if (rawRoleIds) {
          const roleIdsArray = Array.isArray(rawRoleIds) ? rawRoleIds : [rawRoleIds];
          const rolesToAdd = [];
          for (const rId of roleIdsArray) {
            const role = guild.roles.cache.get(rId);
            if (role && role.editable) rolesToAdd.push(role);
          }
          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, 'Athena Prime: Autorole (Human/Bot Configuration)').catch(() => null);
          }
        }
      } catch (err) {
        console.error('Failed to assign autoroles:', err);
      }`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync("src/events/guildMemberAdd.js", js);
