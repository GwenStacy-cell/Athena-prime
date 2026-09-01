import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /const mp3Path = await stopRecording\(interaction\.guild\.id\);\s*if \(\!mp3Path\) \{/,
    `const result = await stopRecording(interaction.guild.id);
            if (!result) {`
);

intC = intC.replace(
    /await interaction\.followUp\(\{ files: \[mp3Path\] \}\);\s*const fs = await import\('fs'\);\s*fs\.unlink\(mp3Path, \(\) => \{\}\);/,
    `await interaction.followUp({ files: [result.mp3Path] });
            const fs = await import('fs');
            fs.unlink(result.mp3Path, () => {});`
);

fs.writeFileSync("src/events/interactionCreate.js", intC);
