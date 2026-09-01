import fs from "fs";
let code = fs.readFileSync("src/cv2.js", "utf8");

code = code.replace(
    "function buildContainer(title, description, fields) {",
    "function buildContainer(title, description, fields, customFooter) {"
);

code = code.replace(
    "comps.push({ type: 10, content: '-# **Athena Bulletproof Security !!!**' });",
    "comps.push({ type: 10, content: customFooter ? `-# **${customFooter}**` : '-# **Athena Bulletproof Security !!!**' });"
);

code = code.replace(
    "function make(title, desc, fields, eph) {",
    "function make(title, desc, fields, eph, customFooter) {"
);

code = code.replace(
    "return { components: [buildContainer(title, desc, fields)], flags: flags };",
    "return { components: [buildContainer(title, desc, fields, customFooter)], flags: flags };"
);

code = code.replace(/success:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "success:  function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/warn:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "warn:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/danger:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "danger:   function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/error:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "error:    function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/info:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "info:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/raid:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "raid:     function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/owner:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "owner:    function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/security:\s*function\(t,d,f\) \{ return make\(t,d,f,eph\); \},/g, "security: function(t,d,f,ft) { return make(t,d,f,eph,ft); },");
code = code.replace(/log:\s*function\(t,d,f\) \{ return make\('Log: ' \+ t, d, f, eph\); \},/g, "log:      function(t,d,f,ft) { return make('Log: ' + t, d, f, eph, ft); },");

fs.writeFileSync("src/cv2.js", code);
