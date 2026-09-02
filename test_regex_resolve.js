async function test() {
  const url = "https://www.youtube.com/@ash_ae25";
  const response = await fetch(url);
  const html = await response.text();
  let match = html.match(/<meta itemprop="channelId" content="(UC[^"]+)"/);
  if (!match) {
    match = html.match(/<meta property="og:url" content="https:\/\/www.youtube.com\/channel\/(UC[^"]+)"/);
  }
  console.log("Resolved ID:", match ? match[1] : null);
}
test();
