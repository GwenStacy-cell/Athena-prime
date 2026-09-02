import { createCanvas, registerFont } from 'canvas';
import crypto from 'crypto';

// In-memory cache to store generated answers mapped to user IDs
// For a multi-guild environment, we key it by "guildId_userId"
const memoryCache = new Map();

// Helper to generate random string
function generateRandomString(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateMathCaptcha(guildId, userId) {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  const answer = (num1 + num2).toString();
  const question = `What is ${num1} + ${num2}?`;
  
  memoryCache.set(`${guildId}_${userId}`, { answer, expiresAt: Date.now() + 60000 * 5 }); // 5 min expiry
  return question;
}

export function generateImageCaptcha(guildId, userId) {
  const width = 300;
  const height = 100;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#1e1e2e'; // Dark background
  ctx.fillRect(0, 0, width, height);
  
  // Noise Lines
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = ['#f38ba8', '#fab387', '#a6e3a1', '#89b4fa', '#cba6f7'][Math.floor(Math.random() * 5)];
    ctx.lineWidth = Math.floor(Math.random() * 3) + 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }
  
  // Noise Dots
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Text
  const text = generateRandomString(6);
  ctx.font = 'bold 45px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    ctx.translate(40 + (i * 40), height / 2);
    // Random rotation between -15 and +15 degrees
    ctx.rotate((Math.random() - 0.5) * 0.5);
    ctx.fillStyle = '#cdd6f4';
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  
  memoryCache.set(`${guildId}_${userId}`, { answer: text.toLowerCase(), expiresAt: Date.now() + 60000 * 5 });
  
  return canvas.toBuffer('image/png');
}

export function validateAnswer(guildId, userId, providedAnswer) {
  const key = `${guildId}_${userId}`;
  const data = memoryCache.get(key);
  
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    memoryCache.delete(key);
    return false;
  }
  
  const isValid = data.answer.toLowerCase() === providedAnswer.toLowerCase().trim();
  if (isValid) memoryCache.delete(key); // clear on success
  return isValid;
}

// Memory cleaner to prevent leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryCache.entries()) {
    if (now > data.expiresAt) {
      memoryCache.delete(key);
    }
  }
}, 60000 * 10); // Check every 10 mins
