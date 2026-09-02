import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

const patchCode = `
import { CommandInteraction, MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';

function patchDeferReply(cls) {
  if (!cls || !cls.prototype || !cls.prototype.deferReply) return;
  const originalDefer = cls.prototype.deferReply;
  cls.prototype.deferReply = async function(options = {}) {
    this.deferred = true; // mimic internal state
    const loadingStates = [
      "Synchronizing neural network parameters...",
      "Querying regional database shards...",
      "Allocating memory buffers for task execution...",
      "Validating security payload hashes...",
      "Compiling component view hierarchies...",
      "Establishing secure websocket handshake...",
      "Fetching remote assets..."
    ];
    const randomText = loadingStates[Math.floor(Math.random() * loadingStates.length)];
    const isEphemeral = options.ephemeral || options.flags === 64;
    const payload = { 
      content: \`<a:loading:1542155051286396938> **Athena Prime:** \\\`\${randomText}\\\`\`,
      flags: isEphemeral ? 64 : undefined,
      fetchReply: options.fetchReply
    };
    try {
      const res = await this.reply(payload);
      return res;
    } catch(e) {
      return await originalDefer.call(this, options);
    }
  };
}

patchDeferReply(CommandInteraction);
patchDeferReply(MessageComponentInteraction);
patchDeferReply(ModalSubmitInteraction);
`;

js = js.replace(/import \{ Client, GatewayIntentBits, Partials, Collection \} from 'discord\.js';/, 
  "import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';\n" + patchCode);

fs.writeFileSync("index.js", js);
