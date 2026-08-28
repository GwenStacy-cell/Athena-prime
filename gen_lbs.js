import fs from 'fs';
let code = fs.readFileSync('src/utils/statCanvas.js', 'utf8');

const regex = /export async function generateInviteTopImage[\s\S]*?Data powered by Athena Prime Stats Engine", W \/ 2, H - 8\);\n  ctx\.textAlign = 'left';\n\n  return canvas\.toBuffer\('image\/png'\);\n\}/m;

const match = code.match(regex);

if (match) {
    let baseFunc = match[0];
    
    // Create Chat Leaderboard function
    let chatFunc = baseFunc.replace('generateInviteTopImage(guild, topInvites, lastSync = null)', 'generateChatTopImage(guild, topMembers)');
    chatFunc = chatFunc.replace('## INVITE LEADERBOARD', '## CHAT LEADERBOARD');
    chatFunc = chatFunc.replace('topInvites', 'topMembers').replace('topInvites', 'topMembers').replace('topInvites', 'topMembers');
    chatFunc = chatFunc.replace('const netText = `${u.net} Invites`;', 'const netText = `${u.total} Messages`;');
    chatFunc = chatFunc.replace('ctx.fillText("No invite data found.", PAD, Y_START + 25);', 'ctx.fillText("No message data found.", PAD, Y_START + 25);');
    chatFunc = chatFunc.replace('ctx.fillText(`Last synced: ${lastSync || "Never"}`, PAD, 76);', 'ctx.fillText(`Tracking last 14 days activity`, PAD, 76);');
    chatFunc = chatFunc.replace('ctx.fillText("Admins: Run !syncinvites to pull the latest offline active invites from Discord.", W / 2, H - 22);', '');
    chatFunc = chatFunc.replace('const H = HEADER_H + SECTION_TITLE_H + (Math.min(ROWS, Math.max(topMembers.length, 1)) * ROW_H) + BOTTOM_PAD + 26;', 'const H = HEADER_H + SECTION_TITLE_H + (Math.min(ROWS, Math.max(topMembers.length, 1)) * ROW_H) + BOTTOM_PAD;');
    chatFunc = chatFunc.replace('ctx.fillText("Data powered by Athena Prime Stats Engine", W / 2, H - 8);', 'ctx.fillText("Data powered by Athena Prime Stats Engine", W / 2, H - 12);');

    // Create Voice Leaderboard function
    let voiceFunc = baseFunc.replace('generateInviteTopImage(guild, topInvites, lastSync = null)', 'generateVoiceTopImage(guild, topMembers)');
    voiceFunc = voiceFunc.replace('## INVITE LEADERBOARD', '## VOICE LEADERBOARD');
    voiceFunc = voiceFunc.replace('topInvites', 'topMembers').replace('topInvites', 'topMembers').replace('topInvites', 'topMembers');
    voiceFunc = voiceFunc.replace('const netText = `${u.net} Invites`;', 'const netText = `${u.total} Hours`;');
    voiceFunc = voiceFunc.replace('ctx.fillText("No invite data found.", PAD, Y_START + 25);', 'ctx.fillText("No voice data found.", PAD, Y_START + 25);');
    voiceFunc = voiceFunc.replace('ctx.fillText(`Last synced: ${lastSync || "Never"}`, PAD, 76);', 'ctx.fillText(`Tracking last 14 days activity`, PAD, 76);');
    voiceFunc = voiceFunc.replace('ctx.fillText("Admins: Run !syncinvites to pull the latest offline active invites from Discord.", W / 2, H - 22);', '');
    voiceFunc = voiceFunc.replace('const H = HEADER_H + SECTION_TITLE_H + (Math.min(ROWS, Math.max(topMembers.length, 1)) * ROW_H) + BOTTOM_PAD + 26;', 'const H = HEADER_H + SECTION_TITLE_H + (Math.min(ROWS, Math.max(topMembers.length, 1)) * ROW_H) + BOTTOM_PAD;');
    voiceFunc = voiceFunc.replace('ctx.fillText("Data powered by Athena Prime Stats Engine", W / 2, H - 8);', 'ctx.fillText("Data powered by Athena Prime Stats Engine", W / 2, H - 12);');

    code += "\n\n" + chatFunc + "\n\n" + voiceFunc + "\n";
    fs.writeFileSync('src/utils/statCanvas.js', code);
    console.log("Injected generateChatTopImage and generateVoiceTopImage");
} else {
    console.log("Could not find generateInviteTopImage");
}
