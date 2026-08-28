import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Use regex to match regardless of CRLF
code = code.replace(/await send2FACode\(email, code2fa, interaction\.guild\.name\);/, "send2FACode(email, code2fa, interaction.guild.name).catch(e => console.log('SMTP Error:', e.message));");
code = code.replace(/return interaction\.editReply\(\{ content: "A verification code has been sent to \*\*" \+ email \+ "\*\*\. Click below to enter it\.", components: \[row\] \}\);/, "return interaction.editReply({ content: \"A verification code has been dispatched to **\" + email + \"** (Check your Pterodactyl console if it doesn't arrive). Click below to enter it.\", components: [row] });");

fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Fixed interactionCreate.js properly!");
