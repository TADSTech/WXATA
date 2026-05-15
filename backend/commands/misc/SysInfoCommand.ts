import type { Command, CommandContext } from '../types';
import * as os from 'os';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as util from 'util';
import * as path from 'path';

const execAsync = util.promisify(exec);

class FastFetchDownloader {
  config: { binPath: string };
  fastfetchBinaries: Map<string, { url: string, relativePath: string }>;

  constructor() {
    this.config = {
      binPath: path.join(process.cwd(), 'media', 'bin'),
    };

    this.fastfetchBinaries = new Map([
      ['linux-x64', {
        url: 'https://github.com/fastfetch-cli/fastfetch/releases/latest/download/fastfetch-linux-amd64.tar.gz',
        relativePath: 'fastfetch-linux-amd64/usr/bin/fastfetch',
      }],
      ['linux-arm64', {
        url: 'https://github.com/fastfetch-cli/fastfetch/releases/latest/download/fastfetch-linux-aarch64.tar.gz',
        relativePath: 'fastfetch-linux-aarch64/usr/bin/fastfetch',
      }],
      ['win32-x64', {
        url: 'https://github.com/fastfetch-cli/fastfetch/releases/latest/download/fastfetch-windows-amd64.zip',
        relativePath: 'fastfetch-windows-amd64/fastfetch.exe',
      }],
    ]);
  }

  getPlatformInfo() {
    let platform = os.platform();
    let arch = os.arch();

    if (platform === 'android') {
      platform = 'android';
      arch = arch === 'arm64' ? 'arm64' : 'x64';
    } else if (platform === 'linux') {
      arch = (arch === 'arm64' || (arch as string) === 'aarch64') ? 'arm64' : 'x64';
    } else if (platform === 'win32') {
      arch = 'x64';
    }

    return { platform, arch };
  }

