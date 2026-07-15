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
  'vyro project',
  'promo code: bet',
  'crypto casino',
  'withdrawal success',
  'mrbeast'
];

// Deduplication cache to prevent messageCreate and messageUpdate from double-logging
export const flaggedMessages = new Set();

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
    
    const buffer = await res.buffer();
    
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
    // This dramatically improves OCR accuracy on dark mode screenshots!
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Calculate grayscale average
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      // Threshold at 128 (pure B&W)
      const val = avg > 128 ? 255 : 0;
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
    
    // If it mentions kasowin specifically, or has multiple red flags
    if (lowerText.includes('kasowin') || threatScore >= 2) {
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
    const buffer = await res.buffer();
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      const val = avg > 128 ? 255 : 0;
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
