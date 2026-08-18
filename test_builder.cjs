
const { ContainerBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextDisplayBuilder } = require('discord.js');
const c = new ContainerBuilder();
c.addTextDisplayComponents(new TextDisplayBuilder().setContent('test'));
const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('1').setLabel('test').setStyle(ButtonStyle.Secondary));
c.addActionRowComponents(r);
console.log(JSON.stringify(c.toJSON(), null, 2));

