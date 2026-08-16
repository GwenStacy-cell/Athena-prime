import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

// Returns true if a line already has discord markdown or emoji — skip auto-formatting
function isPreformatted(line) {
  if (!line.trim()) return true;
  return /^(-#|#{1,3} |> |\*\*|__|`|\|)/.test(line) || /^[\u2022\-\*\+] /.test(line);
}

// Returns true if line starts with a custom or unicode emoji
function hasEmojiStart(line) {
  return /^<a?:[a-zA-Z0-9_]+:\d+>/.test(line) || /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(line);
}

// Style a single line: grey bold, with optional bullet for plain text
function styleLine(line, addBullet) {
  if (!line.trim()) return line;
  if (isPreformatted(line)) return line;
  const bullet = (addBullet && !hasEmojiStart(line)) ? '\u2022 ' : '';
  return '-# **' + bullet + line + '**';
}

function buildContainer(title, description, fields) {
  if (!fields) fields = [];
  let c = '';

  // Big bold heading
  if (title) c += '## **' + title + '**\n';

  // Grey bold description — multi-line plain text gets bullet points
  if (description) {
    var lines = description.split('\n');
    var plainCount = lines.filter(function(l) { return l.trim() && !isPreformatted(l) && !hasEmojiStart(l); }).length;
    var multiLine = plainCount > 1;
    c += lines.map(function(l) { return styleLine(l, multiLine); }).join('\n');
  }

  // Fields
  var inlineBuf = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.inline) {
      inlineBuf.push('-# **' + f.name + ':** ' + f.value);
    } else {
      if (inlineBuf.length > 0) { c += '\n' + inlineBuf.join('  **\u00b7**  ') + '\n'; inlineBuf = []; }
      c += '\n**' + f.name + '**\n';
      var vLines = f.value.split('\n');
      var vPlain = vLines.filter(function(l) { return l.trim() && !isPreformatted(l) && !hasEmojiStart(l); }).length;
      c += vLines.map(function(l) { return styleLine(l, vPlain > 1); }).join('\n') + '\n';
    }
  }
  if (inlineBuf.length > 0) c += '\n' + inlineBuf.join('  **\u00b7**  ') + '\n';

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
