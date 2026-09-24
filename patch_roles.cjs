const fs = require('fs');
let code = fs.readFileSync('src/commands/buildserver.js', 'utf8');

const roleCode = `
        // 2. Create Aesthetic Roles
        const formatRole = (name) => '.        ' + name + '         .';
        const roleDefinitions = [
          { name: formatRole('The Overlords'), color: '#ff0000', permissions: [PermissionFlagsBits.Administrator] },
          { name: formatRole('High Council'), color: '#ff5500', permissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages] },
          { name: formatRole('Ban Hammers'), color: '#ffaa00', permissions: [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages] },
          { name: formatRole('Trial Interns'), color: '#ffff00', permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.MuteMembers] },
          { name: formatRole('Sugar Daddies'), color: '#ff00ff', permissions: [] }, // Boosters/VIPs
          { name: formatRole('No Lifers'), color: '#00ffff', permissions: [] }, // Level 10+
          { name: formatRole('Verified Humans'), color: '#00ff00', permissions: [] }, // Base Members
          { name: formatRole('Giveaway Addicts'), color: '#9900ff', permissions: [] }, // Ping Role
          { name: formatRole('Event Crashers'), color: '#ff0055', permissions: [] }, // Ping Role
          { name: formatRole('In Quarantine'), color: '#2b2d31', permissions: [] } // Muted/Jailed
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

code = code.replace(
  'const formatName = (name) => `.       ${name.toLowerCase()}`;',
  roleCode + '\n        const formatName = (name) => `.       ${name.toLowerCase()}`;'
);

fs.writeFileSync('src/commands/buildserver.js', code);
console.log('Injected role building code!');
