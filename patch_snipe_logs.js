import fs from "fs";

let js = fs.readFileSync("src/events/messageDelete.js", "utf8");

// Replace the broken image gallery with a clear text mention
js = js.replace(
  "if (imageUrl) {\n      payload.components[0].components.push({ type: 12, items: [{ media: { url: imageUrl } }] });\n    }",
  "if (imageUrl) {\n      innerComps.push({ type: 14, divider: true });\n      innerComps.push({ type: 10, content: `-# **Attachment:** [View Original File](${imageUrl})` });\n    }"
);

fs.writeFileSync("src/events/messageDelete.js", js);

let sec = fs.readFileSync("src/commands/security.js", "utf8");
sec = sec.replace(
  "A secure webhook channel created automatically for logging all security actions and artifacts.",
  "An Athena webhook channel created automatically for logging all security actions and artifacts."
);
fs.writeFileSync("src/commands/security.js", sec);

console.log("Patched messageDelete.js and security.js!");
