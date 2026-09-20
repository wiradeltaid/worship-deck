import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Music,
  Megaphone,
  Tag,
  Plus,
  CheckCircle2,
  Copy,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isValidTokenKey, canDeleteMasterSongSet, isSystemPredefinedToken } from './types';
import { toast } from 'sonner';

export interface MasterSongSetItem {
  id: string;
  title: string;
  bookCode: string;
  hymnNumber: number;
  key: string;
  activeVerses: number[];
}

export interface MasterSongSet {
  id: string;
  title: string;
  description: string;
  songs: MasterSongSetItem[];
  usageCount: number;
}

export interface MasterAnnouncementSet {
  id: string;
  title: string;
  flyersCount: number;
  looping: boolean;
  flyers: { id: string; title: string; url: string; category: string }[];
  updatedAt: string;
}

export interface PredefinedToken {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'multiline' | 'person' | 'scripture' | 'date';
  description: string;
  isSystem: boolean;
}

export const SYNTHETIC_MASTER_SONG_SETS: MasterSongSet[] = [
  {
    id: 'mss-1',
    title: 'Set Pujian Pembuka Sabat — Kemuliaan Bagi Allah',
    description: 'Koleksi 3 lagu pembuka sabat bertema puji-pujian dan pengagungan.',
    usageCount: 12,
    songs: [
      { id: 's1', title: 'Hai Pujilah Tuhan', bookCode: 'SDAH', hymnNumber: 123, key: 'D', activeVerses: [1, 2, 4] },
      { id: 's2', title: 'Besar Setia-Mu', bookCode: 'SDAH', hymnNumber: 100, key: 'Eb', activeVerses: [1, 2, 3] },
      { id: 's3', title: 'Sucilah, Sucilah, Suci', bookCode: 'SDAH', hymnNumber: 73, key: 'E', activeVerses: [1, 4] },
    ],
  },
  {
    id: 'mss-2',
    title: 'Set Lagu Firman & Penyerahan Diri',
    description: 'Lagu meditatif sebelum dan sesudah firman Tuhan disampaikan.',
    usageCount: 8,
    songs: [
      { id: 's4', title: 'Bicara Tuhan', bookCode: 'SDAH', hymnNumber: 250, key: 'F', activeVerses: [1, 2] },
      { id: 's5', title: 'Kuserahkan Hidupku', bookCode: 'SDAH', hymnNumber: 309, key: 'G', activeVerses: [1, 2, 3] },
    ],
  },
  {
    id: 'mss-3',
    title: 'Set Pujian Vesper Senja Sabat',
    description: 'Pujian lembut dan reflektif menyambut hari peristirahatan kudus.',
    usageCount: 5,
    songs: [
      { id: 's6', title: 'Hari Sabat yang Kudus', bookCode: 'SDAH', hymnNumber: 388, key: 'C', activeVerses: [1, 2, 3] },
      { id: 's7', title: 'Tinggal Besertaku', bookCode: 'SDAH', hymnNumber: 50, key: 'Eb', activeVerses: [1, 3] },
    ],
  },
];

export const SYNTHETIC_MASTER_ANNOUNCEMENT_SETS: MasterAnnouncementSet[] = [
  {
    id: 'mas-1',
    title: 'Warta Pelayanan Jemaat & Kesehatan Triwulan III',
    flyersCount: 4,
    looping: true,
    updatedAt: '2026-09-18',
    flyers: [
      { id: 'f1', title: 'Seminar Kesehatan & Nutrisi Nabati', url: '/assets/flyer1.jpg', category: 'announcement' },
      { id: 'f2', title: 'Perkemahan Pemuda Advent 2026', url: '/assets/flyer2.jpg', category: 'announcement' },
      { id: 'f3', title: 'Jadwal Pendalaman Alkitab Rumah Tangga', url: '/assets/flyer3.jpg', category: 'announcement' },
      { id: 'f4', title: 'Perjamuan Kudus Triwulan III', url: '/assets/flyer4.jpg', category: 'announcement' },
    ],
  },
  {
    id: 'mas-2',
    title: 'Program Khusus Pekan Doa Rumah Tangga',
    flyersCount: 2,
    looping: true,
    updatedAt: '2026-09-10',
    flyers: [
      { id: 'f5', title: 'Pekan Doa: Memulihkan Mezbah Keluarga', url: '/assets/flyer1.jpg', category: 'announcement' },
      { id: 'f6', title: 'Malam Persekutuan Doa Syafaat', url: '/assets/flyer2.jpg', category: 'announcement' },
    ],
  },
];

