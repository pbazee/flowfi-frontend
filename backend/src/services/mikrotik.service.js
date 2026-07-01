const net = require('net');
const { getSupabaseAdmin } = require('../lib/supabase');
const { logger } = require('../lib/logger');
const { URL } = require('url');

const REQUIRED_WALLED_GARDEN_HOSTS = [
  '*.paystack.com',
  'api.paystack.co',
  '*.safaricom.co.ke',
  'sandbox.safaricom.co.ke',
];

try {
  if (process.env.FRONTEND_URL) {
    const portalUrl = new URL(process.env.FRONTEND_URL);
    if (portalUrl.hostname && !REQUIRED_WALLED_GARDEN_HOSTS.includes(portalUrl.hostname)) {
      REQUIRED_WALLED_GARDEN_HOSTS.push(portalUrl.hostname);
    }
  }
} catch (err) {
  logger.warn(`Failed to parse FRONTEND_URL for walled garden sync: ${err.message}`);
}

// ═══════════════════════════════════════════════════
// MikroTik RouterOS API Client (plain TCP)
// ═══════════════════════════════════════════════════

class MikroTikClient {
  constructor(host, port, username, password) {
    this.host = host;
    this.port = port || 8728;
    this.username = username;
    this.password = password;
    this.socket = null;
    this.connected = false;
  }

  _encodeSentence(words) {
    const parts = [];
    for (const word of words) {
      const encoded = Buffer.from(word, 'utf8');
      const len = encoded.length;
      let lenBuf;
      if (len < 0x80) lenBuf = Buffer.from([len]);
      else if (len < 0x4000) lenBuf = Buffer.from([(len >> 8) | 0x80, len & 0xff]);
      else lenBuf = Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
      parts.push(lenBuf, encoded);
    }
    parts.push(Buffer.from([0])); // end of sentence
    return Buffer.concat(parts);
  }

  connect(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      }, timeout);

      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        clearTimeout(timer);
        this._login().then(resolve).catch(reject);
      });

      this.socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  _login() {
    return new Promise((resolve, reject) => {
      const md5 = require('crypto').createHash('md5');
      // Send /login command
      this._send(['/login', `=name=${this.username}`, `=password=${this.password}`]);

      const chunks = [];
      this.socket.on('data', (data) => {
        chunks.push(data);
        const buf = Buffer.concat(chunks);
        // Simple check — if we see !done we're in
        if (buf.includes(Buffer.from('!done'))) {
          this.connected = true;
          this.socket.removeAllListeners('data');
          resolve();
        } else if (buf.includes(Buffer.from('!trap'))) {
          reject(new Error('MikroTik authentication failed'));
        }
      });
    });
  }

  _send(words) {
    if (!this.socket) throw new Error('Not connected');
    this.socket.write(this._encodeSentence(words));
  }

  talk(words) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('Not connected to MikroTik'));

      const results = [];
      let current = {};
      const chunks = [];

      this._send(words);

      const onData = (data) => {
        chunks.push(data);
        const buf = Buffer.concat(chunks);
        // Parse response — look for !done or !trap
        const str = buf.toString('utf8');
        const lines = str.split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('!done')) {
            if (Object.keys(current).length) results.push(current);
            this.socket.removeListener('data', onData);
            resolve(results);
            return;
          } else if (line.startsWith('!trap')) {
            this.socket.removeListener('data', onData);
            reject(new Error(`MikroTik error: ${line}`));
            return;
          } else if (line.startsWith('!re')) {
            if (Object.keys(current).length) results.push(current);
            current = {};
          } else if (line.startsWith('=')) {
            const eq = line.indexOf('=', 1);
            if (eq > 0) {
              current[line.substring(1, eq)] = line.substring(eq + 1);
            }
          }
        }
      };

      this.socket.on('data', onData);
      setTimeout(() => {
        this.socket.removeListener('data', onData);
        reject(new Error('MikroTik command timeout'));
      }, 10000);
    });
  }

  close() {
    this.socket?.end();
    this.socket?.destroy();
    this.connected = false;
  }
}

