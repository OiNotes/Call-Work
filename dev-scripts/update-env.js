#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function getNgrokTunnels() {
  try {
    const response = await fetch('http://localhost:4040/api/tunnels');
    const data = await response.json();
    return data.tunnels;
  } catch (error) {
    console.error('❌ Failed to fetch ngrok tunnels. Is ngrok running?');
    console.error('   Start ngrok first: ngrok http 3000');
    process.exit(1);
  }
}

function findTunnelByPort(tunnels, port) {
  return tunnels.find((t) => t.config.addr.includes(`:${port}`) && t.proto === 'https');
}

function updateEnvFile(filePath, updates) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${path.basename(filePath)}`);
}

async function main() {
  console.log('🔍 Fetching ngrok tunnels...\n');

  const tunnels = await getNgrokTunnels();

  // Find tunnels for each port
  const backendTunnel = findTunnelByPort(tunnels, 3000);
  const webappTunnel = findTunnelByPort(tunnels, 5173);

  if (!backendTunnel || !webappTunnel) {
    console.error('❌ Not all tunnels found!');
    console.error(`   Backend (3000): ${backendTunnel ? '✅' : '❌'}`);
    console.error(`   WebApp (5173): ${webappTunnel ? '✅' : '❌'}`);
    console.error('\n   Make sure you have 2 ngrok tunnels running:');
    console.error('   - ngrok http 3000');
    console.error('   - ngrok http 5173');
    process.exit(1);
  }

  const backendUrl = backendTunnel.public_url;
  const webappUrl = webappTunnel.public_url;

  console.log('📡 Ngrok Tunnels Found:');
  console.log(`   Backend:  ${backendUrl}`);
  console.log(`   WebApp:   ${webappUrl}\n`);

  // Update backend/.env
  updateEnvFile(path.join(rootDir, 'backend', '.env'), {
    FRONTEND_URL: webappUrl,
    BACKEND_URL: backendUrl,
  });

  // Update bot/.env
  updateEnvFile(path.join(rootDir, 'bot', '.env'), {
    WEBAPP_URL: webappUrl,
    BACKEND_URL: backendUrl,
  });

  // Update webapp/.env
  updateEnvFile(path.join(rootDir, 'webapp', '.env'), {
    VITE_API_URL: `${backendUrl}/api`,
  });

  console.log('\n✅ All .env files updated!');
  console.log('\n📋 Next steps:');
  console.log('   1. Restart backend & bot to pick up new URLs');
  console.log('   2. Update BotFather Menu Button:');
  console.log(`      /setmenubutton → ${webappUrl}`);
  console.log('   3. Test: Open bot in Telegram and click Menu button');
}

main().catch(console.error);