export const SYNTHETIC_PREDEFINED_TOKENS: PredefinedToken[] = [
  {
    id: 'tok-1',
    key: 'sermon_speaker',
    label: 'Nama Pengkhotbah',
    type: 'person',
    description: 'Nama pendeta atau penatua yang membawakan firman.',
    isSystem: true,
  },
  {
    id: 'tok-2',
    key: 'sermon_title',
    label: 'Judul Khotbah',
    type: 'text',
    description: 'Tema utama khotbah ibadah.',
    isSystem: true,
  },
  {
    id: 'tok-3',
    key: 'scripture_reference',
    label: 'Nats Bacaan Alkitab',
    type: 'scripture',
    description: 'Ayat firman Tuhan yang menjadi rujukan pembacaan.',
    isSystem: true,
  },
  {
    id: 'tok-4',
    key: 'worship_leader',
    label: 'Pemimpin Acara / Liturgis',
    type: 'person',
    description: 'Petugas yang memandu liturgi ibadah.',
    isSystem: true,
  },
  {
    id: 'tok-5',
    key: 'church_announcement_date',
    label: 'Tanggal Warta Jemaat',
    type: 'date',
    description: 'Periode penanggalan lembar warta mingguan.',
    isSystem: true,
  },
];

interface MockupMasterLibrariesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'song_sets' | 'announcements' | 'tokens';
  songSets?: MasterSongSet[];
  onUpdateSongSets?: (songSets: MasterSongSet[]) => void;
  announcementSets?: MasterAnnouncementSet[];
  onUpdateAnnouncementSets?: (announcementSets: MasterAnnouncementSet[]) => void;
  tokens?: PredefinedToken[];
  onUpdateTokens?: (tokens: PredefinedToken[]) => void;
  onSelectSongSet?: (songSet: MasterSongSet) => void;
  onSelectAnnouncementSet?: (announcementSet: MasterAnnouncementSet) => void;
}

