const fs = require('fs');
let code = fs.readFileSync('src/commands/buildserver.js', 'utf8');

// Replace the previous role definitions block with the randomized colors
const newRoleCode = `
        // 2. Create Aesthetic Roles
        const formatRole = (name) => '.        ' + name + '         .';
        const randomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        const roleDefinitions = [
          { name: formatRole('The Overlords'), color: randomColor(), permissions: [PermissionFlagsBits.Administrator] },
          { name: formatRole('High Council'), color: randomColor(), permissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages] },
          { name: formatRole('Ban Hammers'), color: randomColor(), permissions: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages] },
          { name: formatRole('Trial Interns'), color: randomColor(), permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers] },
          { name: formatRole('Sugar Daddies'), color: randomColor(), permissions: [] }, // Boosters/VIPs
          { name: formatRole('No Lifers'), color: randomColor(), permissions: [] }, // Level 10+
          { name: formatRole('Verified Humans'), color: randomColor(), permissions: [] }, // Base Members
          { name: formatRole('Giveaway Addicts'), color: randomColor(), permissions: [] }, // Ping Role
          { name: formatRole('Event Crashers'), color: randomColor(), permissions: [] }, // Ping Role
          { name: formatRole('In Quarantine'), color: '#2b2d31', permissions: [] } // Hidden/Grey
        ];

        for (const roleDef of roleDefinitions) {
          try {
            await message.guild.roles.create({
              name: roleDef.name,
              color: roleDef.color,
              permissions: roleDef.permissions,
              reason: 'Auto-building server aesthetic roles'
            });
          } catch (e) {
            console.error('Failed to create role:', roleDef.name);
          }
        }
`;

// we need to replace the old block from "// 2. Create Aesthetic Roles" to "console.error('Failed to create role:', roleDef.name);\n          }\n        }"
const regex = /\/\/ 2\. Create Aesthetic Roles[\s\S]*?console\.error\('Failed to create role:', roleDef\.name\);\s*\}\s*\}/;
code = code.replace(regex, newRoleCode.trim());

fs.writeFileSync('src/commands/buildserver.js', code);
console.log('Replaced with random colors!');
