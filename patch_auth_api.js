import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

// Change type 9 (Section) to type 10 (Text) for the tier lists since they lack accessories
js = js.replace("{ type: 9, components: [{ type: 10, content: `### Admin Tier Roles\\n-# **Bound Roles:** ${adminIds}` }] }", "{ type: 10, content: `### Admin Tier Roles\\n-# **Bound Roles:** ${adminIds}` }");
js = js.replace("{ type: 9, components: [{ type: 10, content: `### Mod Tier Roles\\n-# **Bound Roles:** ${modIds}` }] }", "{ type: 10, content: `### Mod Tier Roles\\n-# **Bound Roles:** ${modIds}` }");
js = js.replace("{ type: 9, components: [{ type: 10, content: `### Staff Tier Roles\\n-# **Bound Roles:** ${staffIds}` }] }", "{ type: 10, content: `### Staff Tier Roles\\n-# **Bound Roles:** ${staffIds}` }");

// Let's remove the console log while we are at it
js = js.replace("executePrefix: async (message, args) => {\\nconsole.log('AUTH COMMAND EXECUTING!');", "executePrefix: async (message, args) => {");

fs.writeFileSync("src/commands/auth.js", js);
