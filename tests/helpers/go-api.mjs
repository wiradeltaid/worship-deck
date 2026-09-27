/**
 * Spawn the Go API for Node tests. Shared so each HTTP suite does not copy
 * Windows teardown and the readiness poll.
 */
import { spawn, execFileSync } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function fetchRaw(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...(opts.headers || {}) };
    const body = opts.body;
    if (body != null && headers['Content-Length'] == null && headers['content-length'] == null) {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      headers['Content-Length'] = String(buf.length);
    }
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function json(url, method = 'GET', payload, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  let body;
  if (payload !== undefined) {
    body = JSON.stringify(payload);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const res = await fetchRaw(url, { method, headers, body });
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = res.body;
  }
  return { status: res.status, headers: res.headers, body: parsed, raw: res.body };
}

export function parseCookie(setCookie) {
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) return '';
  return raw.split(';')[0];
}

export function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

export function stopProcess(proc) {
  if (!proc || proc.pid == null) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } catch {
      /* already gone */
    }
    return;
  }

  const pid = proc.pid;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch (err) {
    if (err.code !== 'ESRCH') throw err;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (err) {
    if (err.code !== 'ESRCH') throw err;
  }
  // No synchronous verification: a zombie satisfies kill(pid, 0), and a blocking wait prevents the reap it waits for.
}

export async function spawnGoApi({
  dbPath,
  env = {},
  root = repoRoot,
  attempts = 80,
} = {}) {
  const port = await reservePort();
  const output = [];
  const child = spawn('go', ['run', './cmd/api'], {
    cwd: root,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      REPO_ROOT: root,
      NODE_ENV: 'test',
      WPW_USE_SHIPPED_REGISTRY: '1',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (c) => output.push(c.toString()));
  child.stderr.on('data', (c) => output.push(c.toString()));
  const base = `http://127.0.0.1:${port}`;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchRaw(`${base}/login`);
      if (res.status && res.status < 500) {
        return { child, base, output, port };
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopProcess(child);
  throw new Error(`Go API did not become ready: ${lastErr}\n${output.join('')}`);
}
