import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

// 1. Heading replace
text = text.replace(
    `# AutoMod | Granular Bypass Config\\n\\n`,
    `# AUTOMOD | PRIVILEGE ESCALATION & BYPASS MATRIX\\n\\n`
);

// 2. Footer replace
text = text.replace(
    `-# **Secure Unbypassable Security**`,
    `-# **Athena Bulletproof Security !!!**`
);

// 3. Emojis replace
text = text.replace(
    /const E_GREEN = '🟢';\s*const E_RED = '🔴';/,
    `const E_GREEN = '<:on:1514996865030946847>'; \n  const E_RED = '<:off:1514996861474177109>';`
);

// 4. Button color replace
text = text.replace(
    `.setCustomId(\`bp_back\`).setLabel('Back to Overview').setStyle(ButtonStyle.Primary)`,
    `.setCustomId(\`bp_back\`).setLabel('Back to Overview').setStyle(ButtonStyle.Secondary)`
);

fs.writeFileSync("src/commands/security.js", text);
