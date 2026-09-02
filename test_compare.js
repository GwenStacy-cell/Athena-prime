async function test() {
  const url = "https://www.youtube.com/@ash_ae25";
  const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }});
  const text = await res.text();
  
  const headerMatch = text.match(/"pageHeaderViewModel"[\s\S]*?"content":"([^"]*?(?:subscribers?|subs))"/i);
  console.log("HTML Subs:", headerMatch ? headerMatch[1] : null);
  
  const vidsMatch = text.match(/"content":"([^"]*?\s+videos)"/i) || text.match(/([0-9\\.,kKmM]+)\s+videos/i);
  console.log("HTML Videos:", vidsMatch ? vidsMatch[1] : null);
  
  const apiRes = await fetch("https://mixerno.space/api/youtube-channel-counter/user/UC2BG6_zVCdmPitLR_r0IYvg");
  const data = await apiRes.json();
  console.log("Mixerno Data:", data.counts);
}
test();
