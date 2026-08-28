import { PermissionFlagsBits } from 'discord.js';

export async function getSecureDashboardPanel(guild, db) {
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
        if (memberOrRole.permissions) { // It's a role
            return dangerousPerms.some(perm => memberOrRole.permissions.has(perm));
        } else { // It's a member
            return memberOrRole.roles.cache.filter(role => role.id !== guild.id && dangerousPerms.some(perm => role.permissions.has(perm)));
        }
    };

    const dangerousRoles = guild.roles.cache.filter(role => role.id !== guild.id && getDangerousRoles(role));
    const allBots = guild.members.cache.filter(m => m.user.bot);
    const allHumans = guild.members.cache.filter(m => !m.user.bot);

    const humansWithDangerousRoles = allHumans.filter(m => m.id !== guild.ownerId && getDangerousRoles(m).size > 0);
    const botsWithDangerousRoles = allBots.filter(m => getDangerousRoles(m).size > 0);
    const productionBots = allBots.filter(m => m.user.flags?.has('VerifiedBot') || m.user.flags?.has('VerifiedDeveloper') || m.roles.cache.some(r => r.tags?.botId === m.id)); // approximation

    const formatList = (collection) => {
        if (collection.size === 0) return '0 None';
        const list = collection.map(x => `<@${x.id ? (x.user ? '' : '&') : ''}${x.id}>`).slice(0, 10).join(' ');
        return `${collection.size} ${list}${collection.size > 10 ? '...' : ''}`;
    };

    const rolesStr = dangerousRoles.size === 0 ? '0 None' : `${dangerousRoles.size} ` + dangerousRoles.map(r => `<@&${r.id}>`).slice(0,10).join(' ');

    const config = db.getGuildConfig(guild.id);
    const twoFactorEmail = config.twoFactorEmail || 'Not Configured';

    const text = `**List Dangerous Roles :** ${rolesStr}
**List Bots :** ${formatList(allBots)}
**Humans Having Dangerous roles :** ${formatList(humansWithDangerousRoles)}
**Bots Having dangeurs roles :** ${formatList(botsWithDangerousRoles)}
**Production Level Bots :** ${formatList(productionBots)}

**2FA Notification Gmail:** \`${twoFactorEmail}\``;

    return text;
}
