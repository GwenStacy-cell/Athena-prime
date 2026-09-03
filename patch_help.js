import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Add !verify to security
js = js.replace(
  "`!antinuke` **config** ?\" Open the interactive configuration panel `[extra owners]`',",
  "`!antinuke` **config** ?\" Open the interactive configuration panel `[extra owners]`', '`!verify` ?\" Deploy the Interactive Verification & Captcha System `[extra owners]`',"
);

// Add !auth and !tier to whitelist
js = js.replace(
  "`!whitelist` - Open the Global Whitelist Manager Dashboard `[extra owners]`',",
  "`!whitelist` - Open the Global Whitelist Manager Dashboard `[extra owners]`', '`!auth` - Configure the Role Authorization Tiers Dashboard `[server owner]`', '`!tier` - Check your authorization clearance level `[public]`',"
);

// Add !ignore to moderation
js = js.replace(
  "`!createthread` / `!archivethread` / `!deletethread` - Thread management `[extra owners]`']",
  "`!createthread` / `!archivethread` / `!deletethread` - Thread management `[extra owners]`', '`!ignore` **channel / category** - Block commands `[admin tier]`', '`!ignoreall` / `!unignoreall` - Mass command lock `[admin tier]`']"
);

fs.writeFileSync("src/commands/utility.js", js);
