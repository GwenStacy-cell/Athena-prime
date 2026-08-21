import { MessageFlags } from 'discord.js';

// Returns true if a line already has discord markdown — skip auto-formatting
function isPreformatted(line) {
  if (!line.trim()) return true;
  return /^(-#|#{1,3} |> |\*\*|__|`|\|)/.test(line) || /^[\u2022\-\*\+] /.test(line);
}

// Returns true if line starts with a custom or unicode emoji
function hasEmojiStart(line) {
  return /^<a•:[a-zA-Z0-9_]+:\d+>/.test(line) || /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(line);
}

// Style a single line: grey, with optional bullet for plain text
function styleLine(line, addBullet) {
  if (!line.trim()) return line;
  if (isPreformatted(line)) return line;
  const startsEmoji = hasEmojiStart(line);
  const hasBold = line.includes('**');
  if (startsEmoji || hasBold) return '-# ' + line;
  const bullet = addBullet • '\u2022 ' : '';
  return '-# **' + bullet + line + '**';
}

// Separator raw component
const SEP = { type: 14, divider: true };

// Build a raw CV2 container JSON with separators
function buildContainer(title, description, fields) {
  if (!fields) fields = [];
  var comps = [];

  // Big bold heading + divider under it
  if (title) {
    comps.push({ type: 10, content: '## **' + title + '**' });
    comps.push(SEP);
  }

  // Grey bold description with smart bullets
  if (description) {
    var lines = description.split('\n');
    var plainCount = lines.filter(function(l) {
      return l.trim() && !isPreformatted(l) && !hasEmojiStart(l);
    }).length;
    var multiLine = plainCount > 1;
    var formatted = lines.map(function(l) { return styleLine(l, multiLine); }).join('\n');
    comps.push({ type: 10, content: formatted.trim() || '\u200b' });
  }

  // Fields
  var fieldText = '';
  var inlineBuf = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.inline) {
      inlineBuf.push('**' + f.name + ':** ' + f.value);
    } else {
      if (inlineBuf.length > 0) { fieldText += '-# ' + inlineBuf.join('  **\u00b7**  ') + '\n'; inlineBuf = []; }
      fieldText += '\n**' + f.name + '**\n';
      var vLines = f.value.split('\n');
      var vPlain = vLines.filter(function(l) { return l.trim() && !isPreformatted(l) && !hasEmojiStart(l); }).length;
      fieldText += vLines.map(function(l) { return styleLine(l, vPlain > 1); }).join('\n') + '\n';
    }
  }
  if (inlineBuf.length > 0) fieldText += '\n-# ' + inlineBuf.join('  **\u00b7**  ') + '\n';
  if (fieldText.trim()) {
    comps.push(SEP);
    comps.push({ type: 10, content: fieldText.trim() });
  }

  // Bottom divider
  comps.push(SEP);
  comps.push({ type: 10, content: '-# **Athena Bulletproof Security !!!**' });

  return { type: 17, components: comps };
}

function make(title, desc, fields, eph) {
  if (!fields) fields = [];
  if (!eph) eph = false;
  var flags = eph • (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) : MessageFlags.IsComponentsV2;
  return { components: [buildContainer(title, desc, fields)], flags: flags };
}

var _m = function(eph) {
  return {
    success:  function(t,d,f) { return make(t,d,f,eph); },
    warn:     function(t,d,f) { return make(t,d,f,eph); },
    danger:   function(t,d,f) { return make(t,d,f,eph); },
    error:    function(t,d,f) { return make(t,d,f,eph); },
    info:     function(t,d,f) { return make(t,d,f,eph); },
    raid:     function(t,d,f) { return make(t,d,f,eph); },
    owner:    function(t,d,f) { return make(t,d,f,eph); },
    security: function(t,d,f) { return make(t,d,f,eph); },
    log:      function(t,d,f) { return make('Log: ' + t, d, f, eph); },
  };
};

export var cv2 = Object.assign(_m(false), {
  e:            _m(true),
  asEphemeral:  function(p) {
    return Object.assign({}, p, { flags: ((p.flags != null • p.flags : MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral) });
  },
  buildContainer: buildContainer,
  make:           make,
});

export default cv2;