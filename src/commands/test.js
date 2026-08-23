import { MessageFlags } from 'discord.js';

export const commands = [
  {
    name: 'testcv2',
    async executePrefix(message) {
      const container = {
        type: 17,
        components: [
          {
            type: 9,
            components: [{ type: 10, content: 'Test with transparent media' }],
            accessory: { type: 11, media: { url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif' } }
          }
        ]
      };
      
      const container2 = {
        type: 17,
        components: [
          {
            type: 9,
            components: [{ type: 10, content: 'Test with invisible button' }],
            accessory: { type: 2, custom_id: 'dummy', label: ' ', style: 2, disabled: true }
          }
        ]
      };

      try {
        await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        message.channel.send('Transparent media worked!');
      } catch (e) {
        message.channel.send('Transparent media failed: ' + e.message);
      }

      try {
        await message.channel.send({ components: [container2], flags: MessageFlags.IsComponentsV2 });
        message.channel.send('Invisible button worked!');
      } catch (e) {
        message.channel.send('Invisible button failed: ' + e.message);
      }
    }
  }
];
