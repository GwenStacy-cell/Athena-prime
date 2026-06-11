import { checkWebhook } from '../utils/antinuke.js';

export default {
  name: 'webhookUpdate',
  async execute(channel) {
    if (!channel?.guild) return;
    await checkWebhook(channel.guild);
  }
};
