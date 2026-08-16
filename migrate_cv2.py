import re, os, glob

files = glob.glob("src/commands/*.js") + [
    "src/events/interactionCreate.js",
    "src/utils/antinuke.js",
    "src/utils/helpers.js",
]

changed = []
skipped = []

for fpath in files:
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
    except:
        continue

    original = content

    has_embed = any(x in content for x in [
        "embed.success(","embed.warn(","embed.danger(","embed.error(",
        "embed.info(","embed.log(","embed.raid(","embed.owner(","embed.security("
    ])
    if not has_embed:
        skipped.append(fpath)
        continue

    # Determine relative path depth for import
    depth = fpath.count("/") + fpath.count("\\")
    if "events" in fpath or "commands" in fpath or "utils" in fpath:
        cv2_import = "import cv2 from '../cv2.js';"
        embed_import_prefix = "../"
    else:
        cv2_import = "import cv2 from './src/cv2.js';"
        embed_import_prefix = ""

    # Add cv2 import if not already there
    if "cv2" not in content:
        if "setGuildContext" in content:
            content = re.sub(
                r"import embed,\s*\{\s*setGuildContext\s*\}\s*from\s*'[^']*embed\.js';",
                f"{cv2_import}\nimport {{ setGuildContext }} from '{embed_import_prefix}embed.js';",
                content
            )
        content = re.sub(
            r"import embed from\s*'[^']*embed\.js';",
            cv2_import,
            content
        )
        content = re.sub(
            r"import embed,\s*\{([^}]+)\}\s*from\s*'([^']*embed\.js)';",
            lambda m: f"{cv2_import}\nimport {{ {m.group(1).strip()} }} from '{m.group(2)}';",
            content
        )

    # Replace embed.X( with cv2.X(
    for method in ["success","warn","danger","error","info","raid","owner","security"]:
        content = content.replace(f"embed.{method}(", f"cv2.{method}(")
    content = content.replace("embed.log(", "cv2.log(")
    content = content.replace("embed.build(", "cv2.buildContainer(")

    # Unwrap: { embeds: [cv2.X(...)] } -> cv2.X(...)
    # Simple single-line
    content = re.sub(
        r'\{\s*embeds:\s*\[\s*(cv2\.\w+\([^[\]]*\))\s*\]\s*\}',
        r'\1',
        content
    )

    if content != original:
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        changed.append(fpath)
    else:
        skipped.append(fpath)

print("CHANGED:", len(changed))
for f in changed:
    print(" +", f)
print("SKIPPED:", len(skipped))
for f in skipped:
    print(" -", f)
