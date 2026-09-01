import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

code = code.replaceAll(
    "if (!url) {\n        return message.reply(cv2.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`));\n      }",
    "if (!url) {\n        return message.reply(cv2.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`));\n      }\n      if (!url.startsWith('http://') && !url.startsWith('https://')) {\n        return message.reply(cv2.warn('Invalid URL', `${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.`));\n      }"
);

code = code.replaceAll(
    "if (!url) {\n        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));\n      }",
    "if (!url) {\n        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));\n      }\n      if (!url.startsWith('http://') && !url.startsWith('https://')) {\n        return interaction.reply(cv2.warn('Invalid URL', 'That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.'));\n      }"
);

fs.writeFileSync("src/commands/security.js", code);
