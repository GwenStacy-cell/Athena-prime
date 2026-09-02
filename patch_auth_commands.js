import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

const oldAdmin = "{ type: 10, content: `### Admin Tier Roles\\n-# **Examples:** \\`!security\\`, \\`!nuke\\`, \\`!massrole\\`, \\`!enuke\\`\\n-# **Bound Roles:** ${adminIds}` }";
const newAdmin = "{ type: 10, content: `### Admin Tier Roles\\n-# **Examples:** \\`!security\\`, \\`!massrole\\`, \\`!syncall\\`\\n-# **Bound Roles:** ${adminIds}` }";

const oldMod = "{ type: 10, content: `### Mod Tier Roles\\n-# **Examples:** \\`!ban\\`, \\`!kick\\`, \\`!timeout\\`, \\`!clear\\`\\n-# **Bound Roles:** ${modIds}` }";
const newMod = "{ type: 10, content: `### Mod Tier Roles\\n-# **Examples:** \\`!ban\\`, \\`!kick\\`, \\`!timeout\\`, \\`!purge\\`\\n-# **Bound Roles:** ${modIds}` }";

const oldStaff = "{ type: 10, content: `### Staff Tier Roles\\n-# **Examples:** \\`!warn\\`, \\`!mute\\`, \\`!lock\\`, \\`!slowmode\\`\\n-# **Bound Roles:** ${staffIds}` }";
const newStaff = "{ type: 10, content: `### Staff Tier Roles\\n-# **Examples:** \\`!warn\\`, \\`!mute\\`, \\`!deafen\\`, \\`!slowmode\\`\\n-# **Bound Roles:** ${staffIds}` }";

js = js.replace(oldAdmin, newAdmin);
js = js.replace(oldMod, newMod);
js = js.replace(oldStaff, newStaff);

fs.writeFileSync("src/commands/auth.js", js);
