import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const brokenDM = `      // Async DM task so it doesn't block interaction timeout
      interaction.guild.members.fetch(targetId).then(target => {
        if (target) {
          target.send(cv2[action === 'accept' ? 'success' : 'danger'](\`Application \${action === 'accept' ? 'Accepted' : 'Denied'}\`, \`**Server:** \${interaction.guild.name}\\n**Reason:** \${reason}\`)).catch(() => null);
        }
      }).catch(()=>{});`;

const fixedDM = `      // Async DM task so it doesn't block interaction timeout
      interaction.guild.members.fetch(targetId).then(target => {
        if (target) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(\`Application \${action === 'accept' ? 'Accepted' : 'Denied'}\`)
            .setDescription(\`**Server:** \${interaction.guild.name}\\n\\n**Reason:** \${reason}\`)
            .setColor(action === 'accept' ? '#43b581' : '#f04747');
          target.send({ embeds: [dmEmbed] }).catch(err => console.error('Failed to DM applicant:', err));
        }
      }).catch(err => console.error('Failed to fetch applicant for DM:', err));`;

js = js.replace(brokenDM, fixedDM);
fs.writeFileSync("src/events/interactionCreate.js", js);
