/**
 * SPEC-47-05: Bidirectional On-Demand Delta Sync Client
 */

export interface SyncPushPayload {
  client_device_id: string;
  mutation_id: string;
  base_rev?: number;
  mutations: {
    services?: Array<{
      global_id: string;
      date: string;
      raw_payload: string;
      parsed_data?: unknown;
      images_payload?: unknown;
      afternoon_program?: string;
      created_at?: string;
      updated_at?: string;
    }>;
    hymns?: Array<{
      global_id: string;
      book_code: string;
      number: number;
      title: string;
      lyrics: string;
    }>;
    song_set_entries?: Array<{
      global_id: string;
      variable_name: string;
      title: string;
      position: number;
      updated_at?: string;
      extraction_regex?: string;
    }>;
    background_library_images?: Array<{
      global_id: string;
      url: string;
      name: string;
      is_default?: boolean;
      category?: string;
      updated_at?: string;
    }>;
    announcement_items?: Array<{
      global_id: string;
      image_url: string;
      service_global_id?: string;
      service_id?: number;
      sort_order?: number;
      updated_at?: string;
    }>;
  };
  tombstones?: Array<{
    global_id: string;
    entity_type: string;
    deleted_at: string;
  }>;
}

export interface SyncPushResponse {
  ok: boolean;
  applied_count?: number;
  already_applied?: boolean;
  mutation_id?: string;
  timestamp?: string;
  error?: string;
  message?: string;
}

export interface SyncPullResponse {
  server_timestamp: string;
  cursor: string;
  changes: {
    services: Array<unknown>;
    hymns: Array<unknown>;
    song_set_entries: Array<unknown>;
    background_library_images: Array<unknown>;
    announcement_items: Array<unknown>;
  };
  tombstones: Array<{
    global_id: string;
    entity_type: string;
    deleted_at: string;
  }>;
}

export interface SyncStatusResponse {
  device_id?: string;
  last_synced_at?: string;
  total_tombstones?: number;
  presenter_active?: boolean;
}

export async function pushSync(
  baseUrl: string,
  payload: SyncPushPayload,
  headers: Record<string, string> = {}
): Promise<SyncPushResponse> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/sync/push`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as SyncPushResponse;
  if (!res.ok) {
    if (res.status === 409 && data.error === 'presenter_active') {
      throw new Error('Presenter actively projecting — sync paused until presentation completes');
    }
    const err = new Error(data.message || `Sync push failed with status ${res.status}`);
    (err as any).conflict = data;
    (err as any).status = res.status;
    throw err;
  }
  return data;
}

export async function pullSync(
  baseUrl: string,
  since = '',
  headers: Record<string, string> = {}
): Promise<SyncPullResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const url = `${baseUrl.replace(/\/+$/, '')}/api/sync/pull${query}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Sync pull failed with status ${res.status}`);
  }
  return (await res.json()) as SyncPullResponse;
}

export async function getSyncStatus(
  baseUrl: string,
  headers: Record<string, string> = {}
): Promise<SyncStatusResponse> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/sync/status`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Sync status failed with status ${res.status}`);
  }
  return (await res.json()) as SyncStatusResponse;
}

export interface SyncAssetsCheckResponse {
  missing: string[];
}

export interface SyncAssetUploadResponse {
  ok: boolean;
  sha256: string;
  url: string;
  filename: string;
}

export async function checkSyncAssets(
  baseUrl: string,
  hashes: string[],
  headers: Record<string, string> = {}
): Promise<SyncAssetsCheckResponse> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/sync/assets/check`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ hashes }),
  });
  if (!res.ok) {
    throw new Error(`Check sync assets failed with status ${res.status}`);
  }
  return (await res.json()) as SyncAssetsCheckResponse;
}

export async function uploadSyncAsset(
  baseUrl: string,
  fileBytes: Uint8Array | ArrayBuffer,
  sha256: string,
  filename = '',
  headers: Record<string, string> = {}
): Promise<SyncAssetUploadResponse> {
  const query = filename ? `?filename=${encodeURIComponent(filename)}` : '';
  const url = `${baseUrl.replace(/\/+$/, '')}/api/sync/assets/upload${query}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Content-SHA256': sha256,
      'Content-Type': 'application/octet-stream',
      ...headers,
    },
    body: fileBytes,
  });
  if (!res.ok) {
    throw new Error(`Upload sync asset failed with status ${res.status}`);
  }
  return (await res.json()) as SyncAssetUploadResponse;
}

export async function downloadSyncAsset(
  baseUrl: string,
  sha256: string,
  headers: Record<string, string> = {}
): Promise<ArrayBuffer> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/sync/assets/${encodeURIComponent(sha256)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Download sync asset failed with status ${res.status}`);
  }
  return await res.arrayBuffer();
}

