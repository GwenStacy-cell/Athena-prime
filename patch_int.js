import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /if \(interaction\.customId === 'record_stop'\) \{/,
    `if (interaction.customId.startsWith('record_stop')) {
          const targetGuildId = interaction.customId.split('_')[2] || interaction.guild?.id;
          if (!targetGuildId) return interaction.reply({ content: 'Cannot determine target server.', ephemeral: true });`
);

intC = intC.replace(
    /const result = await stopRecording\(interaction\.guild\.id\);/,
    "const result = await stopRecording(targetGuildId);"
);

intC = intC.replace(
    /if \(interaction\.customId === 'record_status'\) \{/,
    `if (interaction.customId.startsWith('record_status')) {
          const targetGuildId = interaction.customId.split('_')[2] || interaction.guild?.id;
          if (!targetGuildId) return interaction.reply({ content: 'Cannot determine target server.', ephemeral: true });`
);

// We need to also patch the guild ID in record_status
intC = intC.replace(
    /const \{ getRecordingStatus \} = await import\('\.\.\/utils\/audioRecorder\.js'\);\s*const status = getRecordingStatus\(interaction\.guild\.id\);/,
    `const { getRecordingStatus } = await import('../utils/audioRecorder.js');
          const status = getRecordingStatus(targetGuildId);`
);

fs.writeFileSync("src/events/interactionCreate.js", intC);
