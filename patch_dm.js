import fs from "fs";
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");

// We need to replace the entire if (!message.guild) { ... } block.
// The easiest way is using string replacement with indexOf and substring.

const startMarker = "if (!message.guild) {";
const endMarker = "const guildId = message.guild.id;";

const startIndex = mc.indexOf(startMarker);
const endIndex = mc.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const newBlock = `if (!message.guild) {
      const isBotOwner = isBotOwnerSync(message.author.id);
      const isPermitted = db.isSpamPermitted(message.author.id);

      // Strip leading ! prefix if present
      let rawContent = message.content.trim();
      if (rawContent.startsWith('!')) rawContent = rawContent.slice(1).trimStart();

      const lower = rawContent.toLowerCase();
      const parts = rawContent.split(/ +/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);
      
      const cmd = commandMap.get(cmdName);

      // Spam command - permitted users and bot owner
      if (cmdName === 'spam' && (isBotOwner || isPermitted)) {
        if (cmd) await cmd.executePrefix(message, args).catch(() => null);
        return;
      }

      // ----------------------------------------------------
      // BOT OWNER FULL DM ACCESS & AUTO-REMOTE CONTROL
      // ----------------------------------------------------
      if (isBotOwner && cmd) {
          
          // 1. Check for Auto-Remote Control (if args[0] is a Guild ID)
          if (args[0] && /^\\d{17,20}$/.test(args[0])) {
              const targetGuild = message.client.guilds.cache.get(args[0]);
              if (targetGuild) {
                  // We found a guild! Mock the message object to trick the command!
                  let targetMember = await targetGuild.members.fetch(message.author.id).catch(() => targetGuild.members.me);
                  
                  const mockMessage = new Proxy(message, {
                      get(target, prop) {
                          if (prop === 'guild') return targetGuild;
                          if (prop === 'guildId') return targetGuild.id;
                          if (prop === 'member') return targetMember;
                          return Reflect.get(target, prop);
                      }
                  });
                  
                  const newArgs = args.slice(1);
                  await message.reply(cv2.log('Remote Execution', \`Executing \\\`\${cmd.name}\\\` in **\${targetGuild.name}**...\`));
                  
                  try {
                      if (cmd.executePrefix) {
                          await cmd.executePrefix(mockMessage, newArgs);
                      }
                  } catch (e) {
                      await message.reply(cv2.danger('Remote Error', \`\\\`\${e.message}\\\`\`));
                  }
                  return;
              }
          }
          
          // 2. Standard Native Execution (e.g. record start <ID> or botvoice active all)
          try {
              if (cmd.executePrefix) {
                  await cmd.executePrefix(message, args);
              }
          } catch (e) {
              await message.reply(cv2.danger('DM Execution Error', \`\\\`\${e.message}\\\`\`));
          }
          return;
      }

      return; // Ignore all other messages in DMs
    }

    `;

mc = mc.substring(0, startIndex) + newBlock + mc.substring(endIndex);

fs.writeFileSync("src/events/messageCreate.js", mc);
