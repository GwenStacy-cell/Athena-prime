async function test() {
  const res = await fetch("https://www.youtube.com/@MrBeast");
  const text = await res.text();
  const matches = text.match(/([0-9\.,kKmM]+)\s+subscribers?/g);
  console.log(matches);
}
test();
