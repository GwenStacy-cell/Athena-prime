import fs from 'fs';
import { generateServerOverviewImage } from './src/utils/statCanvas.js';

const mockGuild = {
  name: 'Test Server',
  iconURL: () => null,
  createdTimestamp: new Date('2024-01-01').getTime(),
  joinedTimestamp: new Date('2024-01-02').getTime(),
  members: { fetch: async () => ({ user: { username: 'testuser' } }) },
  channels: { cache: { get: () => ({ name: 'general' }) } },
  client: { users: { fetch: async () => ({ username: 'unknown' }) } }
};

const mockStats = {
  overview: { d1_msg: 100, d1_vc: 3600, d1_contributors: 10, d7_msg: 700, d7_vc: 25200, d7_contributors: 25, d14_msg: 1400, d14_vc: 50400, d14_contributors: 50 },
  topMembers: { messages: { user_id: '123', total: 500 }, voice: { user_id: '456', total: 10000 } },
  topChannels: { messages: { channel_id: '1', total: 800 }, voice: { channel_id: '2', total: 5000 } },
  chart: Array(14).fill(0).map((_, i) => ({ date: `2024-01-${i+1}`, messages: Math.random() * 100, voice_seconds: Math.random() * 3600 }))
};

async function run() {
  try {
    const buffer = await generateServerOverviewImage(mockGuild, mockStats);
    fs.writeFileSync('test-overview.png', buffer);
    console.log('Successfully generated test-overview.png!');
  } catch (e) {
    console.error('Error generating image:', e);
  }
}

run();
