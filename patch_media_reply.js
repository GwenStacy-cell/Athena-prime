import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

js = js.replace(
  `await message.reply({ content: '-# **Media Link Detected!** Choose your format:', components: [row] });`,
  `await message.reply({ content: '-# **Media Link Detected!** Choose your format:', components: [row] }).catch(() => null);`
);

fs.writeFileSync("src/events/messageCreate.js", js);
