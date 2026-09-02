import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

const oldPayload = `  const container = {
    type: 17,
    components: [
      {
        type: 9,
        components: [
          { type: 10, content: \`## Role Authorization Tiers\\n\\n-# **Admin Tier:** Bypasses \\\`isAuthorized()\\\`, granting full root access to the entire bot, including module setups and security dashboard configuration.\\n-# **Mod Tier:** Grants access to intermediate moderation commands.\\n-# **Staff Tier:** Grants access to basic moderation commands.\` }
        ],
        accessory: { type: 11, media: { url: 'https://cdn.discordapp.com/emojis/1525429906102816788.webp?size=128&quality=lossless' } }
      },
      { type: 14, divider: true },
      { type: 10, content: \`### Admin Tier Roles\\n-# **Bound Roles:** \${adminIds}\` },
      { type: 14, divider: true },
      { type: 10, content: \`### Mod Tier Roles\\n-# **Bound Roles:** \${modIds}\` },
      { type: 14, divider: true },
      { type: 10, content: \`### Staff Tier Roles\\n-# **Bound Roles:** \${staffIds}\` }
    ]
  };

  const adminSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('auth_select_admin')
      .setPlaceholder('Bind Admin Roles')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const modSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('auth_select_mod')
      .setPlaceholder('Bind Mod Roles')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const staffSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('auth_select_staff')
      .setPlaceholder('Bind Staff Roles')
      .setMinValues(0)
      .setMaxValues(10)
  );

  return {
    content: "",
    components: [container, adminSelect.toJSON(), modSelect.toJSON(), staffSelect.toJSON()],
    flags: 32768 // MessageFlags.IsComponentsV2
  };`;

const newPayload = `  const adminSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('auth_select_admin')
      .setPlaceholder('Bind Admin Roles')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const modSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('auth_select_mod')
      .setPlaceholder('Bind Mod Roles')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const staffSelect = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('auth_select_staff')
      .setPlaceholder('Bind Staff Roles')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const container = {
    type: 17,
    components: [
      {
        type: 9,
        components: [
          { type: 10, content: \`## Role Authorization Tiers\\n\\n-# **Admin Tier:** Bypasses \\\`isAuthorized()\\\`, granting full root access to the entire bot, including module setups and security dashboard configuration.\\n-# **Mod Tier:** Grants access to intermediate moderation commands.\\n-# **Staff Tier:** Grants access to basic moderation commands.\` }
        ],
        accessory: { type: 11, media: { url: 'https://cdn.discordapp.com/emojis/1525429906102816788.webp?size=128&quality=lossless' } }
      },
      { type: 14, divider: true },
      { type: 10, content: \`### Admin Tier Roles\\n-# **Examples:** \\\`!security\\\`, \\\`!nuke\\\`, \\\`!massrole\\\`, \\\`!enuke\\\`\\n-# **Bound Roles:** \${adminIds}\` },
      adminSelect.toJSON(),
      { type: 14, divider: true },
      { type: 10, content: \`### Mod Tier Roles\\n-# **Examples:** \\\`!ban\\\`, \\\`!kick\\\`, \\\`!timeout\\\`, \\\`!clear\\\`\\n-# **Bound Roles:** \${modIds}\` },
      modSelect.toJSON(),
      { type: 14, divider: true },
      { type: 10, content: \`### Staff Tier Roles\\n-# **Examples:** \\\`!warn\\\`, \\\`!mute\\\`, \\\`!lock\\\`, \\\`!slowmode\\\`\\n-# **Bound Roles:** \${staffIds}\` },
      staffSelect.toJSON()
    ]
  };

  return {
    content: "",
    components: [container],
    flags: 32768 // MessageFlags.IsComponentsV2
  };`;

js = js.replace(oldPayload, newPayload);

fs.writeFileSync("src/commands/auth.js", js);
