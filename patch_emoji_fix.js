import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldGetEmoji = `    const getEmoji = (name, fallback) => {
      const e = client.emojis.cache.find(emoji => emoji.name === name);
      return e ? \`<:\${e.name}:\${e.id}>\` : fallback;
    };`;

const newGetEmoji = `    const getEmoji = (name, fallback) => {
      const e = client.emojis.cache.find(emoji => emoji.name === name);
      return e ? \`<\${e.animated ? 'a' : ''}:\${e.name}:\${e.id}>\` : fallback;
    };`;

js = js.replace(oldGetEmoji, newGetEmoji);

const oldCategories = `      const categories = [
        { name: 'SECURITY & ACCESS CONTROL', icon: '\uD83D\uDEE1\uFE0F', catName: 'SECURITY & ACCESS CONTROL' },
        { name: 'SERVER ADMINISTRATION', icon: '\uD83D\uDEE0\uFE0F', catName: 'SERVER ADMINISTRATION' },
        { name: 'COMMUNITY & ENGAGEMENT', icon: '\uD83D\uDCAC', catName: 'COMMUNITY & ENGAGEMENT' },
        { name: 'VOICE & MEDIA', icon: '\uD83C\uDFA4', catName: 'VOICE & MEDIA' },
        { name: 'UTILITIES & INTEGRATIONS', icon: '\u2699\uFE0F', catName: 'UTILITIES & INTEGRATIONS' }
      ];`;

const newCategories = `      const categories = [
        { name: 'SECURITY & ACCESS CONTROL', icon: '', catName: 'SECURITY & ACCESS CONTROL' },
        { name: 'SERVER ADMINISTRATION', icon: '', catName: 'SERVER ADMINISTRATION' },
        { name: 'COMMUNITY & ENGAGEMENT', icon: '', catName: 'COMMUNITY & ENGAGEMENT' },
        { name: 'VOICE & MEDIA', icon: '', catName: 'VOICE & MEDIA' },
        { name: 'UTILITIES & INTEGRATIONS', icon: '', catName: 'UTILITIES & INTEGRATIONS' }
      ];`;

// Also need to remove the native emojis from the grid header formatting if I just leave icon: '' it will leave a trailing space, but it's fine.
// Wait, I will just fix the grid format directly.
js = js.replace(oldCategories, newCategories);

js = js.replace(/grid \+= `### \$\{cat\.icon\} \$\{cat\.name\}\\n`;/g, `grid += \`### \${cat.name}\\n\`;`);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Success!");