export default function MockupMasterLibrariesDrawer({
  isOpen,
  onClose,
  defaultTab = 'song_sets',
  songSets: externalSongSets,
  onUpdateSongSets,
  announcementSets: externalAnnouncementSets,
  onUpdateAnnouncementSets,
  tokens: externalTokens,
  onUpdateTokens,
  onSelectSongSet,
  onSelectAnnouncementSet,
}: MockupMasterLibrariesDrawerProps) {
  const [activeTab, setActiveTab] = useState<'song_sets' | 'announcements' | 'tokens'>(defaultTab);

  // Synchronize activeTab whenever defaultTab or isOpen changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  // Master Song Sets State
  const [internalSongSets, setInternalSongSets] = useState<MasterSongSet[]>(
    SYNTHETIC_MASTER_SONG_SETS
  );
  const songSets = externalSongSets || internalSongSets;
  const updateSongSets = onUpdateSongSets || setInternalSongSets;
  const [songSearchQuery, setSongSearchQuery] = useState('');

  // Master Announcement Sets State
  const [internalAnnouncementSets, setInternalAnnouncementSets] = useState<MasterAnnouncementSet[]>(
    SYNTHETIC_MASTER_ANNOUNCEMENT_SETS
  );
  const announcementSets = externalAnnouncementSets || internalAnnouncementSets;
  const updateAnnouncementSets = onUpdateAnnouncementSets || setInternalAnnouncementSets;

  // Predefined Tokens State
  const [internalTokens, setInternalTokens] = useState<PredefinedToken[]>(
    SYNTHETIC_PREDEFINED_TOKENS
  );
  const tokens = externalTokens || internalTokens;
  const updateTokens = onUpdateTokens || setInternalTokens;

  const [isAddTokenOpen, setIsAddTokenOpen] = useState(false);
  const [newTokenKey, setNewTokenKey] = useState('');
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [newTokenType, setNewTokenType] = useState<PredefinedToken['type']>('text');
  const [newTokenDesc, setNewTokenDesc] = useState('');

  // In-Drawer CRUD state for Master Song Sets
  const [isAddSongSetOpen, setIsAddSongSetOpen] = useState(false);
  const [newSongSetTitle, setNewSongSetTitle] = useState('');
  const [newSongSetDesc, setNewSongSetDesc] = useState('');
  const [editingSongSetId, setEditingSongSetId] = useState<string | null>(null);
  const [editSongSetTitle, setEditSongSetTitle] = useState('');
  const [editSongSetDesc, setEditSongSetDesc] = useState('');

  // In-Drawer CRUD state for Master Announcements
  const [isAddAnnouncementOpen, setIsAddAnnouncementOpen] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementLooping, setNewAnnouncementLooping] = useState(true);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editAnnouncementTitle, setEditAnnouncementTitle] = useState('');
  const [editAnnouncementLooping, setEditAnnouncementLooping] = useState(true);

  // In-Drawer edit token state
  const [editingTokenKey, setEditingTokenKey] = useState<string | null>(null);
  const [editTokenLabel, setEditTokenLabel] = useState('');
  const [editTokenDesc, setEditTokenDesc] = useState('');

  if (!isOpen) return null;

  const filteredSongSets = songSets.filter(
    (ss) =>
      ss.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
      ss.songs.some(
        (s) =>
          s.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
          String(s.hymnNumber).includes(songSearchQuery)
      )
  );

  const handleAddToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenKey.trim() || !newTokenLabel.trim()) {
      toast.error('Kunci token dan label wajib diisi');
      return;
    }

    const validation = isValidTokenKey(newTokenKey);
    if (!validation.valid) {
      toast.error(validation.reason || 'Kunci token tidak valid');
      return;
    }

    const cleanKey = validation.normalizedKey;
    if (tokens.some((t) => t.key === cleanKey)) {
      toast.error(`Token {${cleanKey}} sudah terdaftar.`);
      return;
    }

    const created: PredefinedToken = {
      id: `tok-${Date.now()}`,
      key: cleanKey,
      label: newTokenLabel.trim(),
      type: newTokenType,
      description: newTokenDesc.trim() || 'Token variabel kustom jemaat.',
      isSystem: false,
    };

    updateTokens([...tokens, created]);
    setIsAddTokenOpen(false);
    setNewTokenKey('');
    setNewTokenLabel('');
    setNewTokenDesc('');
    toast.success(`Token {${created.key}} berhasil didaftarkan ke kamus global.`);
  };

  const handleCreateSongSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongSetTitle.trim()) {
      toast.error('Judul Song Set wajib diisi');
      return;
    }
    const created: MasterSongSet = {
      id: `mss-${Date.now()}`,
      title: newSongSetTitle.trim(),
      description: newSongSetDesc.trim() || 'Koleksi lagu ibadah baru.',
      usageCount: 0,
      songs: [
        { id: `s-${Date.now()}-1`, title: 'Hai Pujilah Tuhan', bookCode: 'SDAH', hymnNumber: 123, key: 'D', activeVerses: [1, 2] },
        { id: `s-${Date.now()}-2`, title: 'Besar Setia-Mu', bookCode: 'SDAH', hymnNumber: 100, key: 'Eb', activeVerses: [1, 3] },
      ],
    };
    updateSongSets([created, ...songSets]);
    setIsAddSongSetOpen(false);
    setNewSongSetTitle('');
    setNewSongSetDesc('');
    toast.success(`Master Song Set "${created.title}" berhasil dibuat.`);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementTitle.trim()) {
      toast.error('Judul Warta Jemaat wajib diisi');
      return;
    }
    const created: MasterAnnouncementSet = {
      id: `mas-${Date.now()}`,
      title: newAnnouncementTitle.trim(),
      flyersCount: 2,
      looping: newAnnouncementLooping,
      flyers: [
        { id: `fl-${Date.now()}-1`, title: 'Warta Pelayanan Jemaat', url: '/assets/flyer-sample.jpg', category: 'ministry' },
        { id: `fl-${Date.now()}-2`, title: 'Jadwal Kebaktian Khusus', url: '/assets/flyer-sample-2.jpg', category: 'event' },
      ],
      updatedAt: 'Baru saja',
    };
    updateAnnouncementSets([created, ...announcementSets]);
    setIsAddAnnouncementOpen(false);
    setNewAnnouncementTitle('');
    setNewAnnouncementLooping(true);
    toast.success(`Master Warta "${created.title}" berhasil dibuat.`);
  };

  return (
    <div
      data-testid="master-libraries-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
    >
      <div className="w-full max-w-3xl 2xl:max-w-4xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Koleksi Master & Kamus Variabel (Predefined Fields)
              </h2>
              <p className="text-xs text-muted-foreground">
                Pustaka data reusable yang dapat digunakan berulang kali di berbagai jadwal tanpa duplikasi manual.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="p-3 border-b border-border bg-background/50 flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === 'song_sets' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('song_sets')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="tab-master-song-sets"
          >
            <Music className="w-3.5 h-3.5" />
            <span>Master Song Sets</span>
          </Button>

          <Button
            type="button"
            variant={activeTab === 'announcements' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('announcements')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="tab-master-announcements"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Master Warta</span>
          </Button>

          <Button
            type="button"
            variant={activeTab === 'tokens' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('tokens')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="tab-predefined-fields"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Predefined Fields & Tokens</span>
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: MASTER SONG SETS */}
          {activeTab === 'song_sets' && (
            <div className="space-y-3" data-testid="master-song-sets-panel">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                  <Input
                    type="text"
                    placeholder="Cari judul set, nama lagu, atau nomor SDAH..."
                    value={songSearchQuery}
                    onChange={(e) => setSongSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs"
                    data-testid="song-set-search-input"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5 shrink-0"
                  onClick={() => setIsAddSongSetOpen(true)}
                  data-testid="add-master-song-set-button"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Song Set Baru</span>
                </Button>
              </div>

              {/* Add Song Set Inline Form */}
              {isAddSongSetOpen && (
                <form
                  onSubmit={handleCreateSongSet}
                  className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in"
                  data-testid="add-master-song-set-form"
                >
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-primary" />
                    <span>Buat Master Song Set Baru</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Judul Song Set</Label>
                      <Input
                        value={newSongSetTitle}
                        onChange={(e) => setNewSongSetTitle(e.target.value)}
                        placeholder="Contoh: Set Pujian Pembuka Sabat"
                        className="h-7 text-xs"
                        data-testid="new-master-song-set-title-input"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Keterangan / Tema</Label>
                      <Input
                        value={newSongSetDesc}
                        onChange={(e) => setNewSongSetDesc(e.target.value)}
                        placeholder="Tema atau deskripsi penggunaan..."
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setIsAddSongSetOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" size="sm" className="h-6 text-xs font-semibold">
                      Simpan Song Set
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-3 pt-1">
                {filteredSongSets.map((ss) => (
                  <div
                    key={ss.id}
                    className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs space-y-2.5"
                    data-testid={`master-song-set-card-${ss.id}`}
                  >
                    {editingSongSetId === ss.id ? (
                      <div className="p-3 bg-muted/40 rounded-xl border border-border/80 space-y-2.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground">Judul Song Set</Label>
                          <Input
                            value={editSongSetTitle}
                            onChange={(e) => setEditSongSetTitle(e.target.value)}
                            className="h-7 text-xs"
                            data-testid={`edit-song-set-title-input-${ss.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground">Keterangan</Label>
                          <Input
                            value={editSongSetDesc}
                            onChange={(e) => setEditSongSetDesc(e.target.value)}
                            className="h-7 text-xs"
                            data-testid={`edit-song-set-desc-input-${ss.id}`}
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setEditingSongSetId(null)}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 text-xs font-semibold"
                            onClick={() => {
                              updateSongSets(
                                songSets.map((s) =>
                                  s.id === ss.id
                                    ? { ...s, title: editSongSetTitle.trim() || s.title, description: editSongSetDesc.trim() || s.description }
                                    : s
                                )
                              );
                              setEditingSongSetId(null);
                              toast.success(`Master Song Set "${editSongSetTitle.trim() || ss.title}" berhasil diperbarui.`);
                            }}
                            data-testid={`save-master-song-set-${ss.id}`}
                          >
                            Simpan Perubahan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-foreground">
                            {ss.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {ss.description}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono pt-1">
                            <span>{ss.songs.length} Lagu</span>
                            <span>•</span>
                            <span>Dipakai {ss.usageCount} kali di jadwal</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold gap-1"
                            onClick={() => {
                              setEditingSongSetId(ss.id);
                              setEditSongSetTitle(ss.title);
                              setEditSongSetDesc(ss.description);
                            }}
                            data-testid={`edit-master-song-set-${ss.id}`}
                          >
                            <span>Ubah</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-semibold text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const check = canDeleteMasterSongSet(ss.id);
                              if (!check.allowed) {
                                toast.error(check.reason || 'Tidak dapat menghapus Master Song Set yang masih digunakan oleh Master Preset!');
                                return;
                              }
                              updateSongSets(songSets.filter((x) => x.id !== ss.id));
                              toast.success(`Master Song Set "${ss.title}" berhasil dihapus.`);
                            }}
                            data-testid={`delete-master-song-set-${ss.id}`}
                          >
                            <span>Hapus</span>
                          </Button>
                          {onSelectSongSet && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs font-semibold gap-1 shrink-0"
                              onClick={() => {
                                onSelectSongSet(ss);
                                onClose();
                                toast.success(`Song set "${ss.title}" diterapkan ke timeline.`);
                              }}
                              data-testid="select-master-song-set-button"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Pilih Set Ini</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Song Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ss.songs.map((song, idx) => (
                        <span
                          key={song.id}
                          className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 text-[11px] font-medium text-foreground flex items-center gap-1"
                        >
                          <span className="text-primary font-bold">{idx + 1}.</span>
                          <span>{song.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({song.bookCode} {song.hymnNumber})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MASTER ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="space-y-3" data-testid="master-announcements-panel">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Koleksi Master Warta Jemaat
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Set warta dan flyer yang dapat disematkan ke jadwal ibadah manapun.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5 shrink-0"
                  onClick={() => setIsAddAnnouncementOpen(true)}
                  data-testid="add-master-announcement-button"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Warta Baru</span>
                </Button>
              </div>

              {/* Add Announcement Inline Form */}
              {isAddAnnouncementOpen && (
                <form
                  onSubmit={handleCreateAnnouncement}
                  className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in"
                  data-testid="add-master-announcement-form"
                >
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-primary" />
                    <span>Buat Master Warta Baru</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">Judul Set Warta</Label>
                      <Input
                        value={newAnnouncementTitle}
                        onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                        placeholder="Contoh: Warta Khusus Sabat Pemuda"
                        className="h-7 text-xs"
                        data-testid="new-master-announcement-title-input"
                        required
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={newAnnouncementLooping}
                        onChange={(e) => setNewAnnouncementLooping(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span>Aktifkan Looping Carousel otomatis</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setIsAddAnnouncementOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" size="sm" className="h-6 text-xs font-semibold">
                      Simpan Warta
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {announcementSets.map((as) => (
                  <div
                    key={as.id}
                    className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs space-y-2.5"
                    data-testid={`master-announcement-card-${as.id}`}
                  >
                    {editingAnnouncementId === as.id ? (
                      <div className="p-3 bg-muted/40 rounded-xl border border-border/80 space-y-2.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground">Judul Warta</Label>
                          <Input
                            value={editAnnouncementTitle}
                            onChange={(e) => setEditAnnouncementTitle(e.target.value)}
                            className="h-7 text-xs"
                            data-testid={`edit-announcement-title-input-${as.id}`}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={editAnnouncementLooping}
                            onChange={(e) => setEditAnnouncementLooping(e.target.checked)}
                            className="rounded border-border"
                          />
                          <span>Aktifkan Looping Carousel otomatis</span>
                        </label>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setEditingAnnouncementId(null)}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 text-xs font-semibold"
                            onClick={() => {
                              updateAnnouncementSets(
                                announcementSets.map((a) =>
                                  a.id === as.id
                                    ? {
                                        ...a,
                                        title: editAnnouncementTitle.trim() || a.title,
                                        looping: editAnnouncementLooping,
                                        updatedAt: 'Baru saja diperbarui',
                                      }
                                    : a
                                )
                              );
                              setEditingAnnouncementId(null);
                              toast.success(`Warta "${editAnnouncementTitle.trim() || as.title}" berhasil diperbarui.`);
                            }}
                            data-testid={`save-master-announcement-${as.id}`}
                          >
                            Simpan Perubahan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-foreground">
                              {as.title}
                            </h4>
                            {as.looping && (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                Looping Carousel
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {as.flyersCount} Slide Flyer • Diperbarui: {as.updatedAt}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold gap-1"
                            onClick={() => {
                              setEditingAnnouncementId(as.id);
                              setEditAnnouncementTitle(as.title);
                              setEditAnnouncementLooping(as.looping);
                            }}
                            data-testid={`edit-master-announcement-${as.id}`}
                          >
                            <span>Ubah</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-semibold text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              updateAnnouncementSets(announcementSets.filter((x) => x.id !== as.id));
                              toast.success(`Warta "${as.title}" (${as.flyersCount} flyer) berhasil dihapus.`);
                            }}
                            data-testid={`delete-master-announcement-${as.id}`}
                          >
                            <span>Hapus</span>
                          </Button>
                          {onSelectAnnouncementSet && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs font-semibold gap-1 shrink-0"
                              onClick={() => {
                                onSelectAnnouncementSet(as);
                                onClose();
                                toast.success(`Warta "${as.title}" diterapkan ke timeline.`);
                              }}
                              data-testid="select-master-announcement-button"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Pilih Warta Ini</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Flyer thumbnails list */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {as.flyers.map((flyer) => (
                        <div
                          key={flyer.id}
                          className="p-2 rounded-lg border border-border bg-background/50 flex flex-col gap-1 items-center text-center"
                        >
                          <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center text-muted-foreground text-[10px] font-mono">
                            16:9
                          </div>
                          <span className="text-[11px] font-medium text-foreground line-clamp-1">
                            {flyer.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PREDEFINED FIELDS & TOKENS */}
          {activeTab === 'tokens' && (
            <div className="space-y-3" data-testid="predefined-fields-drawer">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Daftar Kamus Variabel Global
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Token variabel ini dapat disematkan di judul slide, nats, atau template kanvas sebagai {'{nama_token}'}.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs font-semibold gap-1"
                  onClick={() => setIsAddTokenOpen(true)}
                  data-testid="add-token-button"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Token</span>
                </Button>
              </div>

              {/* Add Token Form */}
              {isAddTokenOpen && (
                <form
                  onSubmit={handleAddToken}
                  className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 animate-in fade-in"
                  data-testid="add-token-form"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">
                        Kunci Token (tanpa tanda kurung)
                      </Label>
                      <Input
                        type="text"
                        placeholder="sermon_guest_speaker"
                        value={newTokenKey}
                        onChange={(e) => setNewTokenKey(e.target.value)}
                        className="w-full h-7 px-2 text-xs font-mono"
                        data-testid="token-name-input"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">
                        Label Tampilan
                      </Label>
                      <Input
                        type="text"
                        placeholder="Pembicara Khusus"
                        value={newTokenLabel}
                        onChange={(e) => setNewTokenLabel(e.target.value)}
                        className="w-full h-7 px-2 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground">
                        Tipe Data
                      </Label>
                      <Select
                        value={newTokenType}
                        onValueChange={(val) => {
                          if (val) setNewTokenType(val as any);
                        }}
                      >
                        <SelectTrigger
                          className="w-full h-7 px-2 text-xs"
                          data-testid="token-type-select"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Teks Baris Tunggal</SelectItem>
                          <SelectItem value="multiline">Teks Multi-Baris</SelectItem>
                          <SelectItem value="person">Nama Petugas / Personel</SelectItem>
                          <SelectItem value="scripture">Rujukan Alkitab</SelectItem>
                          <SelectItem value="date">Tanggal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground">
                      Deskripsi
                    </Label>
                    <Input
                      type="text"
                      placeholder="Jelaskan penggunaan token ini..."
                      value={newTokenDesc}
                      onChange={(e) => setNewTokenDesc(e.target.value)}
                      className="w-full h-7 px-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setIsAddTokenOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" size="sm" className="h-6 text-xs font-semibold">
                      Simpan Token
                    </Button>
                  </div>
                </form>
              )}

              {/* Tokens Table */}
              <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground">
                      <th className="p-2.5">Kunci Token</th>
                      <th className="p-2.5">Label</th>
                      <th className="p-2.5">Tipe Data</th>
                      <th className="p-2.5">Keterangan</th>
                      <th className="p-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {tokens.map((tok) => {
                      const isSys = tok.isSystem || isSystemPredefinedToken(tok.key);

                      return (
                        <tr key={tok.id} className="hover:bg-muted/20">
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-primary font-bold">{`{${tok.key}}`}</span>
                              {isSys && (
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-sans"
                                  data-testid={`system-token-badge-${tok.key}`}
                                >
                                  [System]
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-semibold text-foreground">
                            {editingTokenKey === tok.key ? (
                              <Input
                                value={editTokenLabel}
                                onChange={(e) => setEditTokenLabel(e.target.value)}
                                className="h-7 text-xs"
                                data-testid={`edit-token-label-input-${tok.key}`}
                              />
                            ) : (
                              tok.label
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-muted border border-border">
                              {tok.type}
                            </span>
                          </td>
                          <td className="p-2.5 text-muted-foreground text-[11px]">
                            {editingTokenKey === tok.key ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editTokenDesc}
                                  onChange={(e) => setEditTokenDesc(e.target.value)}
                                  className="h-7 text-xs flex-1"
                                  data-testid={`edit-token-desc-input-${tok.key}`}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => {
                                    updateTokens(
                                      tokens.map((t) =>
                                        t.key === tok.key
                                          ? {
                                              ...t,
                                              label: editTokenLabel.trim() || t.label,
                                              description: editTokenDesc.trim() || t.description,
                                            }
                                          : t
                                      )
                                    );
                                    setEditingTokenKey(null);
                                    toast.success(`Token {${tok.key}} berhasil diperbarui.`);
                                  }}
                                  data-testid={`save-token-${tok.key}`}
                                >
                                  Simpan
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => setEditingTokenKey(null)}
                                >
                                  Batal
                                </Button>
                              </div>
                            ) : (
                              tok.description
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isSys}
                                className={`h-7 px-2 text-xs ${
                                  isSys
                                    ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                                    : ''
                                }`}
                                title={isSys ? 'Token sistem tidak dapat diubah' : 'Ubah token kustom'}
                                onClick={() => {
                                  if (isSys) return;
                                  setEditingTokenKey(tok.key);
                                  setEditTokenLabel(tok.label);
                                  setEditTokenDesc(tok.description);
                                }}
                                data-testid={`edit-token-${tok.key}`}
                              >
                                Ubah
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isSys}
                                className={`h-7 px-2 text-xs ${
                                  isSys
                                    ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                                    : 'text-destructive hover:bg-destructive/10'
                                }`}
                                title={isSys ? 'Token sistem tidak dapat dihapus' : 'Hapus token kustom'}
                                onClick={() => {
                                  if (isSys) return;
                                  updateTokens(tokens.filter((t) => t.key !== tok.key));
                                  toast.success(`Token {${tok.key}} berhasil dihapus.`);
                                }}
                                data-testid={`delete-token-${tok.key}`}
                              >
                                Hapus
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-semibold">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
