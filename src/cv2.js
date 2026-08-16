import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

function formatFields(fields) {
  if (!fields || fields.length === 0) return '';
  let text = '\n';
  let buf = [];
  for (const f of fields) {
    if (f.inline) {
      buf.push('**' + f.name + ':** ' + f.value);
    } else {
      if (buf.length > 0) { text += '\n' + buf.join('  **x**  ') + '\n'; buf = []; }
      text += '\n**' + f.name + '**\n' + f.value + '\n';
    }
  }
  if (buf.length > 0) text += '\n' + buf.join('  **x**  ') + '\n';
  return text;
}

function buildContainer(title, description, fields) {
  if (!fields) fields = [];
  let c = '';
  if (title) c += '### ' + title + '\n';
  if (description) c += description;
  c += formatFields(fields);
  const td = new TextDisplayBuilder().setContent(c.trim() || '\u200b');
  return new ContainerBuilder().addTextDisplayComponents(td);
}

function make(title, desc, fields, eph) {
  if (!fields) fields = [];
  if (!eph) eph = false;
  const flags = eph ? (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) : MessageFlags.IsComponentsV2;
  return { components: [buildContainer(title, desc, fields)], flags };
}

const _m = function(eph) {
  return {
    success: function(t,d,f) { return make(t,d,f,eph); },
    warn:    function(t,d,f) { return make(t,d,f,eph); },
    danger:  function(t,d,f) { return make(t,d,f,eph); },
    error:   function(t,d,f) { return make(t,d,f,eph); },
    info:    function(t,d,f) { return make(t,d,f,eph); },
    raid:    function(t,d,f) { return make(t,d,f,eph); },
    owner:   function(t,d,f) { return make(t,d,f,eph); },
    security:function(t,d,f) { return make(t,d,f,eph); },
    log:     function(t,d,f) { return make('Log: '+t,d,f,eph); },
  };
};

export const cv2 = Object.assign(_m(false), {
  e: _m(true),
  asEphemeral: function(p) { return Object.assign({}, p, { flags: ((p.flags != null ? p.flags : MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral) }); },
  buildContainer: buildContainer,
  make: make,
});

export default cv2;
