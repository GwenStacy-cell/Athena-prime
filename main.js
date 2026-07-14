import { execSync, spawn } from 'child_process';
import fs from 'fs';

const repoUrl = 'https://github.com/GwenStacy-cell/Athena-prime.git';

console.log('🚀 [Bootstrapper] Starting Pterodactyl Auto-Puller...');

try {
  // Check if the .git folder exists to determine if we need to clone or pull
  if (!fs.existsSync('./.git')) {
    console.log('📦 [Bootstrapper] No git repository found. Initializing forcefully...');
    
    // Forcefully pull into the current directory without failing on hidden files
    execSync('git init', { stdio: 'inherit' });
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
    execSync('git fetch', { stdio: 'inherit' });
    execSync('git reset --hard origin/main', { stdio: 'inherit' });
    
    console.log('✅ [Bootstrapper] Successfully pulled all bot files!');
  } else {
    console.log('🔄 [Bootstrapper] Git repository found. Pulling latest updates...');
    execSync('git pull', { stdio: 'inherit' });
    console.log('✅ [Bootstrapper] Bot is up to date!');
  }

  // Install dependencies in case there are new ones
  console.log('📦 [Bootstrapper] Ensuring all NPM packages are installed...');
  execSync('npm install', { stdio: 'inherit' });

  // Boot the actual bot
  console.log('🟢 [Bootstrapper] Handing over to index.js... booting Athena Prime!');
  const botProcess = spawn('node', ['index.js'], { stdio: 'inherit' });

  botProcess.on('close', (code) => {
    console.log(`❌ [Bootstrapper] Bot process crashed or exited with code ${code}`);
    process.exit(code);
  });
} catch (error) {
  console.error('❌ [Bootstrapper] Error during startup:', error.message);
  process.exit(1);
}
