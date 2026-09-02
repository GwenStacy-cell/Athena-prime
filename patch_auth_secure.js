import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

const oldEx = "executePrefix: async (message, args) => {";
const newEx = `executePrefix: async (message, args) => {
      const { isServerAdmin } = await import('../utils/helpers.js');
      if (!isServerAdmin(message.member, message.guild.id)) {
        return message.reply(cv2.danger('Access Denied', 'Only Server Admins and Owners can manage Authorization Tiers.')).catch(()=>null);
      }`;

js = js.replace(oldEx, newEx);

fs.writeFileSync("src/commands/auth.js", js);
