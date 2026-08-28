
import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldPanel = `      const display = new TextDisplayBuilder().setContent(text);
      const container = new ContainerBuilder().addTextDisplayComponents(display);
      
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("sec_extra_owner").setLabel("ExtraOwner").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_wl_user").setLabel("Whitelist user").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_wl_role").setLabel("whitelist role").setStyle(ButtonStyle.Secondary)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("sec_2fa_gmail").setLabel("Submit Gmail (2FA)").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_rescan_dash").setLabel("Rescan").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_close_dash").setLabel("Close").setStyle(ButtonStyle.Secondary)
      );
  
      container.addActionRowComponents(row1, row2);
      return { components: [container], flags: MessageFlags.IsComponentsV2 };`;

const newPanel = `      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("sec_extra_owner").setLabel("ExtraOwner").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_wl_user").setLabel("Whitelist user").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_wl_role").setLabel("whitelist role").setStyle(ButtonStyle.Secondary)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("sec_2fa_gmail").setLabel("Submit Gmail (2FA)").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_rescan_dash").setLabel("Rescan").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("sec_close_dash").setLabel("Close").setStyle(ButtonStyle.Secondary)
      );
      
      const rawContainer = {
        type: 17,
        components: [
          { type: 10, content: text },
          { type: 14, divider: true },
          row1.toJSON(),
          row2.toJSON()
        ]
      };
      
      return { components: [rawContainer], flags: MessageFlags.IsComponentsV2 };`;

sec = sec.replace(oldPanel, newPanel);
fs.writeFileSync("src/commands/security.js", sec);
console.log("Fixed container design");

