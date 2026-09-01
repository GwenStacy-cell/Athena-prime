import fs from "fs";
let code = fs.readFileSync("src/events/messageCreate.js", "utf8");

const regex = /if \(message\.content\.toLowerCase\(\)\.trim\(\) === 'ping'\) \{[\s\S]*?await message\.reply\(\{ embeds: \[e\], files: \[attachment\] \}\);\s*return;\s*\}/;

const replacement = `if (message.content.toLowerCase().trim() === 'ping') {\n      const cmd = commandMap.get('ping');\n      if (cmd && cmd.executePrefix) {\n        await cmd.executePrefix(message, []);\n      }\n      return;\n    }`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync("src/events/messageCreate.js", code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find regex!");
}
