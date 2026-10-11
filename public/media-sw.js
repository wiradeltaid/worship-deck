/**
 * WorshipDeck Service Worker Virtual Streamer (SPEC-111-05)
 *
 * Intercepts same-origin requests strictly matching `/local-media/:sha256`.
 * Passes all other requests directly to the network.
 * Provides HTTP 206 Partial Content byte-range streaming from IndexedDB/OPFS.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strict namespace filter: only intercept same-origin /local-media/
  if (url.origin === self.location.origin && url.pathname.startsWith('/local-media/')) {
    event.respondWith(handleLocalMediaStream(event.request, url));
  }
});

async function handleLocalMediaStream(request, url) {
  const sha256 = url.pathname.replace('/local-media/', '').split('/')[0].toLowerCase();
  if (!sha256 || sha256.length !== 64) {
    return new Response('Invalid media SHA-256 identifier', { status: 400 });
  }

  // 1. Resolve file from IndexedDB
  const record = await getIndexedDBRecord(sha256);
  let file = null;

  if (record) {
    if (record.fileHandle && typeof record.fileHandle.getFile === 'function') {
      try {
        file = await record.fileHandle.getFile();
      } catch (err) {
        // Handle might require user re-affirmation
      }
    } else if (record.blob) {
      file = record.blob;
    }
  }

  // 2. Fallback: Request via MessageChannel from active presenter client window
  if (!file) {
    file = await requestFileFromClients(sha256);
  }

  if (!file) {
    return new Response('Local media file not found or permission expired', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const fileSize = file.size;
  const mimeType = record?.mimeType || file.type || 'video/mp4';
  const rangeHeader = request.headers.get('Range');

  if (!rangeHeader) {
    return new Response(file, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    });
  }

  // Parse Range header: bytes=start-end
  const range = parseRange(rangeHeader, fileSize);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
        'Content-Type': mimeType,
      },
    });
  }

  if (!range) {
    // Malformed range: return entire file
    return new Response(file, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType,
      },
    });
  }

  const slice = file.slice(range.start, range.end);
  const contentLength = range.end - range.start;

  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Range': `bytes ${range.start}-${range.end - 1}/${fileSize}`,
      'Content-Length': String(contentLength),
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache, must-revalidate',
    },
  });
}

function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;
  const parts = rangeHeader.replace('bytes=', '').trim().split('-');
  if (parts.length !== 2) return null;

  let start = parts[0] === '' ? null : parseInt(parts[0], 10);
  let end = parts[1] === '' ? null : parseInt(parts[1], 10);

  if (start === null && end === null) return null;

  if (start === null) {
    // Suffix range: bytes=-500 (last 500 bytes)
    const suffix = end;
    if (isNaN(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize;
  } else if (end === null) {
    // Open-ended range: bytes=500- (from 500 to end)
    if (isNaN(start) || start < 0) return null;
    if (start >= totalSize) return 'unsatisfiable';
    end = totalSize;
  } else {
    // Closed range: bytes=0-499
    if (isNaN(start) || isNaN(end) || start < 0 || end < start) return null;
    if (start >= totalSize) return 'unsatisfiable';
    end = Math.min(end + 1, totalSize);
  }

  return { start, end };
}

async function getIndexedDBRecord(sha256) {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('worship-deck-media', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('media-index')) {
          return resolve(null);
        }
        const tx = db.transaction('media-index', 'readonly');
        const getReq = tx.objectStore('media-index').get(sha256.toLowerCase());
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function requestFileFromClients(sha256) {
  if (!self.clients) return null;
  try {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!clientList || clientList.length === 0) return null;

    for (const client of clientList) {
      const file = await new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(null), 1000);
        channel.port1.onmessage = (e) => {
          clearTimeout(timeout);
          if (e.data && e.data.blob) {
            resolve(e.data.blob);
          } else {
            resolve(null);
          }
        };
        client.postMessage(
          { type: 'LOCAL_MEDIA_STREAM_REQUEST', sha256 },
          [channel.port2]
        );
      });
      if (file) return file;
    }
  } catch {
    return null;
  }
  return null;
}
