import { createCanvas } from 'canvas';
import fs from 'fs';

const canvas = createCanvas(400, 100);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#181A1F';
ctx.fillRect(0, 0, 400, 100);

ctx.fillStyle = '#FFFFFF';
ctx.font = '24px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
ctx.fillText('📊 Server Overview', 20, 40);
ctx.fillText('💬 🎙️ 🍺 Hidden Leaf', 20, 80);

fs.writeFileSync('test-font.png', canvas.toBuffer());
console.log('Saved test-font.png');
