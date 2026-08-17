import { SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from 'discord.js';
const s = new SectionBuilder()
  .addTextDisplayComponents(new TextDisplayBuilder().setContent('Test'))
  .setThumbnailAccessory(new ThumbnailBuilder().setURL('https://example.com/image.png'));
console.log(JSON.stringify(s.toJSON(), null, 2));