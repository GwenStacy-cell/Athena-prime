export default {
  name: 'emojiCreate',
  async execute(emoji) {
    if (!emoji.guild) return;
    // handled by guildAuditLogEntryCreate
  }
};
