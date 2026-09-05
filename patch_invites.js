import fs from "fs";
let js = fs.readFileSync("src/commands/invites.js", "utf8");

js = js.replace(
  /await interaction\.deferReply\(\);\s*const targetChannel = interaction\.options\.getChannel\('channel'\);\s*await setupInviteTracker\(interaction\.guild, interaction\.channel, interaction\.member, interaction, targetChannel\);/g,
  `const targetChannel = interaction.options.getChannel('channel');\n      await setupInviteTracker(interaction.guild, interaction.channel, interaction.member, interaction, targetChannel);`
);

js = js.replace(
  /const reply = async \(msg\) => \{\s*if \(interaction\) await interaction\.editReply\(msg\);\s*else await replyChannel\.send\(msg\);\s*\};/g,
  `const reply = async (msg) => {\n    if (interaction) {\n      if (interaction.deferred || interaction.replied) {\n        await interaction.followUp(msg);\n      } else {\n        await interaction.reply(msg);\n      }\n    } else {\n      await replyChannel.send(msg);\n    }\n  };`
);

fs.writeFileSync("src/commands/invites.js", js);
