import fetch from "node-fetch";
const text = encodeURIComponent("Hello this is a test");
const lang = "en";
const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=${lang}&client=tw-ob`;

fetch(url)
  .then(res => {
     console.log("Status:", res.status);
     console.log("Type:", res.headers.get("content-type"));
  })
  .catch(console.error);