  async tryInstallFromPackageManager() {
    const { platform } = this.getPlatformInfo();
    
    try {
      if (platform === 'android') {
        await execAsync('pkg update -y && pkg install fastfetch -y');
        return true;
      } else if (platform === 'linux') {
        await execAsync('sudo apt update && sudo apt install fastfetch -y');
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  async downloadAndExtractFastFetch() {
    const { platform, arch } = this.getPlatformInfo();
    const key = `${platform === 'android' ? 'linux' : platform}-${arch}`;
    const binary = this.fastfetchBinaries.get(key);

    if (!binary) throw new Error(`Unsupported System: ${key}`);

    await fs.mkdir(this.config.binPath, { recursive: true });
    const downloadPath = path.join(this.config.binPath, path.basename(binary.url));
    const extractPath = this.config.binPath;

    await execAsync(`curl -fsSL -o "${downloadPath}" "${binary.url}"`);
    
    if (platform === 'win32') {
      await execAsync(`powershell -Command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${extractPath}' -Force"`);
    } else {
      await execAsync(`tar xf "${downloadPath}" -C "${extractPath}"`);
    }

    const binaryPath = path.join(this.config.binPath, binary.relativePath);
    if (platform !== 'win32') await fs.chmod(binaryPath, '755');

    await fs.unlink(downloadPath);
    return binaryPath;
  }

  async getFastFetchPath() {
    try {
      const { stdout } = await execAsync('which fastfetch');
      if (stdout.trim()) return 'fastfetch';
    } catch {}

    if (await this.tryInstallFromPackageManager()) return 'fastfetch';

    const { platform, arch } = this.getPlatformInfo();
    const key = `${platform === 'android' ? 'linux' : platform}-${arch}`;
    const binary = this.fastfetchBinaries.get(key);
    
    if (!binary) {
      throw new Error(`Unsupported System: ${key}`);
    }
    
    const localBinaryPath = path.join(this.config.binPath, binary.relativePath);

    try {
      await fs.access(localBinaryPath);
      return localBinaryPath;
    } catch {
      return await this.downloadAndExtractFastFetch();
    }
  }
}

async function safeExec(command: string, fallbackCommand: string | null = null): Promise<string | null> {
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch {
    if (fallbackCommand) {
      try {
        const { stdout } = await execAsync(fallbackCommand);
        return stdout.trim();
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function getSoftwareVersions() {
  const versions = [];
  
  const sudoCheck = await safeExec('which sudo');
  versions.push(`*Sudo* ${sudoCheck ? '✅' : '✖'}`);
  
  const checks = [
    { name: 'Node.js', command: 'node -v', emoji: '🟢' },
    { name: 'NPM', command: 'npm -v', emoji: '📦' },
    { name: 'Python', command: 'python3 --version', fallback: 'python --version', emoji: '🐍' },
    { name: 'Chocolatey', command: 'choco --version', emoji: '🍫' },
    { name: 'FFmpeg', command: 'ffmpeg -version', emoji: '🎬', process: (out: string) => out.split('\n')[0] }
  ];
  
  const pipOutput = await safeExec('pip3 --version', 'pip --version');
  let pipVersion = '✖';
  if (pipOutput) {
    const pipMatch = pipOutput.match(/pip\s+(\d+\.\d+\.\d+)/);
    pipVersion = pipMatch ? (pipMatch[1] as string) : (pipOutput as string) || '✖';
  }
  versions.push(`📊 *PIP:* ${pipVersion}`);

  for (const check of checks) {
    const output = await safeExec(check.command, check.fallback);
    const value = output ? (check.process ? check.process(output) : output) : '✖';
    versions.push(`${check.emoji} *${check.name}:* ${value}`);
  }

  return versions.join('\n');
}

async function runSpeedtest(ctx: CommandContext) {
  const { sock, remoteJid, msg } = ctx;
  try {
    const tempDir = process.env.TEMP_DOWNLOAD_DIR || path.join(process.cwd(), 'media');
    const speedtestPath = path.join(tempDir, 'bin', 'ookla-speedtest.py');
    
    await fs.mkdir(path.dirname(speedtestPath), { recursive: true });
    
    try {
      await fs.access(speedtestPath);
    } catch {
      const speedtestUrl = 'https://raw.githubusercontent.com/weskerty/MysticTools/refs/heads/main/Utilidades/ookla-speedtest.py';
      await execAsync(`curl -fsSL -o "${speedtestPath}" "${speedtestUrl}"`);
      await execAsync(`chmod +x ${speedtestPath}`);
    }

    const stdout = await safeExec(`python3 ${speedtestPath} --secure --share`, `python ${speedtestPath} --secure --share`);
    if (!stdout) throw new Error('Failed to run speedtest');

    const imageUrlMatch = stdout.match(/http[^"]+\.png/);
    if (imageUrlMatch) {
      const imageUrl = imageUrlMatch[0];
      const fetchResponse = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await fetchResponse.arrayBuffer());
      await sock.sendMessage(
        remoteJid,
        { image: imageBuffer, caption: stdout },
        { quoted: msg }
      );
    } else {
      await ctx.sendTrackedMessage(sock, remoteJid, stdout);
    }
    return stdout;
  } catch (error) {
    return '❌ Error Speedtest';
  }
}

export class SysInfoCommand implements Command {
  name = 'SysInfo';
  description = 'All System Server Info';
  trigger = 'sysinfo';
  target: 'chat' | 'self' = 'chat';
  aliases = ['sys', 'info', 'speedtest', 'server'];

  async execute(ctx: CommandContext): Promise<void> {
    const { argumentName, sock, remoteJid } = ctx;
    try {
      await ctx.sendTrackedMessage(sock, remoteJid, '⏳ Fetching system information...');
      const allMode = argumentName && argumentName.trim() === '--all';
      const fastFetchPath = await new FastFetchDownloader().getFastFetchPath();
      const ffCmd = allMode
        ? `"${fastFetchPath}" -l none -c all`
        : `"${fastFetchPath}" -l none`;

      const sysInfo = await safeExec(ffCmd);
      if (sysInfo) await ctx.sendTrackedMessage(sock, remoteJid, sysInfo);
      else throw new Error('Failed to get system information');

      const softwareVersions = await getSoftwareVersions();
      await ctx.sendTrackedMessage(sock, remoteJid, softwareVersions);

      await ctx.sendTrackedMessage(sock, remoteJid, '⏳ Running speedtest...');
      await runSpeedtest(ctx);
    } catch (error: any) {
      await ctx.sendTrackedMessage(sock, remoteJid, `❌ ${error.message}`);
    }
  }
}
