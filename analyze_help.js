import commandMap from "./src/commands/loader.js";
import fs from "fs";

// 1. Get current help menu
const currentJs = fs.readFileSync("src/commands/utility.js", "utf8");

// 2. Get old help menu
// Wait, we saved old_help_modules.js earlier, but let's just parse it directly from git to be safe
import { execSync } from "child_process";
const oldJs = execSync("git show 206daadc93f1a879e3e6ef40de7dbd27c602720f:src/commands/utility.js").toString();

// Extract commands arrays from current
const currentCmdsList = [];
const currentRegex = /commands:\s*\[([\s\S]*?)\]\s*\}/g;
let match;
while ((match = currentRegex.exec(currentJs)) !== null) {
    try {
        const arr = JSON.parse(`[${match[1]}]`);
        currentCmdsList.push(...arr);
    } catch (e) {
        // If it fails to parse, just use string matching
        currentCmdsList.push(match[1]);
    }
}
const currentHelpText = currentCmdsList.join(" ").toLowerCase();

// Extract commands arrays from old
const oldCmdsList = [];
while ((match = currentRegex.exec(oldJs)) !== null) {
    try {
        const arr = JSON.parse(`[${match[1]}]`);
        oldCmdsList.push(...arr);
    } catch (e) {
        oldCmdsList.push(match[1]);
    }
}
const oldHelpText = oldCmdsList.join(" ").toLowerCase();

// A. Check if any OLD help text is missing from CURRENT help text
// We'll check by command names mentioned in old
console.log("=== CHECKING OLD HELP VS CURRENT HELP ===");
const oldMentionedCmds = new Set();
const oldMatches = oldHelpText.match(/[`!/]([a-z0-9_-]+)/g) || [];
oldMatches.forEach(m => oldMentionedCmds.add(m.replace(/[`!/]/g, '')));

const missingFromOld = [];
for (const cmd of oldMentionedCmds) {
    if (cmd === 'extra' || cmd === 'owners' || cmd === 'public' || cmd === 'np' || cmd === 'manager' || cmd.length < 2) continue;
    if (!currentHelpText.includes(`!${cmd}`) && !currentHelpText.includes(`/${cmd}`) && !currentHelpText.includes(`\`${cmd}\``) && !currentHelpText.includes(cmd)) {
        missingFromOld.push(cmd);
    }
}
if (missingFromOld.length > 0) {
    console.log(`Missing commands that WERE in old help: ${missingFromOld.join(", ")}`);
} else {
    console.log("All commands from old help are present in current help!");
}

// B. Check if any BOT commands are missing from CURRENT help text
console.log("\n=== CHECKING BOT REGISTRY VS CURRENT HELP ===");
let allCmds = Array.from(commandMap.default ? commandMap.default.values() : commandMap.values());
const uniqueCmds = [];
const seen = new Set();
for (const cmd of allCmds) {
    if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        uniqueCmds.push(cmd);
    }
}

const missingFromBot = [];
for (const cmd of uniqueCmds) {
    const name = cmd.name.toLowerCase();
    // Broad check
    if (!currentHelpText.includes(name)) {
        missingFromBot.push(name);
    }
}

if (missingFromBot.length > 0) {
    console.log(`Missing commands from bot registry:`);
    missingFromBot.forEach(name => console.log(`- ${name}`));
} else {
    console.log("All commands from bot registry are present in current help!");
}
