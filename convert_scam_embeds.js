import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(/const scamEmbed = new EmbedBuilder\(\)\s*\.setColor\('.*?'\)\s*\.setTitle\('LOG: MALICIOUS SCAM TEXT DELETED'\)\s*\.setDescription\(`(.*?)\`\)\s*\.addFields\(\[\{ name: 'Channel', value: `<\#\$\{message\.channel\.id\}>` \}\]\)\s*\.setFooter\(\{ text: 'Athena Prime Killer' \}\)/gs, 
"const scamEmbed = cv2.danger('LOG: MALICIOUS SCAM TEXT DELETED', `$1\\n\\n**Channel:** <#${message.channel.id}>`);");

text = text.replace(/const scamImgEmbed = new EmbedBuilder\(\)\s*\.setColor\('.*?'\)\s*\.setTitle\('LOG: MALICIOUS SCAM IMAGE DELETED'\)\s*\.setDescription\(`(.*?)\`\)\s*\.addFields\(\[\{ name: 'Channel', value: `<\#\$\{message\.channel\.id\}>` \}\]\)\s*\.setFooter\(\{ text: 'Athena Prime Killer' \}\)/gs, 
"const scamImgEmbed = cv2.danger('LOG: MALICIOUS SCAM IMAGE DELETED', `$1\\n\\n**Channel:** <#${message.channel.id}>`);");

fs.writeFileSync("src/events/messageCreate.js", text);
