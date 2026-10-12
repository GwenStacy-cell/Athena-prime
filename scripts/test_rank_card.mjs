// Test rank card generation
import { generateRankCard } from '../src/utils/canvasCards.js';
import { writeFileSync } from 'fs';

// Mock member object
const mockMember = {
  displayName: 'H4VN OWNER',
  user: {
    username: 'h4vn.owner',
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
  }
};

try {
  const attachment = await generateRankCard(mockMember, 940, 2, 1, 1200);
  writeFileSync('test_rank_card.png', attachment.attachment);
  console.log('Test rank card generated: test_rank_card.png');
} catch (e) {
  console.error('Error generating rank card:', e);
  process.exit(1);
}
