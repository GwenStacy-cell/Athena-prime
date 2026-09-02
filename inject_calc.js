import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const calcCmd = `
  // --- CALCULATOR COMMAND ---
  {
    name: 'calculator',
    description: 'Launch an interactive Discord button calculator.',
    aliases: ['calc', 'math'],
    category: 'utility',
    permissions: [],
    async executePrefix(message, args) {
      await sendCalculator(message);
    },
    async executeSlash(interaction) {
      await sendCalculator(interaction);
    }
  },
`;

js = js.replace(/export const commands = \[/, "export const commands = [\n" + calcCmd);

// Add the sendCalculator function at the end
const func = `
async function sendCalculator(context) {
  const isInteraction = !!context.isCommand;
  if (isInteraction) {
    await context.deferReply();
  }

  const embed = cv2.info('Athena Prime Calculator', '\`\`\`\\n0\\n\`\`\`');

  const createRow = (btns) => {
    const row = new ActionRowBuilder();
    btns.forEach(btn => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(\`calc_\${btn.id}\`)
          .setLabel(btn.label)
          .setStyle(btn.style)
      );
    });
    return row;
  };

  const rows = [
    createRow([
      { id: 'clear', label: 'C', style: ButtonStyle.Danger },
      { id: 'lparen', label: '(', style: ButtonStyle.Primary },
      { id: 'rparen', label: ')', style: ButtonStyle.Primary },
      { id: 'div', label: '/', style: ButtonStyle.Primary },
      { id: 'del', label: 'DEL', style: ButtonStyle.Danger }
    ]),
    createRow([
      { id: '7', label: '7', style: ButtonStyle.Secondary },
      { id: '8', label: '8', style: ButtonStyle.Secondary },
      { id: '9', label: '9', style: ButtonStyle.Secondary },
      { id: 'mul', label: '*', style: ButtonStyle.Primary },
      { id: 'pow', label: '^', style: ButtonStyle.Primary }
    ]),
    createRow([
      { id: '4', label: '4', style: ButtonStyle.Secondary },
      { id: '5', label: '5', style: ButtonStyle.Secondary },
      { id: '6', label: '6', style: ButtonStyle.Secondary },
      { id: 'sub', label: '-', style: ButtonStyle.Primary },
      { id: 'mod', label: '%', style: ButtonStyle.Primary }
    ]),
    createRow([
      { id: '1', label: '1', style: ButtonStyle.Secondary },
      { id: '2', label: '2', style: ButtonStyle.Secondary },
      { id: '3', label: '3', style: ButtonStyle.Secondary },
      { id: 'add', label: '+', style: ButtonStyle.Primary },
      { id: 'empty', label: ' ', style: ButtonStyle.Secondary }
    ]),
    createRow([
      { id: 'dot', label: '.', style: ButtonStyle.Secondary },
      { id: '0', label: '0', style: ButtonStyle.Secondary },
      { id: '00', label: '00', style: ButtonStyle.Secondary },
      { id: 'equal', label: '=', style: ButtonStyle.Success },
      { id: 'close', label: 'Exit', style: ButtonStyle.Danger }
    ])
  ];

  rows[3].components[4].setDisabled(true); 

  embed.components.push(...rows);

  const payload = { ...embed };
  
  if (isInteraction) {
    await context.editReply(payload);
  } else {
    await context.reply(payload);
  }
}
`;

js = js + "\n" + func;

fs.writeFileSync("src/commands/utility.js", js);
