const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'POST' && path === '/v1/installations/register') {
        return json(await registerInstallation(request, env));
      }

      if (request.method === 'GET' && path === '/v1/facebook/callback') {
        return facebookCallback(url, env);
      }

      const installation = await authenticateInstallation(request, env);

      if (request.method === 'POST' && path === '/v1/facebook/connect-session') {
        return json(await createConnectSession(request, env, installation));
      }
      if (request.method === 'GET' && path === '/v1/pages') {
        return json(await listPages(env, installation.id));
      }

      const defaultMatch = path.match(/^\/v1\/pages\/([^/]+)\/default$/);
      if (request.method === 'PUT' && defaultMatch) {
        return json(await setDefaultPage(env, installation.id, decodeURIComponent(defaultMatch[1])));
      }

      const pageMatch = path.match(/^\/v1\/pages\/([^/]+)$/);
      if (request.method === 'DELETE' && pageMatch) {
        return json(await disconnectPage(env, installation.id, decodeURIComponent(pageMatch[1])));
      }

      return json({ error: 'Không tìm thấy API.' }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: error.message || 'Lỗi Cloudflare Worker.' }, error.status || 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(checkAllPageTokens(env));
  }
};

async function registerInstallation(request, env) {
  const body = await request.json();
  if (!isUuid(body.installationId) || !body.installationSecret || body.installationSecret.length < 32) {
    throw httpError(400, 'Thông tin cài đặt extension không hợp lệ.');
  }

  const secretHash = await sha256(body.installationSecret);
  const existing = await env.DB.prepare('SELECT secret_hash FROM installations WHERE id = ?')
    .bind(body.installationId).first();

  if (existing && !safeEqual(existing.secret_hash, secretHash)) {
    throw httpError(409, 'Installation ID đã được đăng ký.');
  }
  if (!existing) {
    await env.DB.prepare('INSERT INTO installations (id, secret_hash, created_at) VALUES (?, ?, ?)')
      .bind(body.installationId, secretHash, Date.now()).run();
  }
  return { success: true };
}

async function authenticateInstallation(request, env) {
  const match = (request.headers.get('Authorization') || '').match(/^Install ([^.]+)\.(.+)$/);
  if (!match) throw httpError(401, 'Thiếu xác thực extension.');

  const record = await env.DB.prepare('SELECT id, secret_hash FROM installations WHERE id = ?')
    .bind(match[1]).first();
  if (!record || !safeEqual(record.secret_hash, await sha256(match[2]))) {
    throw httpError(401, 'Xác thực extension không hợp lệ.');
  }
  return record;
}

async function createConnectSession(request, env, installation) {
  requireFacebookConfig(env);
  const { redirectUrl } = await request.json();
  const allowedPrefix = `https://${env.CHROME_EXTENSION_ID}.chromiumapp.org/`;
  if (!redirectUrl || !redirectUrl.startsWith(allowedPrefix)) {
    throw httpError(400, 'OAuth redirect URL không thuộc extension đã cấu hình.');
  }

  const state = randomToken(32);
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await env.DB.prepare('INSERT INTO oauth_states (state, installation_id, redirect_url, expires_at) VALUES (?, ?, ?, ?)')
    .bind(state, installation.id, redirectUrl, expiresAt).run();

  const callbackUrl = `${new URL(request.url).origin}/v1/facebook/callback`;
  const graphVersion = env.FB_GRAPH_VERSION || 'v26.0';
  const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  authUrl.searchParams.set('client_id', env.FB_APP_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'pages_show_list,pages_read_engagement,pages_manage_posts');
  return { authUrl: authUrl.toString() };
}

async function facebookCallback(url, env) {
  requireFacebookConfig(env);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error_message') || url.searchParams.get('error_description');
  if (oauthError) throw httpError(400, oauthError);
  if (!state || !code) throw httpError(400, 'Facebook không trả về authorization code.');

  const session = await env.DB.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first();
  if (!session || session.expires_at < Date.now()) throw httpError(400, 'Phiên kết nối Facebook đã hết hạn.');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

  const origin = url.origin;
  const callbackUrl = `${origin}/v1/facebook/callback`;
  const version = env.FB_GRAPH_VERSION || 'v26.0';
  const shortTokenResult = await graphGet(`${version}/oauth/access_token`, {
    client_id: env.FB_APP_ID,
    client_secret: env.FB_APP_SECRET,
    redirect_uri: callbackUrl,
    code
  });

  const longTokenResult = await graphGet(`${version}/oauth/access_token`, {
    grant_type: 'fb_exchange_token',
    client_id: env.FB_APP_ID,
    client_secret: env.FB_APP_SECRET,
    fb_exchange_token: shortTokenResult.access_token
  });

  const pagesResult = await graphGet(`${version}/me/accounts`, {
    fields: 'id,name,access_token,picture{url},tasks',
    limit: '100',
    access_token: longTokenResult.access_token
  });

  const existingDefault = await env.DB.prepare(
    'SELECT page_id FROM facebook_pages WHERE installation_id = ? AND is_default = 1'
  ).bind(session.installation_id).first();

  const pages = (pagesResult.data || []).filter(page => page.access_token);
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const tokenCipher = await encryptToken(page.access_token, env.TOKEN_ENCRYPTION_KEY);
    const isDefault = existingDefault ? (existingDefault.page_id === page.id ? 1 : 0) : (index === 0 ? 1 : 0);
    await env.DB.prepare(`
      INSERT INTO facebook_pages
        (installation_id, page_id, name, picture_url, token_cipher, token_status, is_default, connected_at, checked_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
      ON CONFLICT(installation_id, page_id) DO UPDATE SET
        name = excluded.name,
        picture_url = excluded.picture_url,
        token_cipher = excluded.token_cipher,
        token_status = 'active',
        checked_at = excluded.checked_at
    `).bind(
      session.installation_id,
      page.id,
      page.name || 'Facebook Page',
      page.picture?.data?.url || '',
      tokenCipher,
      isDefault,
      Date.now(),
      Date.now()
    ).run();
  }

  const finalUrl = new URL(session.redirect_url);
  finalUrl.searchParams.set('facebook', 'connected');
  finalUrl.searchParams.set('pages', String(pages.length));
  return Response.redirect(finalUrl.toString(), 302);
}

