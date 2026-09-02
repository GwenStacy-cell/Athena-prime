import fs from "fs";
let js = fs.readFileSync("src/utils/voice.js", "utf8");

js = js.replace("'<a:emoji_114:1516523064492425318>'", "'<a:emoji_114:1533844815756787752>'");
js = js.replace("'<a:81509ripyourheartout:1516523054283493576>'", "'<a:bubu_sigh:1525429906102816788>'");

fs.writeFileSync("src/utils/voice.js", js);
