import type {
  ArtifactTemplateSummary,
  StoredArtifactTemplate,
} from '@/lib/registry/types';

export interface CopiedSlide {
  label: string;
  payload: Record<string, unknown>;
}

export interface ArtifactEditorAdapter {
  list: () => Promise<ArtifactTemplateSummary[]>;
  getOne: (id: string) => Promise<StoredArtifactTemplate>;
  create: (
    label: string,
    opts?: { baseType?: string; variableName?: string; annSetId?: number; id?: string }
  ) => Promise<{ id: string; label: string; updatedAt: string }>;
  save: (
    id: string,
    payload: Record<string, unknown>
  ) => Promise<{
    ok: boolean;
    status: number;
    data?: StoredArtifactTemplate;
    error?: string;
  }>;
  rename: (
    id: string,
    label: string,
    updatedAt: string
  ) => Promise<{
    ok: boolean;
    status: number;
    data?: StoredArtifactTemplate;
    error?: string;
  }>;
  delete: (
    id: string,
    updatedAt: string
  ) => Promise<{
    ok: boolean;
    status: number;
    templates?: ArtifactTemplateSummary[];
    error?: string;
  }>;
  reset: (
    id: string,
    updatedAt: string
  ) => Promise<{
    ok: boolean;
    status: number;
    data?: StoredArtifactTemplate;
    error?: string;
  }>;
  reorder: (
    items: { id: string; updatedAt: string }[]
  ) => Promise<{
    ok: boolean;
    status: number;
    templates?: ArtifactTemplateSummary[];
    error?: string;
  }>;
}

export const mainSpineAdapter: ArtifactEditorAdapter = {
  list: async () => {
    const res = await fetch('/api/admin/artifacts');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load templates');
    return (data.templates ?? []) as ArtifactTemplateSummary[];
  },
  getOne: async (id: string) => {
    const res = await fetch(`/api/admin/artifacts/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load template');
    return data as StoredArtifactTemplate;
  },
  create: async (
    label: string,
    opts?: { baseType?: string; variableName?: string; annSetId?: number; id?: string }
  ) => {
    const res = await fetch('/api/admin/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, ...opts }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add template');
    return data;
  },
  save: async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/artifacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.status === 409) {
      return { ok: false, status: 409, error: data.error };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error };
    }
    return { ok: true, status: res.status, data };
  },
  rename: async (id: string, label: string, updatedAt: string) => {
    const res = await fetch(`/api/admin/artifacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, updatedAt }),
    });
    const data = await res.json();
    if (res.status === 409) {
      return { ok: false, status: 409, error: data.error };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error };
    }
    return { ok: true, status: res.status, data };
  },
  delete: async (id: string, updatedAt: string) => {
    const res = await fetch(`/api/admin/artifacts/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt }),
    });
    const data = await res.json();
    if (res.status === 409 || res.status === 404) {
      return { ok: false, status: res.status, error: data.error };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error };
    }
    return { ok: true, status: res.status, templates: data.templates };
  },
  reset: async (id: string, updatedAt: string) => {
    const res = await fetch(`/api/admin/artifacts/${id}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt }),
    });
    const data = await res.json();
    if (res.status === 409) {
      return { ok: false, status: 409, error: data.error };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error };
    }
    return { ok: true, status: res.status, data };
  },
  reorder: async (items: { id: string; updatedAt: string }[]) => {
    const res = await fetch('/api/admin/artifacts/order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (res.status === 409) {
      return { ok: false, status: 409, error: data.error };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.error };
    }
    return { ok: true, status: res.status, templates: data.templates };
  },
};

