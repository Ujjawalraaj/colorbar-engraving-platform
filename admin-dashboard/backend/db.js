/**
 * db.js — JSON-file-backed persistence layer (in-memory cached)
 * Replaces better-sqlite3 (which requires native C++ build tools).
 * Stores data in backend/data.json; auto-creates on first run.
 *
 * Data is loaded once at startup and cached in memory.
 * All writes update the cache AND flush to disk.
 * All write operations use withLock() to prevent concurrent
 * read-modify-write race conditions.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');

// ─── Simple async lock to serialize write operations ────────────────────────
let lockPromise = Promise.resolve();

function withLock(fn) {
  lockPromise = lockPromise.catch(() => {}).then(fn);
  return lockPromise;
}

// ─── Load from disk (only used at startup) ──────────────────────────────────
function loadFromDisk() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
      // Corrupt file — start fresh
    }
  }
  return { credentials: [], notifiedOrders: [] };
}

function flushToDisk() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// ─── In-memory cache — loaded once at startup ───────────────────────────────
const cache = loadFromDisk();

// ─── Seed default admin on first run ─────────────────────────────────────────
if (cache.credentials.length === 0) {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('❌ ADMIN_PASSWORD env var is required on first run to seed the admin account');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(adminPassword, 10);
  cache.credentials.push({ username: adminUsername, password_hash: hash, role: 'admin' });
  flushToDisk();
  console.log('✅ DB initialised — default admin credentials seeded');
} else {
  console.log('✅ DB loaded from data.json');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the credential record for the given username, or undefined.
 * Reads from cache — no disk I/O.
 */
function getUser(username) {
  return cache.credentials.find(c => c.username === username);
}

/**
 * Updates the password_hash for the given username.
 */
function updatePassword(username, hash) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    user.password_hash = hash;
    flushToDisk();
    return true;
  });
}

/**
 * Returns a Set of order IDs that have already been notified.
 * Reads from cache — no disk I/O.
 */
function getNotifiedOrders() {
  return new Set(cache.notifiedOrders);
}

/**
 * Persists a newly-notified order ID.
 */
function addNotifiedOrder(orderId) {
  return withLock(() => {
    if (!cache.notifiedOrders.includes(String(orderId))) {
      cache.notifiedOrders.push(String(orderId));
      flushToDisk();
    }
  });
}

/**
 * Returns all users as an array of { username, role, totp_enabled } (no hashes exposed).
 * Reads from cache — no disk I/O.
 */
function getAllUsers() {
  return cache.credentials.map(c => ({ username: c.username, role: c.role || 'user', totp_enabled: !!c.totp_enabled }));
}

/**
 * Creates a new user. Returns false if username already exists.
 */
function createUser(username, hash, role = 'user') {
  return withLock(() => {
    if (cache.credentials.find(c => c.username === username)) return false;
    cache.credentials.push({ username, password_hash: hash, role: role || 'user' });
    flushToDisk();
    return true;
  });
}

/**
 * Updates the role for the given username. Returns false if not found.
 */
function updateRole(username, role) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    user.role = role;
    flushToDisk();
    return true;
  });
}

/**
 * Returns profile info for a user (displayName, email).
 * Reads from cache — no disk I/O.
 */
function getProfile(username) {
  const user = cache.credentials.find(c => c.username === username);
  if (!user) return null;
  return { displayName: user.displayName || user.username, email: user.email || '' };
}

/**
 * Updates profile fields (displayName, email) for a user. Returns false if not found.
 */
function updateProfile(username, { displayName, email }) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    if (displayName !== undefined) user.displayName = displayName;
    if (email !== undefined) user.email = email;
    flushToDisk();
    return true;
  });
}

/**
 * Deletes a user by username. Returns false if not found.
 */
function deleteUser(username) {
  return withLock(() => {
    const idx = cache.credentials.findIndex(c => c.username === username);
    if (idx === -1) return false;
    cache.credentials.splice(idx, 1);
    flushToDisk();
    return true;
  });
}

/**
 * Clears all notified orders. Returns the count of cleared entries.
 */
function clearNotifiedOrders() {
  return withLock(() => {
    const count = cache.notifiedOrders.length;
    cache.notifiedOrders = [];
    flushToDisk();
    return count;
  });
}

/**
 * Checks if an order ID has already been notified.
 * Reads from cache — no disk I/O.
 */
function hasNotifiedOrder(orderId) {
  return cache.notifiedOrders.includes(String(orderId));
}

// ─── TOTP / 2FA functions ─────────────────────────────────────────────────────

/**
 * Stores a TOTP secret for the user. Does NOT enable 2FA yet.
 */
function setTotpSecret(username, secret) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    user.totp_secret = secret;
    user.totp_enabled = false;
    flushToDisk();
    return true;
  });
}

/**
 * Enables 2FA for the user (called after setup verification).
 */
function enableTotp(username) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    user.totp_enabled = true;
    flushToDisk();
    return true;
  });
}

/**
 * Disables 2FA — clears secret, enabled flag, and backup codes.
 */
function disableTotp(username) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    user.totp_secret = null;
    user.totp_enabled = false;
    user.totp_backup_codes = [];
    flushToDisk();
    return true;
  });
}

/**
 * Stores an array of bcrypt-hashed backup codes.
 */
function setBackupCodes(username, hashedCodes) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user) return false;
    user.totp_backup_codes = hashedCodes;
    flushToDisk();
    return true;
  });
}

/**
 * Removes a used backup code by index.
 */
function consumeBackupCode(username, index) {
  return withLock(() => {
    const user = cache.credentials.find(c => c.username === username);
    if (!user || !user.totp_backup_codes) return false;
    user.totp_backup_codes.splice(index, 1);
    flushToDisk();
    return true;
  });
}

module.exports = { getUser, updatePassword, getProfile, updateProfile, getAllUsers, createUser, deleteUser, updateRole, getNotifiedOrders, addNotifiedOrder, hasNotifiedOrder, clearNotifiedOrders, setTotpSecret, enableTotp, disableTotp, setBackupCodes, consumeBackupCode };
