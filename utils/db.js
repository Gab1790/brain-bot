const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureFile(fileName, defaultData) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
  return filePath;
}

function readData(fileName, defaultData = {}) {
  const filePath = ensureFile(fileName, defaultData);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Erreur lecture ${fileName}:`, err);
    return defaultData;
  }
}

// Simple advisory lock to reduce race conditions across processes.
// Creates a .lock file next to the target file while writing.
function acquireLock(filePath, retries = 20, waitMs = 100) {
  const lockPath = `${filePath}.lock`;
  for (let i = 0; i < retries; i++) {
    try {
      const fd = fs.openSync(lockPath, 'wx'); // fail if exists
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return lockPath;
    } catch (err) {
      // exists or other error -> wait
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    }
  }
  // last attempt: try to remove stale lock if older than threshold
  try {
    const stat = fs.statSync(lockPath);
    const age = Date.now() - stat.mtimeMs;
    if (age > 5 * 60 * 1000) { // 5 minutes stale
      fs.unlinkSync(lockPath);
      return acquireLock(filePath, 5, waitMs);
    }
  } catch (e) {}
  throw new Error('Could not acquire file lock for ' + filePath);
}

function releaseLock(lockPath) {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch (err) {
    // ignore
  }
}

function writeData(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  ensureFile(fileName, {});
  let lockPath;
  try {
    lockPath = acquireLock(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } finally {
    if (lockPath) releaseLock(lockPath);
  }
}

module.exports = { readData, writeData };
