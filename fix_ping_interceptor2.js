import fs from "fs";
let code = fs.readFileSync("src/events/messageCreate.js", "utf8");

const startStr = "if (message.content.toLowerCase().trim() === 'ping') {";
const endStr = "await message.reply({ embeds: [e], files: [attachment] });\n      return;\n    }";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex !== -1 && endIndex > startIndex) {
    const before = code.substring(0, startIndex);
    const after = code.substring(endIndex);
    const replacement = `if (message.content.toLowerCase().trim() === 'ping') {\n      const cmd = commandMap.get('ping');\n      if (cmd && cmd.executePrefix) {\n        await cmd.executePrefix(message, []);\n      }\n      return;\n    }`;
    code = before + replacement + after;
    fs.writeFileSync("src/events/messageCreate.js", code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find block", startIndex, endIndex);
}
