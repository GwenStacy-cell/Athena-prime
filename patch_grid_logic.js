import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const regex = /\/\/ Format: bullet emoji \*\*Label\*\*\s*rowStr \+= `> \$\{bullet\} \$\{e\} \*\*\$\{m\.shortLabel\}\*\*`;\s*\/\/ Add spacing between columns if putting 2 per line, or just newline\s*if \(i % 2 === 1 \|\| i === mods\.length - 1\) \{\s*grid \+= rowStr \+ '\\n';\s*rowStr = '';\s*\} else \{\s*rowStr \+= ' \u2800\u2800 ';\s*\/\/\s*Braille spaces for padding\s*\}/;

// Better regex:
const regex2 = /rowStr \+= `> \$\{bullet\} \$\{e\} \*\*\$\{m\.shortLabel\}\*\*`;[\s\S]*?rowStr \+= '[^']+'; \/\/ Braille spaces for padding\s*\}/;

const newLogic = `
            if (i % 2 === 0) {
                // First column starts the blockquote line
                rowStr += \`> \${bullet} \${e} **\${m.shortLabel}**\`;
            } else {
                // Second column just appends to the same line
                rowStr += \`\${bullet} \${e} **\${m.shortLabel}**\`;
            }
            
            if (i % 2 === 1 || i === mods.length - 1) {
                grid += rowStr + '\\n';
                rowStr = '';
            } else {
                // Adjust padding for alignment
                rowStr += ' \\u2800\\u2800 ';
            }
`;

if (js.match(regex2)) {
    js = js.replace(regex2, newLogic);
    fs.writeFileSync("src/commands/utility.js", js);
    console.log("Grid fixed!");
} else {
    console.log("Regex failed.");
}
