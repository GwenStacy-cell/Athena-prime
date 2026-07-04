import fetch from 'node-fetch';
import { createWorker } from 'tesseract.js';

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
    const { data: { text } } = await worker.recognize(buffer);
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
    console.error('OCR Scanning Error:', error);
    return false;
  }
}
