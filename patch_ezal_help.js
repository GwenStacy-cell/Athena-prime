import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");

js = js.replace(
  /\`ezal restoresetup <serverId>\` - Dynamically restore JTC, Welcome, Leave, Accent, and Quarantine setups'/,
  "`ezal restoresetup <serverId>` - Dynamically restore JTC, Welcome, Leave, Accent, and Quarantine setups\\n' +\n          '`ezal security enable all` - Forcibly enable and initialize security on all servers\\n' +\n          '`ezal security disable all` - Forcibly disable security and strip dashboard on all servers'"
);

fs.writeFileSync("src/commands/ezal.js", js);
