import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldCode = `  async execute(message) {`;

const newCode = `  async execute(message) {
    // --- AUTO-QUOTE CHANNEL SYSTEM ---
    if (message.guild && !message.author.bot) {
      const cfg = db.getGuildConfig(message.guild.id);
      if (cfg && cfg.quoteChannelId === message.channel.id) {
        // Intercept message immediately
        try {
          message.delete().catch(() => null);
          const loadingMsg = await message.channel.send("<a:loading:1542155051286396938> **Forging aesthetic quote...**");
          
          import('../utils/canvasQuote.js').then(async (canvasQuote) => {
            function formatDiscordTimestamp(date) {
              const d = new Date(date);
              let hours = d.getHours();
              const ampm = hours >= 12 ? 'PM' : 'AM';
              hours = hours % 12;
              hours = hours ? hours : 12;
              const minutes = d.getMinutes().toString().padStart(2, '0');
              const now = new Date();
              if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth()) {
                return \`Today at \${hours}:\${minutes} \${ampm}\`;
              }
              return \`\${d.getMonth()+1}/\${d.getDate()}/\${d.getFullYear()}\`;
            }
            
            const buffer = await canvasQuote.generateQuoteBuffer(
              message.member ? message.member.displayName : message.author.username,
              message.author.displayAvatarURL({ extension: 'png', size: 128 }),
              message.content || ' ',
              formatDiscordTimestamp(Date.now()),
              'dark',
              message.member ? message.member.displayHexColor : '#FFFFFF'
            );
            
            const { AttachmentBuilder } = await import('discord.js');
            const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });
            
            await loadingMsg.edit({ content: null, files: [attachment] });
          }).catch(() => loadingMsg.delete().catch(() => null));
        } catch (err) {}
        return; // Stop further processing
      }
    }`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/events/messageCreate.js", js);
