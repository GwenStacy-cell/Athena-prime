import fs from "fs";
let js = fs.readFileSync("src/commands/vcdrag.js", "utf8");

js = js.replace(
  /const resEmbed = new EmbedBuilder\(\)[\s\S]*?setTitle\('<a:Dark4luvontop:1524405545690202253> Drag Resumed'\)[\s\S]*?catch\(\(\) => null\);/g,
  `const cv2Payload = cv2.warn('<a:AnyaYay:1537513785718476850> Drag Resumed', \`\${freshMember}\\n**\${freshMember.user.tag}** has rejoined voice. The endless drag session has instantly resumed!\`);\n          currentVc.send(cv2Payload).catch(() => null);`
);

fs.writeFileSync("src/commands/vcdrag.js", js);
