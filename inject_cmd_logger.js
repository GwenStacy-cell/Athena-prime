const fs = require('fs');
let js = fs.readFileSync('src/events/messageCreate.js', 'utf8');

const oldStr =       // Track successful command execution for NP analytics
      if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      db.cache.botAnalytics.cmds[commandName] = (db.cache.botAnalytics.cmds[commandName] || 0) + 1;
      db.save();;

const newStr =       // Track successful command execution for NP analytics
      if (!db.cache.botAnalytics) db.cache.botAnalytics = { joins: 0, leaves: 0, cmds: {} };
      db.cache.botAnalytics.cmds[commandName] = (db.cache.botAnalytics.cmds[commandName] || 0) + 1;
      db.save();

      // --- GLOBAL COMMAND LOGGING ---
      const loggedCategories = ['moderation', 'security', 'config', 'enuke', 'modmode', 'utility'];
      const isModUser = message.member && message.member.permissions.has('ModerateMembers');
      if (loggedCategories.includes(cmd.category) || isModUser) {
          import('../utils/helpers.js').then(helpers => {
              if (helpers.logToSecurityChannel) {
                  const logContent = message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content;
                  const embed = cv2.info(
                      'Command Execution Log',
                      'User <@' + message.author.id + '> (' + message.author.id + ') executed a command.',
                      [
                          { name: 'Command', value: '\\\\n' + logContent + '\n\\\', inline: false },
                          { name: 'Channel', value: '<#' + message.channel.id + '>', inline: true },
                          { name: 'Category', value: cmd.category || 'unknown', inline: true }
                      ],
                      'shield'
                  );
                  helpers.logToSecurityChannel(message.guild, embed).catch(()=>{});
              }
          }).catch(()=>{});
      };

js = js.replace(oldStr, newStr);
fs.writeFileSync('src/events/messageCreate.js', js);
console.log('Injected Global Command Logger!');
