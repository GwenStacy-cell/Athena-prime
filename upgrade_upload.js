import fs from "fs";
let js = fs.readFileSync("src/commands/upload.js", "utf8");

js = js.replace(/if \(args\.length < 1\) \{[\s\S]*?const filename = infoArgs\.slice\(1\)\.join\(' '\) \|\| 'downloaded_file';/m, 
`    let targetUrl = null;
    let targetFilename = null;
    let contentText = '';

    if (message.reference && message.reference.messageId) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const attachment = referencedMessage.attachments.first();
        if (attachment) {
          targetUrl = attachment.url;
          targetFilename = attachment.name;
        }
      } catch (e) {}
    }

    if (!targetUrl) {
      if (args.length < 1) {
        return message.reply(cv2.e.warn('Invalid Syntax', 'Please provide a direct URL, or **reply** to a message containing a file!\n\n**Usage:**\n\`!upload <url> [optional_filename.exe]\`\n\`!upload [new_filename.exe]\` (While replying to a file)'));
      }
      
      const fullArgs = args.join(' ');
      let [fileInfo, ...contentParts] = fullArgs.split('|');
      contentText = contentParts.join('|').trim();

      const infoArgs = fileInfo.trim().split(' ');
      targetUrl = infoArgs[0];
      targetFilename = infoArgs.slice(1).join(' ') || 'downloaded_file';
    } else {
      const fullArgs = args.join(' ');
      let [fileInfo, ...contentParts] = fullArgs.split('|');
      contentText = contentParts.join('|').trim();
      
      if (fileInfo.trim()) {
        targetFilename = fileInfo.trim();
      }
    }`);

js = js.replace(/const attachment = new AttachmentBuilder\(url, \{ name: filename \}\);/g, 
  "const attachment = new AttachmentBuilder(targetUrl, { name: targetFilename });");

js = js.replace(/Fetching \`\$\{filename\}\`/g, "Fetching \\`\\${targetFilename}\\`");
js = js.replace(/uploaded \*\*\$\{filename\}\*\*/g, "uploaded **\\${targetFilename}**");

fs.writeFileSync("src/commands/upload.js", js);
