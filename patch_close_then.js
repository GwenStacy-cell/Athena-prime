import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const broken = `        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput), new ActionRowBuilder().addComponents(timeoutInput));
        return interaction.showModal(modal);
      }
      else if (customId === 'am_select_granular_role') {`;

const fixed = `        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput), new ActionRowBuilder().addComponents(timeoutInput));
        return interaction.showModal(modal).catch(console.error);
        });
      }
      else if (customId === 'am_select_granular_role') {`;

js = js.replace(broken, fixed);
fs.writeFileSync("src/events/interactionCreate.js", js);
