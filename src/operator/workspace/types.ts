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

export type TimelineItemType = 'song' | 'scripture' | 'announcement' | 'sermon' | 'general';

export interface FlyerSlot {
  id: string;
  title: string;
  url: string;
  category: string;
}

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  subtitle?: string;
  duration?: string;
  slidesCount: number;
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
}

export type WorkspaceStatus = 'draft' | 'ready' | 'live';
