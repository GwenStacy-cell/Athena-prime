import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    /const result = await executeUnquarantine\(message\.guild, target, message\.member\);\s*if \(result\.success\) \{\s*await message\.reply\(result\);\s*\} else \{\s*await message\.reply\(cv2\.danger\('Unquarantine Failed', result\.message\)\);\s*\}/s,
    `const result = await executeUnquarantine(message.guild, target, message.member);
        if (result.success) {
          await message.reply(result.embed);
        } else {
          await message.reply(cv2.danger('Unquarantine Failed', result.message));
        }`
);

text = text.replace(
    /const result = await executeUnquarantine\(interaction\.guild, target, interaction\.member\);\s*if \(result\.success\) \{\s*await interaction\.reply\(result\);\s*\} else \{\s*await interaction\.reply\(cv2\.danger\('Unquarantine Failed', result\.message\)\);\s*\}/s,
    `const result = await executeUnquarantine(interaction.guild, target, interaction.member);
        if (result.success) {
          await interaction.reply(result.embed);
        } else {
          await interaction.reply(cv2.danger('Unquarantine Failed', result.message));
        }`
);

fs.writeFileSync("src/commands/security.js", text);
