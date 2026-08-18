
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const c = new ContainerBuilder();
c.addTextDisplayComponents(new TextDisplayBuilder().setContent('part 1'));
c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
c.addTextDisplayComponents(new TextDisplayBuilder().setContent('part 2'));
console.log(JSON.stringify(c.toJSON(), null, 2));

