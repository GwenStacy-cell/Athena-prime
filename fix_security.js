import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Fix Avatar (Prefix)
const oldAvatarPrefix = `      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply(cv2.warn('Command Error', \`\${message.author} Please provide a direct image URL or attach an image.\`));
      }

      const responseMsg = await message.reply(cv2.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await message.client.rest.patch(\`/guilds/\${message.guild.id}/members/@me\`, {
          body: { avatar: dataUri }
        });
        await responseMsg.edit(cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        console.error(err);
        await responseMsg.edit(cv2.danger('Update Failed', \`Could not update avatar: \${err.message}\`));
      }`;

const newAvatarPrefix = `      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply(cv2.warn('Command Error', \`\${message.author} Please provide a direct image URL or attach an image.\`));
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return message.reply(cv2.warn('Invalid URL', \`\${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.\`));
      }

      const responseMsg = await message.reply(cv2.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await message.client.rest.patch(\`/guilds/\${message.guild.id}/members/@me\`, {
          body: { avatar: dataUri }
        });
        await responseMsg.edit(cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        await responseMsg.edit(cv2.danger('Update Failed', \`Could not update avatar: \${err.message}\`));
      }`;
code = code.replace(oldAvatarPrefix, newAvatarPrefix);


// Fix Avatar (Slash)
const oldAvatarSlash = `      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));
      }

      await interaction.reply(cv2.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await interaction.client.rest.patch(\`/guilds/\${interaction.guild.id}/members/@me\`, {
          body: { avatar: dataUri }
        });
        await interaction.editReply(cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        console.error(err);
        await interaction.editReply(cv2.danger('Update Failed', \`Could not update avatar: \${err.message}\`));
      }`;

const newAvatarSlash = `      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return interaction.reply(cv2.warn('Invalid URL', 'That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.'));
      }

      await interaction.reply(cv2.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await interaction.client.rest.patch(\`/guilds/\${interaction.guild.id}/members/@me\`, {
          body: { avatar: dataUri }
        });
        await interaction.editReply(cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        await interaction.editReply(cv2.danger('Update Failed', \`Could not update avatar: \${err.message}\`));
      }`;
code = code.replace(oldAvatarSlash, newAvatarSlash);

// Fix Banner (Prefix)
const oldBannerPrefix = `      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply(cv2.warn('Command Error', \`\${message.author} Please provide a direct image URL or attach an image.\`));
      }

      const responseMsg = await message.reply(cv2.info('Updating Banner', 'Attempting to configure guild-specific member banner...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await message.client.rest.patch(\`/guilds/\${message.guild.id}/members/@me\`, {
          body: { banner: dataUri }
        });
        await responseMsg.edit(cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        console.error(err);
        await responseMsg.edit(cv2.danger('Update Failed', \`Could not update banner: \${err.message}\`));
      }`;

const newBannerPrefix = `      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply(cv2.warn('Command Error', \`\${message.author} Please provide a direct image URL or attach an image.\`));
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return message.reply(cv2.warn('Invalid URL', \`\${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.\`));
      }

      const responseMsg = await message.reply(cv2.info('Updating Banner', 'Attempting to configure guild-specific member banner...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await message.client.rest.patch(\`/guilds/\${message.guild.id}/members/@me\`, {
          body: { banner: dataUri }
        });
        await responseMsg.edit(cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        await responseMsg.edit(cv2.danger('Update Failed', \`Could not update banner: \${err.message}\`));
      }`;
code = code.replace(oldBannerPrefix, newBannerPrefix);


// Fix Banner (Slash)
const oldBannerSlash = `      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));
      }

      await interaction.reply(cv2.info('Updating Banner', 'Attempting to configure guild-specific member banner...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await interaction.client.rest.patch(\`/guilds/\${interaction.guild.id}/members/@me\`, {
          body: { banner: dataUri }
        });
        await interaction.editReply(cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        console.error(err);
        await interaction.editReply(cv2.danger('Update Failed', \`Could not update banner: \${err.message}\`));
      }`;

const newBannerSlash = `      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply(cv2.warn('Command Error', 'Please provide a direct image URL or attach an image.'));
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return interaction.reply(cv2.warn('Invalid URL', 'That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.'));
      }

      await interaction.reply(cv2.info('Updating Banner', 'Attempting to configure guild-specific member banner...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = \`data:\${contentType};base64,\${buffer.toString('base64')}\`;
        await interaction.client.rest.patch(\`/guilds/\${interaction.guild.id}/members/@me\`, {
          body: { banner: dataUri }
        });
        await interaction.editReply(cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        await interaction.editReply(cv2.danger('Update Failed', \`Could not update banner: \${err.message}\`));
      }`;
code = code.replace(oldBannerSlash, newBannerSlash);

fs.writeFileSync("src/commands/security.js", code);
