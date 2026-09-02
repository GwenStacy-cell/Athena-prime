import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

const importStmt = "import guildAuditLogEntryCreateEvent from './src/events/guildAuditLogEntryCreate.js';\nimport presenceUpdateEvent from './src/events/presenceUpdate.js';";
js = js.replace("import guildAuditLogEntryCreateEvent from './src/events/guildAuditLogEntryCreate.js';", importStmt);

const arrayStmt = "    guildAuditLogEntryCreateEvent,\n    presenceUpdateEvent\n  ];";
js = js.replace("    guildAuditLogEntryCreateEvent\n  ];", arrayStmt);

fs.writeFileSync("index.js", js);
