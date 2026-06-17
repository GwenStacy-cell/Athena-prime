export default {
  name: 'inviteCreate',
  async execute(invite) {
    const client = invite.client;
    if (!client.invites) client.invites = new Map();
    
    let guildInvites = client.invites.get(invite.guild.id);
    if (!guildInvites) {
      guildInvites = new Map();
      client.invites.set(invite.guild.id, guildInvites);
    }
    
    guildInvites.set(invite.code, invite.uses || 0);
  }
};
