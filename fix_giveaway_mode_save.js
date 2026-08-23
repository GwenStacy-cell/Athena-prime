import fs from 'fs';
let code = fs.readFileSync('src/commands/giveaway.js', 'utf8');

const target1 = "const customMsg = interaction.options.getString('message');";
const replacement1 = "const customMsg = interaction.options.getString('message');\n        const mode = interaction.options.getString('mode') || 'random';";
code = code.replace(target1, replacement1);

const target2 = `          db.saveGiveaway(message.id, {
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            hostId: interaction.user.id,
            prize: prize,
            winnersCount: winners,
            endsAt: endsAt,
            participants: []
          });`;

const replacement2 = `          db.saveGiveaway(message.id, {
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            hostId: interaction.user.id,
            prize: prize,
            winnersCount: winners,
            endsAt: endsAt,
            participants: [],
            mode: mode
          });`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/commands/giveaway.js', code);
