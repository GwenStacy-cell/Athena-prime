async function test() {
  const res = await fetch("https://www.youtube.com/@MrBeast");
  const text = await res.text();
  const vidsMatch = text.match(/"content":"([^"]*?\s+views)"/gi);
  console.log("Views:", vidsMatch);
}
test();
