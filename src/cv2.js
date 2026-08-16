import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

// ==========================================
// CV2 — Component V2 Reply Builder
// Drop-in for embed.js — returns { components, flags }
// Usage: await interaction.reply(cv2.success('Title', 'Description', fields))
// Ephemeral: await interaction.reply(cv2.e.success('Title', 'Description', fields))
// With buttons: const r = cv2.success(...); r.components.push(actionRow); interaction.reply(r)
// ==========================================

function formatFields(fields) {
  if (!fields || fields.length === 0) return '';
  let text = '\n';
  let inlineBuffer = [];

  for (const f of fields) {
    if (f.inline) {
      inlineBuffer.push(`**${f.name}:** ${f.value}`);
    } else {
      if (inlineBuffer.length > 0) {
        text += '\n' + inlineBuffer.join('  **·**  ') + '\n';
        inlineBuffer = [];
      }
      text += `\n**${f.name}**\n${f.value}\n`;
    }
  }
  if (inlineBuffer.length > 0) {
    text += '\n' + inlineBuffer.join('  **·**  ') + '\n';
  }
  return text;
}

function buildContainer(title, description, fields = []) {
  let content = '';
  if (title) content += `### ${title}\n`;
  if (description) content += description;
  const fieldText = formatFields(fields);
  if (fieldText) content += fieldText;

  const textDisplay = new TextDisplayBuilder().setContent(content.trim() || '\u200b');
  return new ContainerBuilder().addTextDisplayComponents(textDisplay);
}

function make(title, description, fields = [], ephemeral = false) {
  const container = buildContainer(title, description, fields);
  const flags = ephemeral
    ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    : MessageFlags.IsComponentsV2;
  return { components: [container], flags };
}

export const cv2 = {
  success(title, description, fields = [])            { return make(title, description, fields, false); },
  warn(title, description, fields = [])               { return make(title, description, fields, false); },
  danger(title, description, fields = [])             { return make(title, description, fields, false); },
  error(title, description, fields = [])              { return make(title, description, fields, false); },
  info(title, description, fields = [])               { return make(title, description, fields, false); },
  raid(title, description, fields = [])               { return make(title, description, fields, false); },
  owner(title, description, fields = [])              { return make(title, description, fields, false); },
  security(title, description, fields = [])           { return make(title, description, fields, false); },
  log(title, description, fields = [], level = 'info'){ return make(`Log: ${title}`, description, fields, false); },

  e: {
    success(title, description, fields = [])  { return make(title, description, fields, true); },
    warn(title, description, fields = [])     { return make(title, description, fields, true); },
    danger(title, description, fields = [])   { return make(title, description, fields, true); },
    error(title, description, fields = [])    { return make(title, description, fields, true); },
    info(title, description, fields = [])     { return make(title, description, fields, true); },
    raid(title, description, fields = [])     { return make(title, description, fields, true); },
    owner(title, description, fields = [])    { return make(title, description, fields, true); },
    security(title, description, fields = []) { return make(title, description, fields, true); },
    log(title, description, fields = [])      { return make(`Log: ${title}`, description, fields, true); },
  },

  asEphemeral(payload) {
    return { ...payload, flags: (payload.flags ?? MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral };
  },

  buildContainer,
  make,
};

export default cv2;
