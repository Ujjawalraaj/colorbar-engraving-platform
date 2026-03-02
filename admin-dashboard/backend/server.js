const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { getUser, updatePassword, getProfile, updateProfile, getAllUsers, createUser, deleteUser, updateRole, addNotifiedOrder, hasNotifiedOrder, clearNotifiedOrders, setTotpSecret, enableTotp, disableTotp, setBackupCodes, consumeBackupCode } = require('./db');
const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — restrict to configured frontend origin ────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '100kb' }));

// ─── Shopify API Configuration ────────────────────────────────────────────────
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = '2025-01';

// ─── Email Configuration ──────────────────────────────────────────────────────
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_TO = process.env.EMAIL_TO || '';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

// ─── Email transporter (STARTTLS) ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT),
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
  // rejectUnauthorized removed — use default (true) for proper TLS validation
});

transporter.verify((err) => {
  if (err) {
    console.error('❌ SMTP Connection Failed:', err.message);
  } else {
    console.log('✅ SMTP Connection Ready (STARTTLS)');
  }
});

// ─── Timing constants ─────────────────────────────────────────────────────────
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;        // 8 hours
const SESSION_CLEANUP_MS = 15 * 60 * 1000;         // 15 minutes
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;            // 15 minutes
const NEW_ORDER_THRESHOLD_MS = 10 * 60 * 1000;     // 10 minutes
const ORDER_POLL_INTERVAL_MS = 2 * 60 * 1000;      // 2 minutes
const BCRYPT_SALT_ROUNDS = 10;

// ─── In-memory active sessions (token → { username, createdAt }) ─────────────
const activeSessions = new Map(); // token → { username, createdAt }

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) activeSessions.delete(token);
  }
}, SESSION_CLEANUP_MS);

// ─── Pending 2FA sessions (pendingToken → { username, createdAt }) ────────
const PENDING_2FA_TTL_MS = 5 * 60 * 1000; // 5 minutes
const pending2FASessions = new Map();

// Clean expired pending 2FA sessions alongside regular sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of pending2FASessions.entries()) {
    if (now - session.createdAt > PENDING_2FA_TTL_MS) pending2FASessions.delete(token);
  }
}, SESSION_CLEANUP_MS);

// ─── TOTP helper ─────────────────────────────────────────────────────────────
function validateTOTP(secret, token) {
  const totp = new TOTP({ secret: Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 });
  // window:1 means accept codes from -30s to +30s
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// ─── Login rate limiter (keyed by username+IP) ─────────────────────────────
const loginAttempts = new Map(); // "username|ip" → { count, firstAttempt }

function getRateLimitKey(req) {
  const ip = req.ip || req.connection.remoteAddress;
  const username = (req.body && req.body.username) || 'unknown';
  return `${username}|${ip}`;
}

function checkLoginRate(req, res, next) {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (record && now - record.firstAttempt < LOGIN_WINDOW_MS) {
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
    }
    record.count++;
  } else {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
  }
  next();
}

function resetLoginRate(req) {
  const key = getRateLimitKey(req);
  loginAttempts.delete(key);
}

// Clean rate-limit entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (now - record.firstAttempt > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}, LOGIN_WINDOW_MS);

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const session = activeSessions.get(token);
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  req.username = session.username;
  next();
}

// ─── Admin middleware (must run after requireAuth) ───────────────────────────
function requireAdmin(req, res, next) {
  const user = getUser(req.username);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ─── Auth endpoints (public) ─────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', checkLoginRate, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const user = getUser(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  resetLoginRate(req);

  // If user has 2FA enabled, issue a pending token instead of a full session
  if (user.totp_enabled && user.totp_secret) {
    const pendingToken = crypto.randomBytes(32).toString('hex');
    pending2FASessions.set(pendingToken, { username, createdAt: Date.now() });
    return res.json({ requires2FA: true, pendingToken });
  }

  // User has no 2FA — issue session but flag that setup is required
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, { username, createdAt: Date.now() });
  res.json({ token, role: user.role || 'user', totpEnabled: false });
});

