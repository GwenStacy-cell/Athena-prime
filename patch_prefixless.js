import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Fix prefix-less QR
const qrBlock = `if (msgCheck === 'qr' || msgCheck.startsWith('qr ')) {`;
const newQrBlock = `if (msgCheck === 'qr' || msgCheck.startsWith('qr ')) {
        if (dbConfig.shortcutsEnabled === false) return; // Block prefix-less shortcut`;
js = js.replace(qrBlock, newQrBlock);

// Fix prefix-less SS
const ssBlock = `if (msgCheck === 'ss' || msgCheck === 'security status') {`;
const newSsBlock = `if (msgCheck === 'ss' || msgCheck === 'security status') {
        if (msgCheck === 'ss' && dbConfig.shortcutsEnabled === false) return; // Block prefix-less shortcut`;
js = js.replace(ssBlock, newSsBlock);

fs.writeFileSync("src/events/messageCreate.js", js);
console.log("Patched prefix-less shortcuts!");
