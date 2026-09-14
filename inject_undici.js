import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

const oldStr = `export async function rawBan(guildId, userId, token, reason = '[ATHENA] Anti-Nuke: Instant elimination') {
  try {
    const res = await fetch(\`https://discord.com/api/v10/guilds/\${guildId}/bans/\${userId}\`, {
      method: 'PUT',
      headers: {
        'Authorization': \`Bot \${token}\`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': encodeURIComponent(reason.slice(0, 512))
      },
      body: JSON.stringify({ delete_message_seconds: 0 })
    });`;

const newStr = `import { Agent, setGlobalDispatcher } from 'undici';

// PRE-WARM DISCORD API CONNECTIONS
// Keeps the TLS socket to discord.com open indefinitely, removing handshake latency (saves ~50ms)
const dispatcher = new Agent({
  keepAliveTimeout: 60000, // Keep socket alive for 60s
  keepAliveMaxTimeout: 600000,
  connections: 100
});
setGlobalDispatcher(dispatcher);

export async function rawBan(guildId, userId, token, reason = '[ATHENA] Anti-Nuke: Instant elimination') {
  try {
    const res = await fetch(\`https://discord.com/api/v10/guilds/\${guildId}/bans/\${userId}\`, {
      method: 'PUT',
      headers: {
        'Authorization': \`Bot \${token}\`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': encodeURIComponent(reason.slice(0, 512))
      },
      body: JSON.stringify({ delete_message_seconds: 0 }),
      dispatcher
    });`;

if (js.includes('export async function rawBan')) {
    js = js.replace(oldStr, newStr);
    fs.writeFileSync("src/utils/antinuke.js", js);
    console.log("Injected pre-warmed Undici dispatcher!");
} else {
    console.log("Not found.");
}