// POST /api/auth/verify-2fa — verify TOTP code or backup code, issue session
app.post('/api/auth/verify-2fa', async (req, res) => {
  const { pendingToken, totpCode } = req.body || {};
  if (!pendingToken || !totpCode) {
    return res.status(400).json({ error: 'pendingToken and totpCode are required' });
  }
  const pending = pending2FASessions.get(pendingToken);
  if (!pending) {
    return res.status(401).json({ error: 'Invalid or expired 2FA session' });
  }
  if (Date.now() - pending.createdAt > PENDING_2FA_TTL_MS) {
    pending2FASessions.delete(pendingToken);
    return res.status(401).json({ error: '2FA session expired. Please log in again.' });
  }

  const user = getUser(pending.username);
  if (!user || !user.totp_secret) {
    pending2FASessions.delete(pendingToken);
    return res.status(401).json({ error: 'User not found or 2FA not configured' });
  }

  // Try TOTP code first
  const code = totpCode.replace(/\s/g, '');
  if (validateTOTP(user.totp_secret, code)) {
    pending2FASessions.delete(pendingToken);
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, { username: pending.username, createdAt: Date.now() });
    return res.json({ token, role: user.role || 'user' });
  }

  // Try backup codes
  if (user.totp_backup_codes && user.totp_backup_codes.length > 0) {
    for (let i = 0; i < user.totp_backup_codes.length; i++) {
      const match = await bcrypt.compare(code, user.totp_backup_codes[i]);
      if (match) {
        await consumeBackupCode(pending.username, i);
        pending2FASessions.delete(pendingToken);
        const token = crypto.randomBytes(32).toString('hex');
        activeSessions.set(token, { username: pending.username, createdAt: Date.now() });
        return res.json({ token, role: user.role || 'user' });
      }
    }
  }

  return res.status(401).json({ error: 'Invalid verification code' });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'oldPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = getUser(req.username);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await updatePassword(req.username, hash);
  res.json({ success: true, message: 'Password updated successfully' });
});

// GET /api/auth/profile — get current user's profile
app.get('/api/auth/profile', requireAuth, (req, res) => {
  const profile = getProfile(req.username);
  if (!profile) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(profile);
});

// PUT /api/auth/profile — update current user's profile
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const { displayName, email } = req.body || {};
  if (displayName !== undefined && typeof displayName !== 'string') {
    return res.status(400).json({ error: 'displayName must be a string' });
  }
  if (email !== undefined && typeof email !== 'string') {
    return res.status(400).json({ error: 'email must be a string' });
  }
  const updated = await updateProfile(req.username, { displayName, email });
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ success: true, message: 'Profile updated successfully' });
});

// POST /api/auth/logout — invalidate current session token
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) activeSessions.delete(token);
  res.json({ success: true, message: 'Logged out' });
});

// ─── TOTP management endpoints ────────────────────────────────────────────────

// GET /api/auth/totp/status — check if current user has 2FA enabled
app.get('/api/auth/totp/status', requireAuth, (req, res) => {
  const user = getUser(req.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ totpEnabled: !!user.totp_enabled });
});

// POST /api/auth/totp/setup — generate TOTP secret + QR code
app.post('/api/auth/totp/setup', requireAuth, async (req, res) => {
  const user = getUser(req.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.totp_enabled) {
    return res.status(400).json({ error: '2FA is already enabled. Disable it first to reconfigure.' });
  }

  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: 'Colorbar Admin',
    label: req.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret
  });

  await setTotpSecret(req.username, secret.base32);

  const otpauthUrl = totp.toString();
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  res.json({ qrCode, secret: secret.base32 });
});

