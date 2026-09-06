import fs from "fs";
let js = fs.readFileSync("src/events/guildCreate.js", "utf8");

js = js.replace(
  /const botOwner = await client\.users\.fetch\(ownerId\)\.catch\(\(\) => null\);\s*let secondOwnerId = process\.env\.SECOND_OWNER_ID \|\| '1383136323183050974';\s*const secondOwner = await client\.users\.fetch\(secondOwnerId\)\.catch\(\(\) => null\);/g,
  `const ownerIds = [...new Set([ownerId, process.env.SECOND_OWNER_ID, '1423292960744804383', '1383136323183050974'].filter(Boolean))];\n      const owners = [];\n      for (const id of ownerIds) {\n        const u = await client.users.fetch(id).catch(() => null);\n        if (u) owners.push(u);\n      }`
);

js = js.replace(
  /if \(!botOwner && !secondOwner\) return;/g,
  `if (owners.length === 0) return;`
);

js = js.replace(
  /if \(botOwner \|\| secondOwner\) \{/g,
  `if (owners.length > 0) {`
);

js = js.replace(
  /if \(botOwner\) await botOwner\.send\(\{ embeds: \[embed\] \}\)\.catch\(\(\) => null\);\s*if \(secondOwner\) await secondOwner\.send\(\{ embeds: \[embed\] \}\)\.catch\(\(\) => null\);/g,
  `for (const owner of owners) {\n            await owner.send({ embeds: [embed] }).catch(() => null);\n          }`
);

js = js.replace(
  /if \(botOwner\) await botOwner\.send\(\{ embeds: \[embed\], components: \[row\] \}\)\.catch\(\(\) => null\);\s*if \(secondOwner\) await secondOwner\.send\(\{ embeds: \[embed\], components: \[row\] \}\)\.catch\(\(\) => null\);/g,
  `for (const owner of owners) {\n        await owner.send({ embeds: [embed], components: [row] }).catch(() => null);\n      }`
);

fs.writeFileSync("src/events/guildCreate.js", js);
