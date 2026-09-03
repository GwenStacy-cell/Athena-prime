import fetch from "node-fetch";
const text = encodeURIComponent("Hello this is a test");
const voice = "Brian";
const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${text}`;

fetch(url)
  .then(res => {
     console.log("Status:", res.status);
     console.log("Type:", res.headers.get("content-type"));
  })
  .catch(console.error);
