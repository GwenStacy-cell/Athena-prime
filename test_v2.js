import { ActionRowBuilder, RoleSelectMenuBuilder } from 'discord.js';

function buildAuthPayload() {
  const container = {
    type: 17,
    components: [
      {
        type: 9,
        components: [
          { type: 10, content: `## Role Authorization Tiers\n\n-# **Admin Tier:** Bypasses \`isAuthorized()\`, granting full root access to the entire bot, including module setups and security dashboard configuration.\n-# **Mod Tier:** Grants access to intermediate moderation commands.\n-# **Staff Tier:** Grants access to basic moderation commands.` }
        ],
        accessory: { type: 11, media: { url: 'https://cdn.discordapp.com/emojis/1525429906102816788.webp?size=128&quality=lossless' } }
      },
      {
        type: 1,
        components: [
          {
            type: 6,
            custom_id: 'test_admin',
            placeholder: 'Bind Admin Roles',
            min_values: 0,
            max_values: 10
          }
        ]
      }
    ]
  };

  return {
    content: "",
    components: [container],
    flags: 32768
  };
}

const p = buildAuthPayload();
console.log(JSON.stringify(p, null, 2));
