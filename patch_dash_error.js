import fs from "fs";
let js = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

js = js.replace(
  "} catch (err) {\n    console.error('Failed to create dashboard channel:', err); throw err;\n  }",
  "} catch (err) {\n    if (err.code === 50013) {\n      console.log(`[Athena Dashboard] Skipped dashboard creation in ${guild.name} (Missing Permissions).`);\n    } else {\n      console.error('Failed to create dashboard channel:', err);\n    }\n  }"
);

fs.writeFileSync("src/utils/dashboardManager.js", js);
