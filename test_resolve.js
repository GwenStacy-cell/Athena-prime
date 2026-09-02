import { resolveYouTubeChannelId } from "./src/utils/youtubeNotifier.js";

async function test() {
  const channelId = await resolveYouTubeChannelId("https://www.youtube.com/@ash_ae25");
  console.log("Resolved Channel ID:", channelId);
}
test();