// POST /api/auth/totp/verify-setup — user enters test code to confirm setup
app.post('/api/auth/totp/verify-setup', requireAuth, async (req, res) => {
  const { totpCode } = req.body || {};
  if (!totpCode) {
    return res.status(400).json({ error: 'totpCode is required' });
  }

  const user = getUser(req.username);
  if (!user || !user.totp_secret) {
    return res.status(400).json({ error: 'TOTP setup not started. Call /api/auth/totp/setup first.' });
  }
  if (user.totp_enabled) {
    return res.status(400).json({ error: '2FA is already enabled.' });
  }

  const code = totpCode.replace(/\s/g, '');
  if (!validateTOTP(user.totp_secret, code)) {
    return res.status(401).json({ error: 'Invalid code. Please try again.' });
  }

  // Enable 2FA
  await enableTotp(req.username);

  // Generate 8 backup codes
  const backupCodes = [];
  const hashedCodes = [];
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(4).toString('hex'); // 8-char hex
    backupCodes.push(code);
    hashedCodes.push(await bcrypt.hash(code, BCRYPT_SALT_ROUNDS));
  }
  await setBackupCodes(req.username, hashedCodes);

  console.log(`🔐 2FA enabled for user: ${req.username}`);
  res.json({ success: true, backupCodes });
});

// DELETE /api/users/:username/totp — admin resets a user's 2FA
app.delete('/api/users/:username/totp', requireAuth, requireAdmin, async (req, res) => {
  const target = req.params.username;
  const user = getUser(target);
  if (!user) return res.status(404).json({ error: `User "${target}" not found` });
  if (!user.totp_enabled) {
    return res.status(400).json({ error: `User "${target}" does not have 2FA enabled` });
  }

  await disableTotp(target);
  console.log(`🔓 2FA reset for user: ${target} (by admin ${req.username})`);
  res.json({ success: true, message: `2FA has been reset for ${target}` });
});

// ─── Protected API routes ─────────────────────────────────────────────────────
// requireAuth is passed inline to each route handler below

