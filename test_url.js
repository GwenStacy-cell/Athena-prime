import fs from "fs";
async function test() {
  const res = await fetch("https://www.youtube.com/@ash_ae25");
  const text = await res.text();
  const match = text.match(/"pageHeaderViewModel"(\{.*?\})/);
  if (match) {
    fs.writeFileSync("ash.json", match[1]);
    console.log("Saved ash.json");
  }
}
test();
