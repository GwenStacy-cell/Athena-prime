import fs from "fs";
let js = fs.readFileSync("src/commands/ccmd.js", "utf8");

const oldStr1 = "`# <:customcmds:1523743516088209489> Ccmd\\n\\n> -# **Granted custom command access to <@${target.id}> .**`";
const newStr1 = "`# ${customcmdsEmoji} Ccmd\\n\\n> -# **Granted custom command access to <@${target.id}> .**`";
js = js.replace(oldStr1, newStr1);

const oldStr2 = "`# <:customcmds:1523743516088209489> Custom Commands | Granted Access List\\n\\n`";
const newStr2 = "`# ${customcmdsEmoji} Custom Commands | Granted Access List\\n\\n`";
js = js.replace(oldStr2, newStr2);

const oldStr3 = "`# <:customcmds:1523743516088209489> Custom Commands | Server Shortcuts\\n\\n`";
const newStr3 = "`# ${customcmdsEmoji} Custom Commands | Server Shortcuts\\n\\n`";
js = js.replace(oldStr3, newStr3);

// Inject the customcmdsEmoji definition at the start of executePrefix
const executePrefixStart = "async executePrefix(message, args) {";
const inject = `async executePrefix(message, args) {
    const e = message.client.emojis.cache.find(emoji => emoji.name === 'customcmds');
    const customcmdsEmoji = e ? \`<\${e.animated ? 'a' : ''}:\${e.name}:\${e.id}>\` : '<:config:1533844853048209489>';
`;
js = js.replace(executePrefixStart, inject);

fs.writeFileSync("src/commands/ccmd.js", js);
console.log("Replaced ccmd.js");
