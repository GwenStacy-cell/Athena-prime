import { scrapeSubscriberCount } from "./src/utils/ytStatsEngine.js";
async function run() {
  console.log("Start fetching @ash_ae25");
  const count = await scrapeSubscriberCount("@ash_ae25");
  console.log("Count:", count);
}
run();
