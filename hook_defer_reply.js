import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const deferHook = `
    // Globally upgrade Discord's native 'thinking...' state with custom Athena Prime tech terms and animations
    const originalDefer = interaction.deferReply.bind(interaction);
    interaction.deferReply = async (options = {}) => {
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
        const res = await interaction.reply(payload);
        return res;
      } catch(e) {
        // Fallback to native defer if our custom reply fails
        return await originalDefer(options);
      }
    };

    try {`;

js = js.replace(/try \{/, deferHook);

fs.writeFileSync("src/events/interactionCreate.js", js);
