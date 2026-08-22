import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function checkAndInstallDependencies() {
  const deps = ['@discordjs/opus', 'opusscript', 'ffmpeg-static', 'audio-mixer'];
  const missing = [];
  for (const dep of deps) {
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules', dep))) {
      missing.push(dep);
    }
  }

  if (missing.length > 0) {
    console.log(`[Auto-Install] Missing dependencies detected: ${missing.join(', ')}`);
    console.log('[Auto-Install] Running npm install, please wait...');
    try {
      execSync('npm install ' + missing.join(' '), { stdio: 'inherit' });
      console.log('[Auto-Install] Successfully installed missing dependencies!');
    } catch (e) {
      console.error('[Auto-Install] Failed to install dependencies:', e.message);
    }
  }
}


