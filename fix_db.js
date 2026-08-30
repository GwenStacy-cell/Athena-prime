import fs from "fs";
let code = fs.readFileSync("src/database.js", "utf8");

const oldSchema = `const DEFAULT_SCHEMA = {
  guilds: {},        // guildId -> config
  warnings: {},      // guildId -> { userId -> [...] }`;

const newSchema = `const DEFAULT_SCHEMA = {
  guilds: {},        // guildId -> config
  afk: {},           // userId -> { reason, timestamp }
  warnings: {},      // guildId -> { userId -> [...] }`;

code = code.replace(oldSchema, newSchema);

const oldLoad = `          this.cache.serverStats    = this.cache.serverStats    || {};
          this.cache.birthdays      = this.cache.birthdays      || {};
        } else {
          this.save();
        }
      } catch (error) {
        console.error('Error loading database:', error);
        this.cache = DEFAULT_SCHEMA;
      }`;

const newLoad = `          this.cache.serverStats    = this.cache.serverStats    || {};
          this.cache.birthdays      = this.cache.birthdays      || {};
        } else {
          this.cache.afk = this.cache.afk || {};
          this.save();
        }
      } catch (error) {
        console.error('Error loading database:', error);
        this.cache = DEFAULT_SCHEMA;
      }
      
      // Unconditional safety net
      this.cache.afk = this.cache.afk || {};`;

code = code.replace(oldLoad, newLoad);

fs.writeFileSync("src/database.js", code);
console.log("Fixed database.js AFK undefined crash!");
