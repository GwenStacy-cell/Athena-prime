import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const startIdx = js.indexOf("-# \\u2022 **Format Template:**");
if (startIdx !== -1) {
  const endIdx = js.indexOf("`", startIdx + 80) + 1; // Find the closing backtick
  const snippetToReplace = js.substring(startIdx, endIdx);
  const newText = "-# \\u2022 **Format Template:** Use \\`{subs}\\`, \\`{videos}\\`, and \\`{views}\\` where you want the numbers to appear (e.g. \\`Subs: {subs}\\`).\\n-# \\u2022 **Pro Tip:** If you ever want to change the format of these channels after Auto-Setup creates them, you can just click the **Bind Existing VC** button, paste the ID of the channel it created, and type whatever custom format/text you want. The engine will instantly overwrite the format to your new layout!";
  
  js = js.replace(snippetToReplace, newText);
  fs.writeFileSync("src/commands/ytstats.js", js);
  console.log("Success");
} else {
  console.log("Failed to find start");
}
