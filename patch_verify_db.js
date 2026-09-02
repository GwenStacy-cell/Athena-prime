import fs from "fs";
let js = fs.readFileSync("src/commands/verify.js", "utf8");

js = js.replace(/channelId: interaction\.channel\.id\s*\}\);/, "channelId: interaction.channel.id,\n          mode\n        });");

// Now check panel content
js = js.replace(/description: `-# \*\*Click the button below to verify your account and gain access to the server\.\*\*`/g, "description: `-# **Click the button below to verify your account and gain access to the server.**\\n-# **Mode:** ` + (mode === 'button' ? 'Instant' : mode === 'math' ? 'Math Challenge' : 'Image Captcha') + `\\n`");

fs.writeFileSync("src/commands/verify.js", js);
