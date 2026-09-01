import fs from "fs";
let rec = fs.readFileSync("src/commands/record.js", "utf8");

rec = rec.replace(
    /\{ type: 2, custom_id: 'record_stop', label: 'Stop & Export', style: 2 \},/,
    "{ type: 2, custom_id: 'record_stop_' + targetGuild.id, label: 'Stop & Export', style: 2 },"
);
rec = rec.replace(
    /\{ type: 2, custom_id: 'record_status', label: 'Check Status', style: 2 \}/,
    "{ type: 2, custom_id: 'record_status_' + targetGuild.id, label: 'Check Status', style: 2 }"
);

fs.writeFileSync("src/commands/record.js", rec);
