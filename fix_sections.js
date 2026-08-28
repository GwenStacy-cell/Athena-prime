import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const regex = /const section1 = \{\s*type: 9,\s*components: \[\{\s*type: 10,([\s\S]*?)\]\s*\};/g;

code = code.replace(/const section1 = \{\s*type: 9,\s*components: \[\{([\s\S]*?)\}\]\s*\};/g, `const section1 = { type: 9, components: [{$1}], accessory: { type: 11, media: { url: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" } } };`);
code = code.replace(/const section2 = \{\s*type: 9,\s*components: \[\{([\s\S]*?)\}\]\s*\};/g, `const section2 = { type: 9, components: [{$1}], accessory: { type: 11, media: { url: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" } } };`);
code = code.replace(/const section3 = \{\s*type: 9,\s*components: \[\{([\s\S]*?)\}\]\s*\};/g, `const section3 = { type: 9, components: [{$1}], accessory: { type: 11, media: { url: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" } } };`);

fs.writeFileSync("src/commands/security.js", code);
console.log("Added transparent accessory to sections!");
