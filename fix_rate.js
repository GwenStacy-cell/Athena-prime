import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const injection = `
      // RATE EDIT BUTTONS
      if (interaction.customId.startsWith('rate_edit_')) {
        const action = interaction.customId.replace('rate_edit_', '');
        const ratingData = db.getEditRating(interaction.message.id);

        if (!ratingData) {
          return interaction.reply({ content: 'This rating session has expired or is invalid.', ephemeral: true }).catch(() => null);
        }

        if (action === 'delete') {
          // Only author or admin can delete
          if (interaction.user.id !== ratingData.authorId && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'You can only remove your own edits!', ephemeral: true }).catch(() => null);
          }
          db.deleteEditRating(interaction.message.id);
          await interaction.message.delete().catch(() => null);
          return interaction.reply({ content: 'Edit rating post removed.', ephemeral: true }).catch(() => null);
        }

        const stars = parseInt(action);
        if (isNaN(stars) || stars < 1 || stars > 5) return interaction.deferUpdate().catch(() => null);

        // Prevent self-rating
        if (interaction.user.id === ratingData.authorId) {
          return interaction.reply({ content: 'You cannot rate your own edit!', ephemeral: true }).catch(() => null);
        }

        // Save rating
        db.updateEditRating(interaction.message.id, interaction.user.id, interaction.user.username, stars);

        // Calculate new stats
        const updatedData = db.getEditRating(interaction.message.id);
        const votes = Object.values(updatedData.votes);
        const totalVotes = votes.length;
        const totalStars = votes.reduce((acc, v) => acc + v.stars, 0);
        const avgRating = (totalStars / totalVotes).toFixed(1);

        // Get last 5 ratings for the list
        const latestRatings = Object.entries(updatedData.votes)
          .reverse()
          .slice(0, 5)
          .map(([id, v]) => \`**\${v.name}** - \${v.stars} <:1z:1517089474369032253>\`)
          .join('\\n');

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(\`<a:1z:1517089474369032253> **Current Rating**\\n\${avgRating}/5 (\${totalVotes} votes)\\n\\n**User Ratings**\\n\${latestRatings || '_No ratings yet_'}\`);

        await interaction.update({ embeds: [embed] }).catch(() => null);
        return;
      }
`;

const searchStr = `    // 3. INTERACTIVE COMPONENT BUTTON CLICKS\n    // ==========================================\n    if (interaction.isButton() || interaction.isAnySelectMenu()) {`;
code = code.replace(/\r\n/g, '\n');
code = code.replace(searchStr, searchStr + injection);

fs.writeFileSync('src/events/interactionCreate.js', code);
