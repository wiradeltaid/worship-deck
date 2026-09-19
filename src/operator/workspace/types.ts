export type WorkspaceMode = 'instance' | 'master_preset';

export type PresetLifecycleStatus = 'draft' | 'published' | 'retired';

export interface MasterPreset {
  id: string;
  slug: string;
  title: string;
  description: string;
  defaultTime: string;
  status: PresetLifecycleStatus;
  activeServicesCount: number;
  isArchived?: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const SYNTHETIC_MASTER_PRESETS: MasterPreset[] = [
  {
    id: 'mp-1',
    slug: 'sabbath-morning',
    title: 'Ibadah Sabat Pagi (Dewasa)',
    description: 'Rundown lengkap kebaktian sabat umum dengan warta, lagu pujian, dan khotbah.',
    defaultTime: '09:00 WIB',
    status: 'published',
    activeServicesCount: 14,
    version: 3,
    createdAt: '2026-01-10',
    updatedAt: '2026-09-15',
  },
  {
    id: 'mp-2',
    slug: 'vesper-friday',
    title: 'Ibadah Vesper Jumat',
    description: 'Ibadah pembuka hari sabat dengan fokus pada pujian dan renungan santai.',
    defaultTime: '19:30 WIB',
    status: 'published',
    activeServicesCount: 8,
    version: 2,
    createdAt: '2026-02-01',
    updatedAt: '2026-08-20',
  },
  {
    id: 'mp-3',
    slug: 'prayer-wednesday',
    title: 'Ibadah Doa Rabu Malam',
    description: 'Pertemuan doa tengah pekan jemaat dengan pokok-pokok syafaat.',
    defaultTime: '19:00 WIB',
    status: 'published',
    activeServicesCount: 6,
    version: 1,
    createdAt: '2026-03-05',
    updatedAt: '2026-07-12',
  },
  {
    id: 'mp-4',
    slug: 'youth-service',
    title: 'Kebaktian Pemuda / Youth Sabbath',
    description: 'Liturgi kontemporer pemuda dengan sesi kesaksian dan pujian interaktif.',
    defaultTime: '14:00 WIB',
    status: 'draft',
    activeServicesCount: 0,
    version: 1,
    createdAt: '2026-09-18',
    updatedAt: '2026-09-20',
  },
  {
    id: 'mp-5',
    slug: 'communion-special',
    title: 'Upacara Perjamuan Kudus Triwulanan',
    description: 'Tata ibadah sakramen pembasuhan kaki dan perjamuan kudus.',
    defaultTime: '09:30 WIB',
    status: 'retired',
    activeServicesCount: 0,
    isArchived: true,
    version: 4,
    createdAt: '2025-10-01',
    updatedAt: '2026-06-30',
  },
];

export interface ScheduledServiceRecord {
  id: string;
  presetId: string;
  presetLabel: string;
  serviceDate: string;
  serviceTitle: string;
  status: WorkspaceStatus;
  itemsCount: number;
  scheduleRevision: number;
  updatedAt: string;
  items?: TimelineItem[];
}

export function isValidPresetTransition(
  from: PresetLifecycleStatus,
  to: PresetLifecycleStatus
): boolean {
  if (from === to) return true;
  if (from === 'draft' && (to === 'published' || to === 'retired')) return true;
  if (from === 'published' && to === 'retired') return true;
  return false;
}

export function isValidTokenKey(rawKey: string): {
  valid: boolean;
  normalizedKey: string;
  reason?: string;
} {
  const trimmed = rawKey.trim().toLowerCase();
  if (!trimmed) {
    return {
      valid: false,
      normalizedKey: '',
      reason: 'Kunci token tidak boleh kosong',
    };
  }
  if (/^[0-9_]/.test(trimmed)) {
    return {
      valid: false,
      normalizedKey: trimmed,
      reason: 'Kunci token harus diawali huruf kecil a-z',
    };
  }

  const normalized = trimmed
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return {
      valid: false,
      normalizedKey: '',
      reason: 'Kunci token tidak boleh kosong setelah normalisasi',
    };
  }
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return {
      valid: false,
      normalizedKey: normalized,
      reason:
        'Kunci token harus diawali huruf kecil a-z dan hanya memuat karakter a-z, 0-9, atau _',
    };
  }
  return { valid: true, normalizedKey: normalized };
}

