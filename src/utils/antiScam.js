import fetch from 'node-fetch';
import { createWorker } from 'tesseract.js';
import { createCanvas, loadImage } from 'canvas';

// Initialize a persistent worker to make OCR scanning as fast as possible
let workerPromise = null;

async function initWorker() {
  try {
    return await createWorker('eng');
  } catch (error) {
    console.error('Failed to initialize Tesseract worker:', error);
    return null;
  }
}
workerPromise = initWorker();

const scamKeywords = [
  'kasowin',
  'helawin',
  'vyro project',
  'vyro',
  'promo code: bet',
  'crypto casino',
  'withdrawal success',
  'mrbeast',
  'mr beast',
  'mr. beast',
  'mr.beast'
];

// Deduplication cache to prevent messageCreate and messageUpdate from double-logging
export const flaggedMessages = new Set();

/**
 * Scans a text string for scam content.
 * @param {string} text - The text to scan.
 * @returns {boolean} - Returns true if scam text is detected.
 */
export function scanTextForScam(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase().replace(/\s+/g, ' ');
  
  let threatScore = 0;
  for (const keyword of scamKeywords) {
    if (lowerText.includes(keyword)) {
      threatScore += 1;
    }
  }
  
  if (lowerText.includes('kasowin') || lowerText.includes('helawin') || threatScore >= 2) {
    return true;
  }
  
  return false;
}

/**
 * Scans an image URL for scam text.
 * @param {string} url - The URL of the image.
 * @returns {Promise<boolean>} - Returns true if scam text is detected.
 */
export async function scanImageForScam(url) {
  const worker = await workerPromise;
  if (!worker) return false;
  
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DiscordBot (https://discord.com, 1.0.0)' }
    });
    if (!res.ok) return false;
    
    const buffer = await res.arrayBuffer().then(buf => Buffer.from(buf));
    
    // Convert any image format (WebP/JPEG) to a standard PNG using Canvas
    // so Tesseract doesn't crash on unsupported pixel buffers.
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    // Draw white background in case of transparent PNGs
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(img, 0, 0);
    
    // Pre-process image: Convert to high-contrast Black & White
    // We determine if it's dark mode by counting pixels, then ensure we output Black Text on White Background
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    let lightPixels = 0;
    let darkPixels = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      if (avg > 128) lightPixels++;
      else darkPixels++;
    }
    
    const isDarkMode = darkPixels > lightPixels;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      let val;
      if (isDarkMode) {
        // Dark mode: invert so light text becomes black (0), dark bg becomes white (255)
        val = avg > 128 ? 0 : 255;
      } else {
        // Light mode: dark text becomes black (0), light bg becomes white (255)
        val = avg > 128 ? 255 : 0;
      }
      data[i] = val;
      data[i+1] = val;
      data[i+2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    
    const pngBuffer = canvas.toBuffer('image/png');
    
    const { data: { text } } = await worker.recognize(pngBuffer);
    if (!text) return false;
    
    const lowerText = text.toLowerCase().replace(/\s+/g, ' ');
    
    // Check if the text contains high-risk scam combinations
    let threatScore = 0;
    
    for (const keyword of scamKeywords) {
      if (lowerText.includes(keyword)) {
        threatScore += 1;
      }
    }
    
    // If it mentions kasowin or helawin specifically, or has multiple red flags
    if (lowerText.includes('kasowin') || lowerText.includes('helawin') || threatScore >= 2) {
      return true;
    }
    
    return false;
  } catch (error) {
    const msg = String(error);
    if (!msg.includes('Unsupported image type') && !msg.includes('Image too small') && !msg.includes('Line cannot be recognized')) {
      console.error('OCR Scanning Error:', error);
    }
    return false;
  }
}

export async function getRawOCRText(url) {
  const worker = await workerPromise;
  if (!worker) return 'Worker not ready';
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'DiscordBot (https://discord.com, 1.0.0)' } });
    if (!res.ok) return 'Fetch failed';
    const buffer = await res.arrayBuffer().then(buf => Buffer.from(buf));
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    let lightPixels = 0;
    let darkPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      if (avg > 128) lightPixels++;
      else darkPixels++;
    }
    
    const isDarkMode = darkPixels > lightPixels;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      let val;
      if (isDarkMode) {
        val = avg > 128 ? 0 : 255;
      } else {
        val = avg > 128 ? 255 : 0;
      }
      data[i] = val; data[i+1] = val; data[i+2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    const { data: { text } } = await worker.recognize(canvas.toBuffer('image/png'));
    if (!text) return 'No text found';
    return text;
  } catch (e) {
    return 'Error: ' + e.message;
  }
}
