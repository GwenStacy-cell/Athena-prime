import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = "      const container = new ContainerBuilder();\n" +
"      components.forEach(c => container.addTextDisplayComponents(c));\n" +
"      await updateMessageFn({ components: [container], embeds: [] });";

const newCode = "      const containerJson = {\n" +
"        type: 17,\n" +
"        components: components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c)\n" +
"      };\n" +
"      await updateMessageFn({ components: [containerJson], embeds: [] });";

code = code.replace(oldCode, newCode);
fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed sequence footer payload format!");