export function computePresetActiveServicesCount(
  presetSlugOrId: string,
  services: ScheduledServiceRecord[]
): number {
  return services.filter(
    (s) => s.presetId === presetSlugOrId
  ).length;
}

export interface CustomSlideType {
  id: string;
  title: string;
  category: string;
  canvasStyle: CanvasCustomStyle;
  createdAt: string;
}

export const SYNTHETIC_SCHEDULED_SERVICES: ScheduledServiceRecord[] = [
  {
    id: 'srv-20260919',
    presetId: 'sabbath-morning',
    presetLabel: 'Ibadah Sabat Pagi (Dewasa)',
    serviceDate: '2026-09-19',
    serviceTitle: 'Kebaktian Sabat — Kasih yang Mengubahkan',
    status: 'ready',
    itemsCount: 8,
    scheduleRevision: 4,
    updatedAt: '2026-09-19 08:30 WIB',
  },
  {
    id: 'srv-20260912',
    presetId: 'sabbath-morning',
    presetLabel: 'Ibadah Sabat Pagi (Dewasa)',
    serviceDate: '2026-09-12',
    serviceTitle: 'Kebaktian Sabat — Pengharapan yang Teguh',
    status: 'ready',
    itemsCount: 8,
    scheduleRevision: 2,
    updatedAt: '2026-09-12 08:45 WIB',
  },
  {
    id: 'srv-20260918',
    presetId: 'vesper-friday',
    presetLabel: 'Ibadah Vesper Jumat',
    serviceDate: '2026-09-18',
    serviceTitle: 'Vesper Pembuka Sabat — Berjalan dalam Terang',
    status: 'ready',
    itemsCount: 6,
    scheduleRevision: 1,
    updatedAt: '2026-09-18 19:15 WIB',
  },
  {
    id: 'srv-20260916',
    presetId: 'prayer-wednesday',
    presetLabel: 'Ibadah Doa Rabu Malam',
    serviceDate: '2026-09-16',
    serviceTitle: 'Persekutuan Doa Syafaat Jemaat',
    status: 'ready',
    itemsCount: 5,
    scheduleRevision: 1,
    updatedAt: '2026-09-16 18:50 WIB',
  },
];

export type WorshipPreset =
  | 'sabbath-morning'
  | 'vesper-friday'
  | 'prayer-wednesday'
  | 'special-service'
  | 'custom-non-preset';

export interface PresetOption {
  id: WorshipPreset;
  label: string;
  defaultTime: string;
  description: string;
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'sabbath-morning',
    label: 'Ibadah Sabat Pagi (Dewasa)',
    defaultTime: '09:00 WIB',
    description: 'Rundown lengkap kebaktian sabat umum dengan warta, lagu pujian, dan khotbah.',
  },
  {
    id: 'vesper-friday',
    label: 'Ibadah Vesper Jumat',
    defaultTime: '19:30 WIB',
    description: 'Ibadah pembuka hari sabat dengan fokus pada pujian dan renungan santai.',
  },
  {
    id: 'prayer-wednesday',
    label: 'Ibadah Doa Rabu Malam',
    defaultTime: '19:00 WIB',
    description: 'Pertemuan doa tengah pekan jemaat dengan pokok-pokok syafaat.',
  },
  {
    id: 'special-service',
    label: 'Kebaktian Khusus / Natal',
    defaultTime: '09:30 WIB',
    description: 'Acara istimewa, perjamuan kudus, baptisan, atau perayaan hari besar.',
  },
  {
    id: 'custom-non-preset',
    label: 'Jadwal Bebas (Non-Preset)',
    defaultTime: '10:00 WIB',
    description: 'Struktur jadwal bebas tanpa template bawaan, susun urutan dari nol.',
  },
];

