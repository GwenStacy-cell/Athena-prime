import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

const authCode = `
  // ==========================================
  // AUTH TIERS
  // ==========================================
  getAuthRoles(guildId) {
    const config = this.getGuildConfig(guildId);
    if (!config.authRoles) {
      config.authRoles = { admin: [], mod: [], staff: [] };
      this.save();
    }
    return config.authRoles;
  }

  updateAuthRoles(guildId, tier, roleIds) {
    const config = this.getGuildConfig(guildId);
    if (!config.authRoles) config.authRoles = { admin: [], mod: [], staff: [] };
    config.authRoles[tier] = roleIds;
    this.save();
  }
`;

// Insert it right before "getGuildConfig(guildId)"
js = js.replace("  getGuildConfig(guildId) {", authCode + "\n  getGuildConfig(guildId) {");

fs.writeFileSync("src/database.js", js);