// ─── Shopify API helper ───────────────────────────────────────────────────────
async function callShopifyAPI(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`,
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    };
    if (data) config.data = data;
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Shopify API Error:', error.response?.data || error.message);
    throw error;
  }
}

// ─── Order transformation helpers ─────────────────────────────────────────────

function getDashboardStatus(shopifyOrder) {
  const tags = (shopifyOrder.tags || '').toLowerCase();
  if (tags.includes('dashboard-completed') || tags.includes('engraving-completed')) return 'Completed';
  if (tags.includes('dashboard-processing') || tags.includes('engraving-processing')) return 'Processing';
  if (tags.includes('dashboard-pending') || tags.includes('engraving-pending')) return 'Pending';
  if (shopifyOrder.fulfillment_status === 'fulfilled') return 'Completed';
  if (shopifyOrder.financial_status === 'paid') return 'Processing';
  return 'Pending';
}

function transformLineItem(shopifyOrder, lineItem, itemIndex) {
  if (process.env.DEBUG) {
    console.log('\n🔍 DEBUG - Order:', shopifyOrder.order_number, '| Item:', itemIndex + 1);
    console.log('📦 Product:', lineItem.name);
    console.log('🏷️  Properties received:', lineItem.properties);
  }

  const properties = {};
  if (lineItem.properties && lineItem.properties.length > 0) {
    lineItem.properties.forEach(prop => {
      properties[prop.name] = prop.value;
      properties[prop.name.toLowerCase()] = prop.value;
      if (process.env.DEBUG) {
        console.log(`   ✓ ${prop.name}: ${prop.value.substring ? prop.value.substring(0, 100) : prop.value}${prop.value.length > 100 ? '...' : ''}`);
      }
    });
  } else if (process.env.DEBUG) {
    console.log('   ⚠️  No properties found in this order!');
  }
  if (process.env.DEBUG) console.log('─'.repeat(60));

  const findProperty = (possibleNames) => {
    for (const name of possibleNames) {
      if (properties[name] !== undefined && properties[name] !== null && properties[name] !== '') {
        return properties[name];
      }
      if (properties[name.toLowerCase()] !== undefined && properties[name.toLowerCase()] !== null && properties[name.toLowerCase()] !== '') {
        return properties[name.toLowerCase()];
      }
    }
    return '';
  };

  const sku = lineItem.sku || 'N/A';

  const shade = findProperty(['Shade', 'shade', 'Color', 'color', 'Colour', 'colour',
    'Variant', 'variant', 'Product Color', 'product color', 'Shade Name', 'shade name']);

  const shadeColor = findProperty(['Shade Color', 'shade color', 'Color Code', 'color code',
    'Shade Swatch', 'shade swatch']);

  const engravingTextOnly = findProperty(['Text Only', 'text only']);
  const engravingTextFull = findProperty(['Engraving Text', 'engraving text', 'Engraving', 'engraving',
    'Text', 'text', 'Personalization', 'personalization', 'Custom Text', 'custom text']);
  const engravingText = engravingTextOnly || engravingTextFull || 'Not specified';

  const font = findProperty(['Engraving Font', 'engraving font', 'Font', 'font',
    'Font Style', 'font style', 'Font Type', 'font type', 'Typography', 'typography']);

  const motifsValue = findProperty(['Motifs', 'motifs', 'Motif', 'motif',
    'Icons', 'icons', 'Symbols', 'symbols', 'Emoji', 'emoji']);

  let motifs = [];
  if (motifsValue) {
    motifs = motifsValue.split(',').map(m => m.trim()).filter(m => m);
  }

  const previewData = findProperty(['_Preview Data', 'Preview Data', '_preview data',
    'preview data', 'Engraving Preview Data', 'engraving preview data']);

  if (process.env.DEBUG) {
    if (previewData) {
      console.log('✅ Preview Data found! Length:', previewData.length);
    } else {
      console.log('❌ Preview Data NOT found in order properties');
    }
  }

  const engravingFee = findProperty(['Engraving Fee', 'engraving fee', 'Customization Fee',
    'customization fee', 'Personalization Fee', 'personalization fee']);

  const suffix = itemIndex > 0 ? `-${itemIndex + 1}` : '';
  return {
    orderId: `ORD-${shopifyOrder.order_number}${suffix}`,
    customerName: shopifyOrder.customer
      ? `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim()
      : 'Guest Customer',
    email: shopifyOrder.customer?.email || shopifyOrder.contact_email || 'no-email@provided.com',
    phone: shopifyOrder.customer?.phone || shopifyOrder.phone || 'Not provided',
    productName: lineItem.name || 'Product',
    sku,
    shade: shade || 'Not specified',
    shadeColor: shadeColor || null,
    engravingText,
    font: font || 'Not specified',
    motifs,
    orderDate: new Date(shopifyOrder.created_at).toISOString().split('T')[0],
    status: getDashboardStatus(shopifyOrder),
    totalAmount: shopifyOrder.total_price,
    engravingFee: engravingFee || '100',
    shopifyId: shopifyOrder.id,
    shopifyOrderNumber: shopifyOrder.order_number,
    variantId: lineItem.variant_id,
    previewData: previewData || null,
    rawProperties: lineItem.properties || [],
    engravingTextWithMotifs: engravingTextFull || engravingText
  };
}

function lineItemHasEngraving(lineItem) {
  if (!lineItem?.properties || lineItem.properties.length === 0) return false;
  return lineItem.properties.some(prop => {
    const propName = prop.name.toLowerCase();
    return propName.includes('engrav') ||
           propName.includes('text') ||
           propName.includes('font') ||
           propName.includes('personali') ||
           propName.includes('custom') ||
           propName.includes('motif');
  });
}

function hasEngravingDetails(order) {
  return order.line_items.some(lineItem => lineItemHasEngraving(lineItem));
}

function transformOrder(shopifyOrder) {
  const entries = [];
  shopifyOrder.line_items.forEach((lineItem, index) => {
    if (lineItemHasEngraving(lineItem)) {
      entries.push(transformLineItem(shopifyOrder, lineItem, index));
    }
  });
  if (entries.length === 0 && shopifyOrder.line_items.length > 0) {
    entries.push(transformLineItem(shopifyOrder, shopifyOrder.line_items[0], 0));
  }
  return entries;
}

