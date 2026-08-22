import db from "../database.js";
import cv2 from "../cv2.js";
import { isBotOwnerSync } from "../utils/permissions.js";

function isAuthorized(user, guild) {
  if (!user || !guild) return false;
  if (isBotOwnerSync(user.id)) return true;
  if (guild.ownerId === user.id) return true;
  if (db.isExtraOwner(guild.id, user.id)) return true;
  return false;
}

export default [
  {
    name: "adel",
    description: "Auto-delete all messages from a user in this channel.",
    category: "moderation",
    prefixOnly: true,
    async executePrefix(message) {
      if (!isAuthorized(message.author, message.guild))
        return message.reply(cv2.error("UNAUTHORIZED", "Only bot owner, server owner, or extra owners can use this command."));
      const target = message.mentions.users.first();
      if (!target)
        return message.reply(cv2.error("NO USER", "Please mention a user to auto-delete."));
      db.addAdel(message.guild.id, message.channel.id, target.id);
      return message.reply(cv2.success("Adel", `Now auto-deleting messages from **${target.username}** in this channel.`));
    }
  },
  {
    name: "radel",
    description: "Stop auto-deleting messages from a user in this channel.",
    category: "moderation",
    prefixOnly: true,
    async executePrefix(message) {
      if (!isAuthorized(message.author, message.guild))
        return message.reply(cv2.error("UNAUTHORIZED", "Only bot owner, server owner, or extra owners can use this command."));
      const target = message.mentions.users.first();
      if (!target)
        return message.reply(cv2.error("NO USER", "Please mention a user."));
      db.removeAdel(message.guild.id, message.channel.id, target.id);
      return message.reply(cv2.success("Radel", `Stopped auto-deleting messages from **${target.username}** in this channel.`));
    }
  }
];
