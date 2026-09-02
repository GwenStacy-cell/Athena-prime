let ytHandle = "@https://www.youtube.com/@ash_ae25";
if (ytHandle.includes('youtube.com/')) {
  const parts = ytHandle.split('youtube.com/');
  ytHandle = parts[1];
}
ytHandle = ytHandle.split('?')[0].replace(/[\/]/g, '').trim();
if (!ytHandle.startsWith('@') && !ytHandle.startsWith('UC')) {
  ytHandle = '@' + ytHandle;
}
console.log("Result:", ytHandle);
