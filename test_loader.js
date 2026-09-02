import { commandMap, allCommands } from "./src/commands/loader.js";
console.log("Total commands loaded:", allCommands.length);
console.log("Is Auth in Map?", commandMap.has("auth"));
