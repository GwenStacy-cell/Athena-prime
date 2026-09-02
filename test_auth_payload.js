import { buildAuthPayload } from "./src/commands/auth.js";
try {
  const p = buildAuthPayload("123");
  console.log(JSON.stringify(p, null, 2));
} catch(e) {
  console.error("Payload Error:", e);
}
