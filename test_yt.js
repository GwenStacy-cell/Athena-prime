import { scrapeSubscriberCount } from "./src/utils/ytStatsEngine.js";
async function run() {
  const count = await scrapeSubscriberCount("@MrBeast");
  console.log("Count:", count);
}
run();
