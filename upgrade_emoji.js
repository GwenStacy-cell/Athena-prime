import fs from "fs";
let js = fs.readFileSync("src/events/emojiCreate.js", "utf8");

if (!js.includes("directStrike")) {
    const newCode = `import { AuditLogEvent } from 'discord.js';
import { directStrike } from '../utils/antinuke.js';

export default {
  name: 'emojiCreate',
  async execute(emoji) {
    if (!emoji.guild) return;

    directStrike(
      emoji.guild,
      AuditLogEvent.EmojiCreate,
      'Emoji Creation',
      emoji.id,
      async () => {
        await emoji.delete('Athena Anti-Nuke: Unauthorized Emoji Creation').catch(() => null);
      }
    ).catch(() => null);
  }
};`;
    fs.writeFileSync("src/events/emojiCreate.js", newCode);
    console.log("Upgraded emojiCreate.js to 0ms directStrike!");
} else {
    console.log("Already upgraded.");
}
