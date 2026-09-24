const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

try {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_module_select')
    .setPlaceholder('Click to view modules');

  selectMenu.addOptions([
    {
      label: 'Home Menu',
      description: 'Return to the main help menu',
      value: 'home'
    }
  ]);

  const helpModules = [
    { id: 'tracking', label: 'Engagement & Tracking' }
  ];

  for (const mod of helpModules) {
    selectMenu.addOptions([
      {
        label: mod.label,
        value: mod.id
      }
    ]);
  }

  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  console.log(row1.toJSON());
  console.log('Row 1 OK');
} catch (e) {
  console.log('ROW 1 ERROR:', e.message);
}

try {
  const btnPrev = new ButtonBuilder().setCustomId('help_prev').setEmoji('1523766004839088301').setStyle(ButtonStyle.Secondary);
  const btnNext = new ButtonBuilder().setCustomId('help_next').setEmoji('1523766065576935475').setStyle(ButtonStyle.Secondary);
  const btnRefresh = new ButtonBuilder().setCustomId('help_home').setEmoji('1523765738655973589').setStyle(ButtonStyle.Secondary);
  const btnDelete = new ButtonBuilder().setCustomId('help_delete').setEmoji('1523766340752642109').setStyle(ButtonStyle.Danger);
  
  const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);
  console.log(row2.toJSON());
  console.log('Row 2 OK');
} catch (e) {
  console.log('ROW 2 ERROR:', e.message);
}
