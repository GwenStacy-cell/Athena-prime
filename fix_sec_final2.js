import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8").replace(/\r\n/g, "\n");

code = code.replace(
    "if (!url) {\n        return message.reply(cv2.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`));\n      }",
    "if (!url) {\n        return message.reply(cv2.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`));\n      }\n      if (!url.startsWith('http://') && !url.startsWith('https://')) {\n        return message.reply(cv2.warn('Invalid URL', `${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.`));\n      }"
);

code = code.replace(
    "if (!url) {\n        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));\n      }",
    "if (!url) {\n        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));\n      }\n      if (!url.startsWith('http://') && !url.startsWith('https://')) {\n        return interaction.reply(cv2.warn('Invalid URL', 'That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.'));\n      }"
);

code = code.replace("console.error(err);\n        await responseMsg.edit(cv2.danger('Update Failed', `Could not update avatar: ${err.message}`));", "await responseMsg.edit(cv2.danger('Update Failed', `Could not update avatar: ${err.message}`));");
code = code.replace("console.error(err);\n        await interaction.editReply(cv2.danger('Update Failed', `Could not update avatar: ${err.message}`));", "await interaction.editReply(cv2.danger('Update Failed', `Could not update avatar: ${err.message}`));");
code = code.replace("console.error(err);\n        await responseMsg.edit(cv2.danger('Update Failed', `Could not update banner: ${err.message}`));", "await responseMsg.edit(cv2.danger('Update Failed', `Could not update banner: ${err.message}`));");
code = code.replace("console.error(err);\n        await interaction.editReply(cv2.danger('Update Failed', `Could not update banner: ${err.message}`));", "await interaction.editReply(cv2.danger('Update Failed', `Could not update banner: ${err.message}`));");

fs.writeFileSync("src/commands/security.js", code);
