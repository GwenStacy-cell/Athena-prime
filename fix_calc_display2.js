import fs from "fs";
let lines = fs.readFileSync("src/commands/utility.js", "utf8").split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("cv2.info('Athena Prime Calculator', '```\\n0\\n```')")) {
    lines[i] = "  const embed = cv2.info('Athena Prime Calculator', '0');";
  }
  if (lines[i].includes("cv2.info('Athena Prime Calculator', `\\`\\`\\`\\n${eq}\\n\\`\\`\\``)")) {
    lines[i] = "  const embed = cv2.info('Athena Prime Calculator', String(eq));";
  }
}
fs.writeFileSync("src/commands/utility.js", lines.join("\n"));
