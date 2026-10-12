// Quick test of current top card
import { generateTopImage } from '../src/utils/statCanvas.js';
import { writeFileSync } from 'fs';

const mockGuild = {
  name: 'EDITORS HEAVEN',
  iconURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
};

const mockMsgTop = [
  { username: 'h4vn._.editz', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png', count: 515 },
  { username: 'hyr0420', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png', count: 266 },
  { username: 'cute_but_kitty', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png', count: 161 },
  { username: 'varq3', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png', count: 145 },
  { username: 'kom1saan', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/4.png', count: 112 },
];

const mockVoiceTop = [
  { username: 'h4vn._.editz', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png', hours: 56.10 },
  { username: 'herix.efx', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png', hours: 19.68 },
  { username: 'hyr0420', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png', hours: 6.47 },
  { username: 'kom1saan', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png', hours: 5.80 },
  { username: 'varq3', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/4.png', hours: 2.81 },
];

try {
  const buf = await generateTopImage(mockGuild, mockMsgTop, mockVoiceTop);
  writeFileSync('test_top_card.png', buf);
  console.log('Top card generated: test_top_card.png');
} catch(e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
