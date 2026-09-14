import fs from "fs";

// 1. Update utility.js
let js = fs.readFileSync("src/commands/utility.js", "utf8");
const oldStr = "\"`!shortcuts enable|disable` - View and manage pre-added shortcuts `[admin]`\"";
const newStr = "\"`!shortcuts` - View the list of all pre-added short cut aliases `[public]`\", \"`!shortcuts enable|disable` - Toggle shortcuts globally for your server `[admin]`\"";
js = js.replace(oldStr, newStr);
fs.writeFileSync("src/commands/utility.js", js);

// 2. Update shortcuts.js permissions
let sc = fs.readFileSync("src/commands/shortcuts.js", "utf8");
// Change global permissions to empty array so anyone can run it
sc = sc.replace("permissions: [PermissionFlagsBits.Administrator]", "permissions: []");

// But restrict 'enable' and 'disable' manually inside executePrefix
const execStart = "if (args[0] === 'enable') {";
const newExecStart = `if (args[0] === 'enable') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !['1509084068619489331'].includes(message.author.id)) {
            return message.reply(cv2.danger('Permission Denied', 'You must be an Administrator to enable shortcuts.'));
        }`;
sc = sc.replace(execStart, newExecStart);

const disableStart = "if (args[0] === 'disable') {";
const newDisableStart = `if (args[0] === 'disable') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !['1509084068619489331'].includes(message.author.id)) {
            return message.reply(cv2.danger('Permission Denied', 'You must be an Administrator to disable shortcuts.'));
        }`;
sc = sc.replace(disableStart, newDisableStart);

fs.writeFileSync("src/commands/shortcuts.js", sc);
console.log("Updated both files");
