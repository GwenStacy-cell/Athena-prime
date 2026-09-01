import fs from "fs";
let code = fs.readFileSync("src/database.js", "utf8");

code = code.replace("guilds: {},        // guildId -> config", "guilds: {},        // guildId -> config\n  afk: {},           // userId -> { reason, timestamp }");
code = code.replace("this.cache.birthdays      = this.cache.birthdays      || {};", "this.cache.birthdays      = this.cache.birthdays      || {};\n          this.cache.afk = this.cache.afk || {};");
code = code.replace("this.cache = DEFAULT_SCHEMA;\n      }", "this.cache = DEFAULT_SCHEMA;\n      }\n      this.cache.afk = this.cache.afk || {};");

fs.writeFileSync("src/database.js", code);
