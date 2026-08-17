import db from './src/database.js';
import { getSecurityStatusPanel } from './src/commands/security.js';

const fakeGuild = {
  id: '1234',
  client: { user: { displayAvatarURL: () => 'https://example.com/bot.png' } }
};

getSecurityStatusPanel(fakeGuild).then((panel) => {
  console.log(JSON.stringify(panel, null, 2));
}).catch(console.error);