// ─── Email helpers ────────────────────────────────────────────────────────────

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHTML(items, orderNumber) {
  const safeOrderNumber = escapeHTML(String(orderNumber));
  const tableRows = items.map(item => {
    const name = escapeHTML(item.customerName);
    const phone = escapeHTML(item.phone);
    const product = escapeHTML(item.productName);
    const sku = escapeHTML(item.sku);
    const shade = escapeHTML(item.shade || '');
    const amount = escapeHTML(String(item.totalAmount));
    const font = escapeHTML(item.font || 'Not specified');
    const text = escapeHTML(item.engravingText);
    return `
    <tr>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${safeOrderNumber}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${name}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;"><a href="tel:${phone}" style="color:#2a6496;text-decoration:none;">${phone}</a></td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${product}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${sku}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${shade}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${amount}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${font}</td>
      <td style="border:1px solid #ddd;padding:10px;text-align:center;font-size:14px;background:#f9f9f9;">${text}</td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;">
      <div style="background-color:#333333;padding:20px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;">Colorbar Engraving Order</h1>
      </div>
      <div style="padding:30px 40px;">
        <p style="font-size:15px;">Dear User,</p>
        <p style="font-size:15px;line-height:1.6;">A new order [${safeOrderNumber}] has been created. Following are engrave details:</p>
        <p style="font-size:15px;line-height:1.6;">To view engraving order, please click on below link</p>
        <p><a href="${DASHBOARD_URL}" style="color:#0066cc;font-size:15px;font-weight:bold;text-decoration:none;">Engrave Order</a></p>
        <table style="width:100%;border-collapse:collapse;margin-top:25px;">
          <thead>
            <tr>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Order No</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Customer Name</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Customer Mobile</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Product Name</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Product SKU</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Shade Name</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Amount</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Engrave Font</th>
              <th style="background:#333;color:#fff;padding:12px 10px;border:1px solid #555;font-size:13px;">Engrave Text</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div style="background-color:#f5f5f5;padding:15px;text-align:center;border-top:1px solid #ddd;">
        <p style="font-size:12px;color:#888;margin:0;">Colorbar Engraving Dashboard - Automated Notification</p>
      </div>
    </body>
    </html>
  `;
}

async function sendOrderNotification(items, orderNumber) {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.log('⚠️  Email not configured - skipping notification for order', orderNumber);
    return;
  }
  try {
    const recipients = EMAIL_TO.split(',').map(e => e.trim()).filter(e => e);
    const html = buildEmailHTML(items, orderNumber);
    await transporter.sendMail({
      from: `"Colorbar Engraving" <${EMAIL_USER}>`,
      to: recipients.join(', '),
      subject: `New Engraving Order [${orderNumber}]`,
      html
    });
    console.log(`📧 Email notification sent for order ${orderNumber} to: ${recipients.join(', ')}`);
  } catch (error) {
    console.error(`❌ Failed to send email for order ${orderNumber}:`, error.message);
  }
}

async function checkAndNotifyNewOrders() {
  try {
    const data = await callShopifyAPI('orders.json?status=any&limit=50');
    const engravingOrders = data.orders.filter(hasEngravingDetails);

    for (const order of engravingOrders) {
      const orderKey = String(order.id);
      if (!hasNotifiedOrder(orderKey)) {
        addNotifiedOrder(orderKey); // persist to cache + disk atomically

        const orderAge = Date.now() - new Date(order.created_at).getTime();
        if (orderAge < NEW_ORDER_THRESHOLD_MS) {
          const items = transformOrder(order);
          await sendOrderNotification(items, order.order_number);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error checking for new orders:', error.message);
  }
}

// ─── User Management Endpoints ───────────────────────────────────────────────

// GET /api/users — list all users (admin only)
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json(getAllUsers());
});

const VALID_ROLES = ['admin', 'user'];

// POST /api/users — create a new user (admin only)
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (!/^[a-zA-Z0-9_.@-]{3,64}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–64 characters (letters, numbers, @, ., - or _)' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const assignedRole = role || 'user';
  if (!VALID_ROLES.includes(assignedRole)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const created = await createUser(username, hash, assignedRole);
  if (!created) {
    return res.status(409).json({ error: `Username "${username}" already exists` });
  }
  console.log(`👤 User created: ${username} with role ${assignedRole} (by ${req.username})`);
  res.status(201).json({ success: true, username, role: assignedRole });
});

// PUT /api/users/:username/role — change a user's role (admin only)
app.put('/api/users/:username/role', requireAuth, requireAdmin, async (req, res) => {
  const target = req.params.username;
  const { role } = req.body || {};
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (target === req.username) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }
  const updated = await updateRole(target, role);
  if (!updated) {
    return res.status(404).json({ error: `User "${target}" not found` });
  }
  console.log(`🔄 Role changed: ${target} → ${role} (by ${req.username})`);
  res.json({ username: target, role });
});

// DELETE /api/users/:username — delete a user (admin only)
app.delete('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
  const target = req.params.username;
  if (target === req.username) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const deleted = await deleteUser(target);
  if (!deleted) {
    return res.status(404).json({ error: `User "${target}" not found` });
  }
  // Revoke any active sessions for that user
  for (const [token, session] of activeSessions.entries()) {
    if (session.username === target) activeSessions.delete(token);
  }
  console.log(`🗑️  User deleted: ${target} (by ${req.username})`);
  res.json({ success: true });
});

