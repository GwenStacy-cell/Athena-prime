async function test() {
  const res = await fetch("https://www.youtube.com/@ash_ae25");
  const text = await res.text();
  const match = text.match(/.{0,200}engagement-panel-about-channel.{0,200}/g);
  console.log("Matches:", match);
}
test();
