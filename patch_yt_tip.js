import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldText = "-# \\u2022 **Format Template:** Use \\`{count}\\` where you want the number to appear (e.g. \\`Subs: {count}\\`).";
const newText = "-# \\u2022 **Format Template:** Use \\`{subs}\\`, \\`{videos}\\`, and \\`{views}\\` where you want the numbers to appear (e.g. \\`Subs: {subs}\\`).\n-# \\u2022 **Pro Tip:** If you ever want to change the format of these channels after Auto-Setup creates them, you can just click the **Bind Existing VC** button, paste the ID of the channel it created, and type whatever custom format/text you want. The engine will instantly overwrite the format to your new layout!";

// Since string matching with escape chars can be annoying, let's use a regex
js = js.replace(/-# \\u2022 \*\*Format Template:\*\* Use `\{count\}` where you want the number to appear \(e\.g\. `Subs: \{count\}`\)\./g, newText);

fs.writeFileSync("src/commands/ytstats.js", js);
