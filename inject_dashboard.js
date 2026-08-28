
import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const getPanelFunc = `
export async function getSecureDashboardPanel(guild) {
    const db = (await import("../database.js")).default;
    await guild.members.fetch();
    await guild.roles.fetch();

    const dangerousPerms = [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers
    ];

    const getDangerousRoles = (memberOrRole) => {
        if (memberOrRole.permissions) {
            return dangerousPerms.some(perm => memberOrRole.permissions.has(perm));
        } else {
            return memberOrRole.roles.cache.filter(role => role.id !== guild.id && dangerousPerms.some(perm => role.permissions.has(perm)));
        }
    };

    const dangerousRoles = guild.roles.cache.filter(role => role.id !== guild.id && getDangerousRoles(role));
    const allBots = guild.members.cache.filter(m => m.user.bot);
    const allHumans = guild.members.cache.filter(m => !m.user.bot);

    const humansWithDangerousRoles = allHumans.filter(m => m.id !== guild.ownerId && getDangerousRoles(m).size > 0);
    const botsWithDangerousRoles = allBots.filter(m => getDangerousRoles(m).size > 0);
    const productionBots = allBots.filter(m => m.user.flags?.has("VerifiedBot") || m.user.bot);

    const formatList = (collection) => {
        if (collection.size === 0) return "0 None";
        const list = collection.map(x => "<@" + (x.user ? "" : "&") + x.id + ">").slice(0, 10).join(" ");
        return collection.size + " " + list + (collection.size > 10 ? "..." : "");
    };

    const rolesStr = dangerousRoles.size === 0 ? "0 None" : dangerousRoles.size + " " + dangerousRoles.map(r => "<@&" + r.id + ">").slice(0,10).join(" ");

    const config = db.getGuildConfig(guild.id);
    const twoFactorEmail = config.twoFactorEmail || "Not Configured";

    const text = "**List Dangerous Roles:** " + rolesStr + "\\n" +
                 "**List Bots:** " + formatList(allBots) + "\\n" +
                 "**Humans Having Dangerous roles:** " + formatList(humansWithDangerousRoles) + "\\n" +
                 "**Bots Having dangeurs roles:** " + formatList(botsWithDangerousRoles) + "\\n" +
                 "**Production Level Bots:** " + formatList(productionBots) + "\\n\\n" +
                 "**2FA Notification Gmail:** \`" + twoFactorEmail + "\`";

    const display = new TextDisplayBuilder().setContent(text);
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
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
`;

code = code.replace("export async function handleScanServer", getPanelFunc + "\nexport async function handleScanServer");
fs.writeFileSync("src/commands/security.js", code);
console.log("Injected getSecureDashboardPanel");

