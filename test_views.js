async function test() {
  const url = "https://www.youtube.com/@ash_ae25";
  const response = await fetch(url);
  const html = await response.text();
  console.log("Found 1,261,820?", html.includes("1,261,820"));
  console.log("Found 1261820?", html.includes("1261820"));
  
  // Let's check if the view count is stored somewhere like "viewCountText"
  const viewMatches = html.match(/.{0,50}1,261,820.{0,50}/g);
  console.log(viewMatches);
}
test();
