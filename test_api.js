async function test() {
  const res = await fetch("https://mixerno.space/api/youtube-channel-counter/user/MrBeast");
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
