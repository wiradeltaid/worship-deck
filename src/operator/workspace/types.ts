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
