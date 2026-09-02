import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const handlers = `
export async function handleAutonickButton(interaction) {
  const customId = interaction.customId;
  const guildId = interaction.guild.id;
  const db = (await import("../database.js")).default;
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import("discord.js");
  let cfg = db.getGuildConfig(guildId);
  if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };

  if (customId === 'autonick_toggle') {
    cfg.autonick.enabled = !cfg.autonick.enabled;
    db.updateGuildConfig(guildId, { autonick: cfg.autonick });
    return interaction.update(await buildAutonickDashboard(guildId));
  }

  if (customId === 'autonick_edit') {
    const modal = new ModalBuilder().setCustomId('autonick_modal').setTitle('Edit Autonick Layout');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('layout').setLabel('Nickname Layout (use {name})').setStyle(TextInputStyle.Short).setValue(cfg.autonick.layout || '{name}').setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (customId === 'autonick_sync') {
    await interaction.deferReply({ flags: 64 });
    let count = 0;
    try {
      const members = await interaction.guild.members.fetch();
      for (const [id, member] of members) {
        if (member.user.bot || member.id === interaction.guild.ownerId) continue;
        const newNick = cfg.autonick.layout.replace('{name}', member.user.username).substring(0, 32);
        if (member.displayName !== newNick) {
          await member.setNickname(newNick).catch(()=>{});
          count++;
        }
      }
    } catch(e) {}
    return interaction.editReply({ content: \`Successfully synced nicknames for **\${count}** members.\` });
  }

  if (customId === 'autonick_restore') {
    await interaction.deferReply({ flags: 64 });
    let count = 0;
    try {
      const members = await interaction.guild.members.fetch();
      for (const [id, member] of members) {
        if (member.user.bot || member.id === interaction.guild.ownerId) continue;
        if (member.nickname) {
          await member.setNickname(null).catch(()=>{});
          count++;
        }
      }
    } catch(e) {}
    return interaction.editReply({ content: \`Successfully restored original names for **\${count}** members.\` });
  }
}

export async function handleAutonickModal(interaction) {
  const layout = interaction.fields.getTextInputValue('layout');
  const guildId = interaction.guild.id;
  const db = (await import("../database.js")).default;
  let cfg = db.getGuildConfig(guildId);
  if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
  cfg.autonick.layout = layout;
  db.updateGuildConfig(guildId, { autonick: cfg.autonick });
  return interaction.update(await buildAutonickDashboard(guildId));
}
`;

js = js + handlers;
fs.writeFileSync("src/commands/security.js", js);
