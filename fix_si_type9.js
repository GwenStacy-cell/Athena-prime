import fs from "fs";
let si = fs.readFileSync("src/commands/si.js", "utf8");

const replacement = `const buildContainer = (title, text, thumb, footer) => {
            const comps = [];
            if (title) {
                comps.push({ type: 10, content: \`### **\${title}**\` });
                comps.push({ type: 14, divider: true });
            }
            
            if (thumb) {
                comps.push({ 
                    type: 9, 
                    components: [{ type: 10, content: text }],
                    accessory: { type: 11, media: { url: thumb } }
                });
            } else {
                const blockquoted = text.split('\\n').map(l => '> ' + l).join('\\n');
                comps.push({ type: 10, content: blockquoted });
            }

            if (footer) {
                comps.push({ type: 14, divider: true });
                comps.push({ type: 10, content: \`-# \${footer}\` });
            }
            return { type: 17, components: comps };
        };`;

si = si.replace(/const buildContainer = \([\s\S]*?return \{ type: 17, components: comps \};\n        \};/, replacement);

fs.writeFileSync("src/commands/si.js", si);