export type TimelineItemType =
  | 'song'
  | 'scripture'
  | 'announcement'
  | 'sermon'
  | 'general'
  | 'custom_slide';

export interface FlyerSlot {
  id: string;
  title: string;
  url: string;
  category: string;
}

export interface CustomSlideData {
  title: string;
  content: string;
  subtitle?: string;
  backgroundUrl?: string;
  style?: {
    alignment: 'left' | 'center' | 'right';
    fontSize: number;
    color: string;
  };
}

export interface CanvasCustomStyle {
  alignX?: 'left' | 'center' | 'right';
  alignY?: 'top' | 'middle' | 'bottom';
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  backgroundUrl?: string;
}

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  subtitle?: string;
  duration?: string;
  slidesCount: number;
  canvasStyle?: CanvasCustomStyle;
  songData?: {
    hymnNumber?: number;
    bookCode?: string;
    key?: string;
    activeVerses?: number[];
    backgroundUrl?: string;
  };
  announcementData?: {
    flyers: FlyerSlot[];
    looping: boolean;
  };
  sermonData?: {
    speaker: string;
    title: string;
    scriptureRef: string;
  };
  generalData?: {
    speaker?: string;
    notes?: string;
    backgroundUrl?: string;
  };
  customSlideData?: CustomSlideData;
}

export type WorkspaceStatus = 'draft' | 'ready' | 'live';

export interface RosterPerson {
  id: string;
  name: string;
  role: string;
  assigned: boolean;
}

export const SYNTHETIC_ROSTER_SEED: RosterPerson[] = [
  {
    id: 'r1',
    name: 'Pdt. Yohanes Timotius (Sintetis)',
    role: 'Pengkhotbah',
    assigned: true,
  },
  {
    id: 'r2',
    name: 'Diaken Natanael Markus (Sintetis)',
    role: 'Pemimpin Acara / Liturgis',
    assigned: false,
  },
  {
    id: 'r3',
    name: 'Sdr. Barnabas Lukas (Sintetis)',
    role: 'Pemimpin Pujian',
    assigned: false,
  },
  {
    id: 'r4',
    name: 'Sdri. Maria Marta (Sintetis)',
    role: 'Pembaca Alkitab',
    assigned: false,
  },
  {
    id: 'r5',
    name: 'Penatua Simon Petrus (Sintetis)',
    role: 'Doa Penutup',
    assigned: false,
  },
];

export interface MediaAsset {
  id: string;
  title: string;
  url: string;
  category: 'background' | 'cross' | 'nature' | 'texture';
  dimensions: string;
}

export const SYNTHETIC_MEDIA_CATALOG: MediaAsset[] = [
  {
    id: 'm1',
    title: 'Deep Navy Worship Gradient',
    url: '/assets/background-navy.jpg',
    category: 'background',
    dimensions: '1920x1080 (16:9)',
  },
  {
    id: 'm2',
    title: 'Sanctuary Church Altar',
    url: '/assets/background-sanctuary.jpg',
    category: 'background',
    dimensions: '1920x1080 (16:9)',
  },
  {
    id: 'm3',
    title: 'Minimalist Wooden Cross',
    url: '/assets/background-cross.jpg',
    category: 'cross',
    dimensions: '1920x1080 (16:9)',
  },
  {
    id: 'm4',
    title: 'Sunrise Over Mountain Nature',
    url: '/assets/background-nature.jpg',
    category: 'nature',
    dimensions: '1920x1080 (16:9)',
  },
  {
    id: 'm5',
    title: 'Warm Candlelight Glow',
    url: '/assets/background-candle.jpg',
    category: 'texture',
    dimensions: '1920x1080 (16:9)',
  },
  {
    id: 'm6',
    title: 'Majestic Evening Sky Gradient',
    url: '/assets/background-sky.jpg',
    category: 'nature',
    dimensions: '1920x1080 (16:9)',
  },
];
