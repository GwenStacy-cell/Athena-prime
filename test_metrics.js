import fs from "fs";
async function test() {
  const res = await fetch("https://www.youtube.com/@MrBeast");
  const text = await res.text();
  const match = text.match(/"contentMetadataViewModel":(\{.*?\})/);
  if (match) {
    fs.writeFileSync("mrbeast_metadata.json", match[1]);
    console.log("Saved.");
  }
}
test();
