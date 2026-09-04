import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const t = `  const categories = [`;
const r = `  const categories = [
    { id: 'qr_suite', shortLabel: 'QR Code', label: 'QR Code Suite', emoji: '<:emoji_16:1521464002046328944>', commands: ['\`!qr <text/url>\` - Generate a high-resolution QR code \`[public]\`'] },
    { id: 'server_backup', shortLabel: 'Backup', label: 'Server Backup Suite', emoji: '<:security:1523746688530124800>', commands: ['\`!backup create\` - Snapshot the server infrastructure \`[server owner]\`', '\`!backup info\` - View your saved snapshot \`[server owner]\`', '\`!backup restore <id>\` - Wipe and restore infrastructure \`[bot owner]\`'] },`;

js = js.replace(t, r);
fs.writeFileSync("src/commands/utility.js", js);
