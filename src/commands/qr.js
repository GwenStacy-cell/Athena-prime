import cv2 from '../cv2.js';
import { EmbedBuilder } from 'discord.js';

export const commands = [
  {
    name: 'qrcode',
    aliases: ['generateqr', 'qrc'],
    description: 'Generate a high-resolution QR code for any link or text.',
    category: 'utilities',
    options: [],
    async executePrefix(message, args) {
      if (args.length === 0) {
        return message.reply(cv2.warn('QR Code Generator', 'Usage: `!qrcode <link or text>`'));
      }

      const input = args.join(' ');
      
      const loading = await message.reply({ content: '-# <a:loading:1542155051286396938> **Generating QR Code...**' });
      
      const encodedUrl = encodeURIComponent(input);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${encodedUrl}`;

      const embed = new EmbedBuilder()
        .setDescription(`## **QR Code Generated**\n\n**Data:** \`${input.length > 50 ? input.substring(0, 47) + '...' : input}\``)
        .setImage(qrUrl)
        .setColor('#ffffff')
        .setFooter({ text: 'Athena Bulletproof Security !!!' });

      await loading.edit({ content: null, embeds: [embed] });
    }
  }
];
