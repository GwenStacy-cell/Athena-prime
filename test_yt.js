async function test() {
  const res = await fetch("https://www.youtube.com/@MrBeast");
  const text = await res.text();
  const match = text.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+?)"\}\},"simpleText":"([^"]+?)"\}/);
  if (match) {
    let raw = match[2];
    raw = raw.replace(/ subscribers?/i, '').trim();
    console.log("Subscribers:", raw);
  }
}
test();