// PUT /api/users/:username/password — reset another user's password (admin only)
app.put('/api/users/:username/password', requireAuth, requireAdmin, async (req, res) => {
  const target = req.params.username;
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
  }
  const user = getUser(target);
  if (!user) {
    return res.status(404).json({ error: `User "${target}" not found` });
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await updatePassword(target, hash);
  console.log(`🔑 Password reset for: ${target} (by ${req.username})`);
  res.json({ success: true });
});

// ─── API Endpoints ────────────────────────────────────────────────────────────

// POST /api/reset — clear cached notification state (admin only)
app.post('/api/reset', requireAuth, requireAdmin, async (req, res) => {
  const cleared = await clearNotifiedOrders();
  console.log(`🗑️  Reset: cleared ${cleared} notified order entries (by ${req.username})`);
  res.json({ success: true, message: `Cleared ${cleared} notified order records` });
});

// GET /api/health — public
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend server is running',
    shopifyStore: SHOPIFY_STORE,
    timestamp: new Date().toISOString()
  });
});

// GET /api/orders
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    if (process.env.DEBUG) console.log('📥 Fetching orders from Shopify...');
    const data = await callShopifyAPI('orders.json?status=any&limit=250');
    if (process.env.DEBUG) console.log(`📦 Total orders retrieved: ${data.orders.length}`);
    const engravingOrders = data.orders.filter(hasEngravingDetails);
    if (process.env.DEBUG) console.log(`✨ Orders with engraving: ${engravingOrders.length}`);
    const transformedOrders = engravingOrders.flatMap(transformOrder);
    res.json(transformedOrders);
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

