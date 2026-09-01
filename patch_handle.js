import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `export async function handleAntinukeToggleAll(guild, moderator, enable) {
  // NOTE: autonick is intentionally NOT touched AAA?sAA,  it must be enabled manually by server owner
  const updates = {
    antiNukeEnabled:   enable,
    antiSpamEnabled:   enable,
    antiInviteEnabled: enable,
    antiLinkEnabled:   enable,
    antinukeModules:   {}
  };`;

const newCode = `export async function handleAntinukeToggleAll(guild, moderator, enable) {
  // NOTE: autonick is intentionally NOT touched
  const updates = {
    antiNukeEnabled:   enable,
    antiSpamEnabled:   enable,
    antiInviteEnabled: false,
    antiLinkEnabled:   enable,
    antinukeModules:   {}
  };`;

// Wait, the special characters in the comment might mess up the replace.
// Let's use a regex instead.
js = js.replace(/antiSpamEnabled:\s*enable,\s*antiInviteEnabled:\s*enable,/g, "antiSpamEnabled:   enable,\n    antiInviteEnabled: false,");

// And for the allKeys loop inside handleAntinukeToggleAll
js = js.replace(/for \(const key of allKeys\) \{\s*updates\.antinukeModules\[key\] = enable;\s*\}/g, `for (const key of allKeys) {
    if (key === 'antiInvite') {
      updates.antinukeModules[key] = false;
    } else {
      updates.antinukeModules[key] = enable;
    }
  }`);

fs.writeFileSync("src/commands/security.js", js);