// ═══════════════════════════════════════════════════
// High-level router operations
// ═══════════════════════════════════════════════════

async function getRouterById(routerId) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('routers').select('*').eq('id', routerId).single();
  if (error || !data) throw new Error('Router not found');
  return data;
}

async function connectToRouter(router) {
  const client = new MikroTikClient(
    router.ip_address,
    router.port || 8728,
    router.api_username,
    router.api_password
  );
  await client.connect();
  return client;
}

function buildHotspotUserAddCommand({ username, password, profile, comment, limitUptime }) {
  return [
    '/ip/hotspot/user/add',
    `=name=${username}`,
    `=password=${password}`,
    `=profile=${profile || 'default'}`,
    `=comment=${comment || ''}`,
    ...(limitUptime ? [`=limit-uptime=${limitUptime}`] : []),
  ];
}

/**
 * Test router connectivity
 */
async function testRouterConnection(ip, port, username, password) {
  const client = new MikroTikClient(ip, port, username, password);
  try {
    await client.connect(5000);
    const identity = await client.talk(['/system/identity/print']);
    await syncRouterWalledGarden(client);
    client.close();
    return { success: true, identity: identity[0]?.name };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
}

/**
 * Sync required Walled Garden entries
 */
async function syncRouterWalledGarden(client) {
  try {
    const existingEntries = await client.talk(['/ip/hotspot/walled-garden/print']);
    const existingHosts = new Set(
      existingEntries
        .map((entry) => String(entry['dst-host'] || '').trim().toLowerCase())
        .filter(Boolean)
    );

    for (const host of REQUIRED_WALLED_GARDEN_HOSTS) {
      if (!existingHosts.has(host.toLowerCase())) {
        await client.talk([
          '/ip/hotspot/walled-garden/add',
          `=dst-host=${host}`,
          '=action=allow',
          `=comment=FlowFi Managed: ${host}`,
        ]);
        logger.info(`Added walled garden entry for ${host}`);
      }
    }
  } catch (err) {
    logger.error(`FIREWALL_SYNC_FAILED: Could not sync walled garden: ${err.message}`);
    // Non-blocking but logged
  }
}

/**
 * Add a hotspot user (activate session)
 */
async function addHotspotUser(routerId, { username, password, profile, comment, limitUptime }) {
  const router = await getRouterById(routerId);
  const client = await connectToRouter(router);
  try {
    await client.talk(buildHotspotUserAddCommand({ username, password, profile, comment, limitUptime }));
    logger.info(`Added hotspot user ${username} on router ${router.ip_address}`);
  } finally {
    client.close();
  }
}

async function upsertHotspotUser(routerId, { username, password, profile, comment, limitUptime }) {
  const router = await getRouterById(routerId);
  const client = await connectToRouter(router);

  try {
    const existingUsers = await client.talk(['/ip/hotspot/user/print', `?name=${username}`]).catch(() => []);
    for (const user of existingUsers) {
      if (user['.id']) {
        await client.talk(['/ip/hotspot/user/remove', `=.id=${user['.id']}`]).catch(() => {});
      }
    }

    const activeSessions = await client.talk(['/ip/hotspot/active/print', `?user=${username}`]).catch(() => []);
    for (const session of activeSessions) {
      if (session['.id']) {
        await client.talk(['/ip/hotspot/active/remove', `=.id=${session['.id']}`]).catch(() => {});
      }
    }

    await client.talk(
      buildHotspotUserAddCommand({ username, password, profile, comment, limitUptime })
    );

    logger.info(`Upserted hotspot user ${username} on router ${router.ip_address}`);
  } finally {
    client.close();
  }
}

/**
 * Remove a hotspot user (expire/disconnect session)
 */
async function removeHotspotUser(routerId, username) {
  const router = await getRouterById(routerId);
  const client = await connectToRouter(router);
  try {
    // Find user ID first
    const users = await client.talk(['/ip/hotspot/user/print', `?name=${username}`]);
    if (users.length > 0) {
      await client.talk(['/ip/hotspot/user/remove', `=.id=${users[0]['.id']}`]);
    }
    // Also remove active session
    const actives = await client.talk([
      '/ip/hotspot/active/print',
      `?user=${username}`,
    ]);
    for (const a of actives) {
      await client.talk(['/ip/hotspot/active/remove', `=.id=${a['.id']}`]).catch(() => {});
    }
    logger.info(`Removed hotspot user ${username}`);
  } finally {
    client.close();
  }
}

/**
 * Disconnect by MAC address
 */
async function disconnectUser(routerId, macAddress) {
  try {
    const router = await getRouterById(routerId);
    const client = await connectToRouter(router);
    try {
      const actives = await client.talk([
        '/ip/hotspot/active/print',
        `?mac-address=${macAddress}`,
      ]);
      for (const a of actives) {
        await client.talk(['/ip/hotspot/active/remove', `=.id=${a['.id']}`]);
      }
    } finally {
      client.close();
    }
  } catch (err) {
    logger.warn(`disconnectUser failed for ${macAddress}: ${err.message}`);
  }
}

/**
 * Get active hotspot sessions
 */
async function getActiveSessions(routerId) {
  const router = await getRouterById(routerId);
  const client = await connectToRouter(router);
  try {
    return await client.talk(['/ip/hotspot/active/print']);
  } finally {
    client.close();
  }
}

/**
 * Create a hotspot user profile (package)
 */
async function createProfile(routerId, { name, rateLimit, sessionTimeout }) {
  const router = await getRouterById(routerId);
  const client = await connectToRouter(router);
  try {
    await client.talk([
      '/ip/hotspot/user/profile/add',
      `=name=${name}`,
      ...(rateLimit ? [`=rate-limit=${rateLimit}`] : []),
      ...(sessionTimeout ? [`=session-timeout=${sessionTimeout}`] : []),
      '=shared-users=1',
    ]);
    logger.info(`Created profile ${name} on router ${router.ip_address}`);
  } finally {
    client.close();
  }
}

/**
 * Ping all routers and update their online status
 */
async function checkAllRouters() {
  const db = getSupabaseAdmin();
  const { data: routers } = await db.from('routers').select('id, ip_address, port, api_username, api_password');

  if (!routers) return;

  for (const router of routers) {
    const previousStatus = router.status;
    const result = await testRouterConnection(
      router.ip_address,
      router.port,
      router.api_username,
      router.api_password
    );

    if (result.success) {
      const client = await connectToRouter(router).catch(() => null);
      if (client) {
        await syncRouterWalledGarden(client);
        client.close();
      }
    }

    await db
      .from('routers')
      .update({
        status: result.success ? 'online' : 'offline',
        last_seen: result.success ? new Date().toISOString() : undefined,
      })
      .eq('id', router.id);

    // Only alert if router was previously online and is now offline
    if (!result.success && previousStatus === 'online') {
      try {
        const { sendRouterOfflineEmail, sendRouterOfflineSMS } = require('./notification.service');
        const { data: tenant } = await db
          .from('tenants')
          .select('name, contact_email, contact_phone')
          .eq('id', router.tenant_id)
          .maybeSingle();
        if (tenant) {
          sendRouterOfflineEmail(tenant, router).catch((err) =>
            logger.error('Router offline email failed: ' + err.message)
          );
          sendRouterOfflineSMS(tenant.contact_phone, router.name).catch((err) =>
            logger.error('Router offline SMS failed: ' + err.message)
          );
        }
      } catch (_) {}
    }
  }
}

module.exports = {
  testRouterConnection,
  addHotspotUser,
  removeHotspotUser,
  disconnectUser,
  getActiveSessions,
  checkAllRouters,
  upsertHotspotUser,
  syncRouterWalledGarden,
};
