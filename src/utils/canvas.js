let canvasPkg = null;

try {
  canvasPkg = await import('canvas');
} catch (e) {
  try {
    canvasPkg = await import('@napi-rs/canvas');
  } catch {
    console.warn('[Canvas] Native canvas binary not found. Running in graceful canvas fallback mode.');
  }
}

export function createCanvas(width, height) {
  if (canvasPkg && typeof canvasPkg.createCanvas === 'function') {
    return canvasPkg.createCanvas(width, height);
  }
  return {
    width,
    height,
    getContext: () => ({
      fillRect: () => {},
      drawImage: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      rect: () => {},
      clip: () => {},
      roundRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: () => {}
    }),
    toBuffer: () => Buffer.from([])
  };
}

export async function loadImage(src) {
  if (canvasPkg && typeof canvasPkg.loadImage === 'function') {
    return canvasPkg.loadImage(src);
  }
  return { width: 100, height: 100 };
}

export function registerFont(fontPath, opts) {
  if (canvasPkg && typeof canvasPkg.registerFont === 'function') {
    try {
      return canvasPkg.registerFont(fontPath, opts);
    } catch {}
  }
}

export const isCanvasAvailable = !!(canvasPkg && typeof canvasPkg.createCanvas === 'function');
export default { createCanvas, loadImage, registerFont, isCanvasAvailable };
