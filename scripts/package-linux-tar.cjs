const fs = require('node:fs');
const path = require('node:path');
const tar = require('tar');

const packageJson = require('../package.json');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const linuxDir = path.join(releaseDir, 'linux-unpacked');
const packageDirName = `${packageJson.name}-${packageJson.version}`;
const artifactPath = path.join(releaseDir, `${packageDirName}.tar.gz`);

function isElfFile(filePath) {
  let fileHandle;

  try {
    fileHandle = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    fs.readSync(fileHandle, header, 0, header.length, 0);

    return header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46;
  } catch {
    return false;
  } finally {
    if (fileHandle !== undefined) {
      fs.closeSync(fileHandle);
    }
  }
}

function applyLinuxMode(entry) {
  if (!entry.stat) {
    return;
  }

  if (entry.stat.isDirectory()) {
    entry.stat.mode = (entry.stat.mode & ~0o777) | 0o755;
    return;
  }

  if (entry.stat.isFile()) {
    const mode = isElfFile(entry.absolute) ? 0o755 : 0o644;
    entry.stat.mode = (entry.stat.mode & ~0o777) | mode;
  }
}

async function packageLinuxTar() {
  if (!fs.existsSync(linuxDir)) {
    throw new Error(`Linux output directory not found: ${linuxDir}`);
  }

  if (fs.existsSync(artifactPath)) {
    fs.unlinkSync(artifactPath);
  }

  const files = fs.readdirSync(linuxDir);

  await tar.create(
    {
      cwd: linuxDir,
      file: artifactPath,
      gzip: true,
      prefix: packageDirName,
      portable: true,
      strict: true,
      onWriteEntry: applyLinuxMode,
    },
    files,
  );

  console.log(`Created Linux package: ${artifactPath}`);
}

packageLinuxTar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
