import fs from 'fs';
let code = fs.readFileSync('src/commands/invitelb.js', 'utf8');

const newCommand = `
  },
  {
    name: 'syncinvites',
    slashHidden: true,
    description: 'Retroactively syncs invite data from active Discord invite links.',
    category: 'utility',
    options: [],
    
    async executePrefix(message, args) {
      if (!message.member.permissions.has('Administrator')) {
        return message.reply({ content: 'Only administrators can run this command.' });
      }

      const waitMsg = await message.reply(cv2.info('Syncing...', 'Fetching past invite data from Discord...'));
      
      try {
        const invites = await message.guild.invites.fetch().catch(() => new Map());
        const inviterMap = new Map();
        
        for (const [code, invite] of invites) {
          if (invite.inviter && invite.uses > 0) {
            const currentUses = inviterMap.get(invite.inviter.id) || 0;
            inviterMap.set(invite.inviter.id, currentUses + invite.uses);
          }
        }
        
        if (inviterMap.size === 0) {
          return waitMsg.edit(cv2.warn('No Invites', 'There are no active invites with uses to sync.'));
        }
        
        for (const [inviterId, uses] of inviterMap.entries()) {
          statsDB.syncRetroactiveInvites(message.guild.id, inviterId, uses);
        }
        
        await waitMsg.edit(cv2.success('Sync Complete', \`Successfully synced **\${inviterMap.size}** users' past invites into the database! You can now view the leaderboard.\`));
      } catch (err) {
        console.error(err);
        await waitMsg.edit(cv2.danger('Error', 'Failed to sync invites. Ensure I have the Manage Server permission to read invites.'));
      }
    }
`;

code = code.replace(/  }\n\];/, newCommand + "  }\n];");
fs.writeFileSync('src/commands/invitelb.js', code);