export function createAnnouncementSetAdapter(
  setId: number,
  onListChange?: () => void
): ArtifactEditorAdapter {
  return {
    list: async () => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load slides');
      const slides = (data.slides ?? []) as Array<{
        id: number;
        annSetId: number;
        label: string;
        position: number;
        updatedAt: string;
        resettable?: boolean;
      }>;
      return slides.map((slide) => ({
        id: String(slide.id),
        label: slide.label,
        baseType: 'general' as const,
        updatedAt: slide.updatedAt,
        editable: true,
        resettable: Boolean(slide.resettable),
      }));
    },
    getOne: async (id: string) => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides/${id}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load slide');
      const slide = data.slide;
      const payload = (slide.payload ?? {}) as Record<string, unknown>;
      return {
        schemaVersion: 1,
        ...payload,
        id: String(slide.id),
        label: slide.label,
        baseType: 'general' as const,
        updatedAt: slide.updatedAt,
        placeholders: (payload.placeholders ?? []) as any,
        layouts: (payload.layouts ?? {
          default: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [],
          },
        }) as any,
      } as StoredArtifactTemplate;
    },
    create: async (label: string) => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create slide');
      onListChange?.();
      return {
        id: String(data.id),
        label: data.label,
        updatedAt: data.updatedAt,
      };
    },
    save: async (id: string, payload: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, status: 409, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      onListChange?.();
      const slide = data.slide;
      const outPayload = (slide.payload ?? {}) as Record<string, unknown>;
      const template: StoredArtifactTemplate = {
        schemaVersion: 1,
        ...outPayload,
        id: String(slide.id),
        label: slide.label,
        baseType: 'general' as const,
        updatedAt: slide.updatedAt,
        placeholders: (outPayload.placeholders ?? []) as any,
        layouts: (outPayload.layouts ?? {}) as any,
      };
      return { ok: true, status: res.status, data: template };
    },
    rename: async (id: string, label: string, updatedAt: string) => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, updatedAt }),
      });
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, status: 409, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      onListChange?.();
      return {
        ok: true,
        status: res.status,
        data: {
          schemaVersion: 1,
          id: String(data.id),
          label: data.label,
          baseType: 'general' as const,
          updatedAt: data.updatedAt,
          placeholders: [],
          layouts: {},
        } as StoredArtifactTemplate,
      };
    },
    delete: async (id: string, updatedAt: string) => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt }),
      });
      const data = await res.json();
      if (res.status === 409 || res.status === 404) {
        return { ok: false, status: res.status, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      onListChange?.();
      return { ok: true, status: res.status };
    },
    reset: async (id: string, updatedAt: string) => {
      const res = await fetch(
        `/api/admin/announcement-sets/${setId}/slides/${id}/reset`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updatedAt }),
        }
      );
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, status: 409, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      onListChange?.();
      const slideRes = await fetch(
        `/api/admin/announcement-sets/${setId}/slides/${id}`,
        { credentials: 'same-origin' }
      );
      const slideData = await slideRes.json();
      const slide = slideData.slide;
      const payload = (slide.payload ?? {}) as Record<string, unknown>;
      const template: StoredArtifactTemplate = {
        schemaVersion: 1,
        ...payload,
        id: String(slide.id),
        label: slide.label,
        baseType: 'general' as const,
        updatedAt: slide.updatedAt,
        placeholders: (payload.placeholders ?? []) as any,
        layouts: (payload.layouts ?? {}) as any,
      };
      return { ok: true, status: res.status, data: template };
    },
    reorder: async (items: { id: string; updatedAt: string }[]) => {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides/order`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((it) => ({ id: Number(it.id), updatedAt: it.updatedAt })),
        }),
      });
      const data = await res.json();
      if (res.status === 409 || res.status === 400) {
        return { ok: false, status: res.status, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      onListChange?.();
      const summaries: ArtifactTemplateSummary[] = (data.slides ?? []).map(
        (slide: any) => ({
          id: String(slide.id),
          label: slide.label,
          baseType: 'general' as const,
          updatedAt: slide.updatedAt,
          editable: true,
          resettable: Boolean(slide.resettable),
        })
      );
      return { ok: true, status: res.status, templates: summaries };
    },
  };
}

export function createSongSetTrioAdapter(): ArtifactEditorAdapter {
  const roles: Array<{ id: 'title' | 'verse' | 'reff'; label: string }> = [
    { id: 'title', label: 'Title Slide' },
    { id: 'verse', label: 'Verse Layout' },
    { id: 'reff', label: 'Refrain Layout' },
  ];

  return {
    list: async () => {
      const results = await Promise.all(
        roles.map(async ({ id, label }) => {
          try {
            const res = await fetch(`/api/admin/song-set-layouts/${id}`, {
              credentials: 'same-origin',
            });
            if (!res.ok) throw new Error('Failed to load layout');
            const data = (await res.json()) as {
              role: string;
              layout: Record<string, unknown>;
              updatedAt: string;
            };
            return {
              id,
              label,
              baseType: 'general' as const,
              updatedAt: data.updatedAt,
              editable: true,
              resettable: true,
            };
          } catch {
            return {
              id,
              label,
              baseType: 'general' as const,
              updatedAt: '',
              editable: true,
              resettable: true,
            };
          }
        })
      );
      return results;
    },
    getOne: async (id: string) => {
      const res = await fetch(`/api/admin/song-set-layouts/${id}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load layout');
      const layout = (data.layout ?? {}) as Record<string, unknown>;
      const roleLabel = roles.find((r) => r.id === id)?.label ?? id;

      return {
        schemaVersion: 1,
        id: data.role,
        label: roleLabel,
        baseType: 'general' as const,
        updatedAt: data.updatedAt,
        placeholders: [],
        layouts: {
          default: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [],
            ...layout,
          },
        },
      } as StoredArtifactTemplate;
    },
    create: async (_label: string) => {
      throw new Error('Song Set layout trio has fixed roles; creation is not supported');
    },
    save: async (id: string, payload: Record<string, unknown>) => {
      const layouts = (payload.layouts ?? {}) as Record<string, unknown>;
      const defaultLayout = (layouts.default ?? {}) as Record<string, unknown>;
      const updatedAt = payload.updatedAt as string;
      const cleanLayout = { ...defaultLayout };
      if (id === 'verse' || id === 'reff') {
        delete cleanLayout.backgroundImage;
      }

      const res = await fetch(`/api/admin/song-set-layouts/${id}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: cleanLayout,
          updatedAt,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, status: 409, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      const roleLabel = roles.find((r) => r.id === data.role)?.label ?? data.role;
      const returnedLayout = (data.layout ?? {}) as Record<string, unknown>;
      const template: StoredArtifactTemplate = {
        schemaVersion: 1,
        id: data.role,
        label: roleLabel,
        baseType: 'general' as const,
        updatedAt: data.updatedAt,
        placeholders: [],
        layouts: {
          default: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [],
            ...returnedLayout,
          },
        },
      };
      return { ok: true, status: res.status, data: template };
    },
    rename: async (_id: string, _label: string, _updatedAt: string) => {
      throw new Error('Song Set layout trio roles cannot be renamed');
    },
    delete: async (_id: string, _updatedAt: string) => {
      throw new Error('Song Set layout trio roles cannot be deleted');
    },
    reset: async (id: string, _updatedAt: string) => {
      const res = await fetch(`/api/admin/song-set-layouts/${id}/reset`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.status === 409) {
        return { ok: false, status: 409, error: data.error };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error };
      }
      const roleLabel = roles.find((r) => r.id === data.role)?.label ?? data.role;
      const returnedLayout = (data.layout ?? {}) as Record<string, unknown>;
      const template: StoredArtifactTemplate = {
        schemaVersion: 1,
        id: data.role,
        label: roleLabel,
        baseType: 'general' as const,
        updatedAt: data.updatedAt,
        placeholders: [],
        layouts: {
          default: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [],
            ...returnedLayout,
          },
        },
      };
      return { ok: true, status: res.status, data: template };
    },
    reorder: async (_items: { id: string; updatedAt: string }[]) => {
      throw new Error('Song Set layout trio roles cannot be reordered');
    },
  };
}

export async function uploadImageFile(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = (await res.json()) as { error?: string; url?: string };
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Failed to upload image');
  }
  return { url: data.url };
}

export async function fetchBackgroundLibrary(): Promise<Array<{ id: number; url: string; category?: string }>> {
  try {
    const res = await fetch('/api/admin/background-library', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = (await res.json()) as { images?: Array<{ id: number; url: string; category?: string }> };
    return data.images ?? [];
  } catch {
    return [];
  }
}

export interface MediaLibraryItem {
  id: number;
  url: string;
  name?: string;
  category?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchMediaLibrary(category?: string): Promise<MediaLibraryItem[]> {
  try {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await fetch(`/api/admin/media-library${query}`, { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = (await res.json()) as { images?: MediaLibraryItem[] };
    return data.images ?? [];
  } catch {
    return [];
  }
}

export async function fetchAvailableSongSets(): Promise<Array<{ variableName: string; title: string }>> {
  try {
    const res = await fetch('/api/admin/song-set-entries', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = (await res.json()) as { entries?: Array<{ variableName: string; title: string }> };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

export async function fetchAvailableAnnouncementSets(): Promise<Array<{ id: number; label: string }>> {
  try {
    const res = await fetch('/api/admin/announcement-sets', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const data = (await res.json()) as { sets?: Array<{ id: number; label: string }> };
    return data.sets ?? [];
  } catch {
    return [];
  }
}