// GET /api/orders/all — all orders without engraving filter
app.get('/api/orders/all', requireAuth, async (req, res) => {
  try {
    const data = await callShopifyAPI('orders.json?status=any&limit=250');
    const orders = data.orders.flatMap(transformOrder);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const data = await callShopifyAPI(`orders/${req.params.id}.json`);
    const items = transformOrder(data.order);
    res.json(items);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PUT /api/orders/:id — update status with whitelist validation
const VALID_STATUSES = ['Pending', 'Processing', 'Completed'];

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const shopifyId = req.params.id;
    if (process.env.DEBUG) console.log(`📝 Updating order ${shopifyId} to status: ${status}`);

    const existingData = await callShopifyAPI(`orders/${shopifyId}.json`);
    const existingTags = (existingData.order.tags || '').split(',').map(t => t.trim()).filter(t => t);

    const cleanedTags = existingTags.filter(tag => {
      const lower = tag.toLowerCase();
      return !lower.startsWith('dashboard-') && !lower.startsWith('engraving-');
    });
    cleanedTags.push(`dashboard-${status.toLowerCase()}`);
    cleanedTags.push(`engraving-${status.toLowerCase()}`);

    const updateData = {
      order: {
        id: shopifyId,
        note: `Dashboard Status: ${status} (Updated: ${new Date().toISOString()})`,
        tags: cleanedTags.join(', ')
      }
    };

    await callShopifyAPI(`orders/${shopifyId}.json`, 'PUT', updateData);
    console.log(`✅ Order ${shopifyId} updated successfully`);
    res.json({ success: true, status });
  } catch (error) {
    console.error('❌ Error updating order:', error.message);
    res.status(500).json({ error: 'Failed to update order', details: error.message });
  }
});

// GET /api/customers
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const data = await callShopifyAPI('customers.json?limit=250');
    res.json(data.customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/test — test Shopify connection
app.get('/api/test', requireAuth, async (req, res) => {
  try {
    const data = await callShopifyAPI('shop.json');
    res.json({ success: true, shop: data.shop.name, message: 'Successfully connected to Shopify!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to connect to Shopify', details: error.message });
  }
});

// GET /api/test-email — send a test email
app.get('/api/test-email', requireAuth, async (req, res) => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    return res.status(400).json({
      success: false,
      error: 'Email not configured. Set EMAIL_USER, EMAIL_PASS, EMAIL_TO in .env'
    });
  }
  try {
    const testItems = [{
      customerName: 'Test Customer',
      phone: '9999999999',
      productName: 'Sinful Matte Lipcolor - Test',
      sku: 'TEST001',
      shade: 'Ruby Red',
      totalAmount: '999.00',
      font: 'Rockwell',
      engravingText: 'TEST',
      motifs: ['♡', '☆']
    }];
    await sendOrderNotification(testItems, '000000000');
    res.json({ success: true, message: 'Test email sent to: ' + EMAIL_TO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('✅ Backend server running on http://localhost:' + PORT);
  console.log('📊 Connected to Shopify store: ' + SHOPIFY_STORE);
  console.log('🔍 Filtering for engraving orders only');
  console.log('🔐 Auth: JWT-less token auth enabled');
  console.log('🌐 CORS: restricted to ' + FRONTEND_URL);

  if (EMAIL_USER && EMAIL_TO) {
    console.log('📧 Email notifications: ENABLED → ' + EMAIL_TO);
  } else {
    console.log('📧 Email notifications: DISABLED (set EMAIL_USER, EMAIL_PASS, EMAIL_TO in .env)');
  }
  console.log('='.repeat(60) + '\n');

  console.log('Available endpoints:');
  console.log('  GET  /api/health                  - Health check (public)');
  console.log('  POST /api/auth/login              - Login');
  console.log('  POST /api/auth/change-password    - Change password (auth required)');
  console.log('  GET  /api/orders                  - Fetch engraving orders (auth required)');
  console.log('  GET  /api/orders/all              - All orders (auth required)');
  console.log('  GET  /api/orders/:id              - Single order (auth required)');
  console.log('  PUT  /api/orders/:id              - Update order status (auth required)');
  console.log('  GET  /api/customers               - Fetch customers (auth required)');
  console.log('  GET  /api/test                    - Test Shopify connection (auth required)');
  console.log('  GET  /api/test-email              - Send test email (auth required)\n');

  // Pre-load existing orders — notifiedOrders already loaded from DB
  checkAndNotifyNewOrders();

  // Poll for new orders periodically
  setInterval(checkAndNotifyNewOrders, ORDER_POLL_INTERVAL_MS);
});