async function listPages(env, installationId) {
  const result = await env.DB.prepare(`
    SELECT page_id, name, picture_url, token_status, is_default, connected_at, checked_at
    FROM facebook_pages WHERE installation_id = ? ORDER BY is_default DESC, name COLLATE NOCASE
  `).bind(installationId).all();

  return {
    pages: (result.results || []).map(page => ({
      pageId: page.page_id,
      name: page.name,
      pictureUrl: page.picture_url,
      tokenStatus: page.token_status,
      isDefault: Boolean(page.is_default),
      connectedAt: page.connected_at,
      checkedAt: page.checked_at
    }))
  };
}

async function setDefaultPage(env, installationId, pageId) {
  const found = await env.DB.prepare(
    'SELECT page_id FROM facebook_pages WHERE installation_id = ? AND page_id = ?'
  ).bind(installationId, pageId).first();
  if (!found) throw httpError(404, 'Không tìm thấy Fanpage.');

  await env.DB.batch([
    env.DB.prepare('UPDATE facebook_pages SET is_default = 0 WHERE installation_id = ?').bind(installationId),
    env.DB.prepare('UPDATE facebook_pages SET is_default = 1 WHERE installation_id = ? AND page_id = ?').bind(installationId, pageId)
  ]);
  return { success: true };
}

async function disconnectPage(env, installationId, pageId) {
  const current = await env.DB.prepare(
    'SELECT is_default FROM facebook_pages WHERE installation_id = ? AND page_id = ?'
  ).bind(installationId, pageId).first();
  await env.DB.prepare('DELETE FROM facebook_pages WHERE installation_id = ? AND page_id = ?')
    .bind(installationId, pageId).run();

  if (current?.is_default) {
    const replacement = await env.DB.prepare(
      'SELECT page_id FROM facebook_pages WHERE installation_id = ? ORDER BY name COLLATE NOCASE LIMIT 1'
    ).bind(installationId).first();
    if (replacement) await setDefaultPage(env, installationId, replacement.page_id);
  }
  return { success: true };
}

async function checkAllPageTokens(env) {
  const version = env.FB_GRAPH_VERSION || 'v26.0';
  const records = await env.DB.prepare(
    "SELECT installation_id, page_id, token_cipher FROM facebook_pages WHERE token_status = 'active'"
  ).all();

  for (const record of records.results || []) {
    let status = 'reconnect_required';
    try {
      const token = await decryptToken(record.token_cipher, env.TOKEN_ENCRYPTION_KEY);
      const debug = await graphGet(`${version}/debug_token`, {
        input_token: token,
        access_token: `${env.FB_APP_ID}|${env.FB_APP_SECRET}`
      });
      status = debug.data?.is_valid ? 'active' : 'reconnect_required';
    } catch (error) {
      console.error('Token check failed for page', record.page_id, error);
    }
    await env.DB.prepare(
      'UPDATE facebook_pages SET token_status = ?, checked_at = ? WHERE installation_id = ? AND page_id = ?'
    ).bind(status, Date.now(), record.installation_id, record.page_id).run();
  }

  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Date.now()).run();
}

async function graphGet(path, params) {
  const url = new URL(`https://graph.facebook.com/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || body.error) throw httpError(400, body.error?.message || 'Facebook Graph API thất bại.');
  return body;
}

async function encryptToken(token, base64Key) {
  const key = await importEncryptionKey(base64Key, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decryptToken(payload, base64Key) {
  const [ivText, cipherText] = payload.split('.');
  const key = await importEncryptionKey(base64Key, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivText) }, key, fromBase64(cipherText)
  );
  return new TextDecoder().decode(decrypted);
}

function importEncryptionKey(base64Key, usages) {
  if (!base64Key) throw new Error('Thiếu TOKEN_ENCRYPTION_KEY.');
  return crypto.subtle.importKey('raw', fromBase64(base64Key), 'AES-GCM', false, usages);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left = '', right = '') {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function randomToken(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function requireFacebookConfig(env) {
  if (!env.FB_APP_ID || !env.FB_APP_SECRET || !env.CHROME_EXTENSION_ID || !env.TOKEN_ENCRYPTION_KEY) {
    throw httpError(503, 'Cloudflare Worker chưa cấu hình đủ Facebook/Extension secrets.');
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(body, status = 200) {
  return withCors(new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }));
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
