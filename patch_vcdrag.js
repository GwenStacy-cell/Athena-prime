import fs from "fs";
let js = fs.readFileSync("src/commands/vcdrag.js", "utf8");

const oldCode = `const resEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('<a:Dark4luvontop:1524405545690202253> Drag Resumed')
            .setDescription(\`**\${freshMember.user.tag}** has rejoined voice. The endless drag session has instantly resumed!\`);
          currentVc.send({ content: \`\${freshMember}\`, embeds: [resEmbed] }).catch(() => null);`;

const newCode = `const cv2Payload = cv2.warn('<a:AnyaYay:1537513785718476850> Drag Resumed', \`\${freshMember}\\n**\${freshMember.user.tag}** has rejoined voice. The endless drag session has instantly resumed!\`);
          currentVc.send(cv2Payload).catch(() => null);`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/commands/vcdrag.js", js);
