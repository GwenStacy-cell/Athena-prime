import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Convert all embed.xxx to cv2.xxx
text = text.replace(/embed\.info\(/g, "cv2.info(");
text = text.replace(/embed\.log\(/g, "cv2.log(");
text = text.replace(/embed\.danger\(/g, "cv2.danger(");
text = text.replace(/embed\.warn\(/g, "cv2.warn(");

// Unwrap them from the embeds array
text = text.replace(/\{ embeds: \[criticalEmbed\] \}/g, "criticalEmbed");
text = text.replace(/\{ embeds: \[dmEmbed\] \}/g, "dmEmbed");
text = text.replace(/\{ embeds: \[cv2\.danger\((.*?)\)\] \}/g, "cv2.danger($1)");
text = text.replace(/\{ embeds: \[suggestEmbed\] \}/g, "suggestEmbed");
text = text.replace(/\{ embeds: \[notFoundEmbed\] \}/g, "notFoundEmbed");
text = text.replace(/\{ embeds: \[errEmbed\] \}/g, "errEmbed");

// Ensure cv2 is imported!
if (!text.includes("import cv2")) {
    text = text.replace("import embed, { setGuildContext }", "import cv2 from '../cv2.js';\nimport embed, { setGuildContext }");
}

fs.writeFileSync("src/events/messageCreate.js", text);
