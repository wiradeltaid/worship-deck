import React, { useState } from 'react';
import {
  Music,
  Megaphone,
  Presentation,
  BookOpen,
  FileText,
  Upload,
  Sparkles,
  SlidersHorizontal,
  Check,
  Plus,
  Layers,
  Image as ImageIcon,
  RotateCw,
  Eye,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TimelineItem } from './types';
import { parseRawRundownText } from './utils';
import { toast } from 'sonner';

interface MockupEditorProps {
  item: TimelineItem;
  onUpdateItem: (updated: Partial<TimelineItem>) => void;
  onReplaceItems?: (items: TimelineItem[]) => void;
}

export default function MockupEditor({
  item,
  onUpdateItem,
  onReplaceItems,
}: MockupEditorProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'raw'>('editor');
  const [rawText, setRawText] = useState(
    `09:00 - Pembukaan & Ucapan Selamat Datang\n09:05 - Lagu Buka: SDAH 123 "Hai Pujilah Tuhan"\n09:15 - Doa Pembuka\n09:20 - Warta Jemaat Mingguan\n09:30 - Pembacaan Alkitab: Yohanes 3:16\n09:35 - Khotbah: Pdt. John Doe "Kasih yang Mengubahkan"\n10:15 - Lagu Tutup: SDAH 45 "Tuhan Allah Beserta Engkau"\n10:25 - Doa Berkat`
  );

  // Modal drawer states for in-place creation simulation
  const [addSongModalOpen, setAddSongModalOpen] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongNumber, setNewSongNumber] = useState('');

  const [uploadFlyerModalOpen, setUploadFlyerModalOpen] = useState(false);
  const [newFlyerTitle, setNewFlyerTitle] = useState('');

  const handleSimulateAddSong = () => {
    if (!newSongTitle.trim()) {
      toast.error('Judul lagu tidak boleh kosong');
      return;
    }
    toast.success(`Lagu "${newSongTitle}" berhasil ditambahkan ke pustaka lagu`);
    onUpdateItem({
      title: `Lagu — ${newSongTitle}`,
      subtitle: newSongNumber ? `SDAH ${newSongNumber}` : undefined,
      songData: {
        ...item.songData,
        hymnNumber: newSongNumber ? parseInt(newSongNumber, 10) : 123,
      },
    });
    setAddSongModalOpen(false);
    setNewSongTitle('');
    setNewSongNumber('');
  };

  const handleSimulateUploadFlyer = () => {
    if (!newFlyerTitle.trim()) {
      toast.error('Judul warta tidak boleh kosong');
      return;
    }
    const newFlyers = [
      ...(item.announcementData?.flyers || []),
      {
        id: `flyer-${Date.now()}`,
        title: newFlyerTitle,
        url: '/assets/demo-flyer.jpg',
        category: 'announcement',
      },
    ];
    onUpdateItem({
      announcementData: {
        looping: item.announcementData?.looping ?? true,
        flyers: newFlyers,
      },
      slidesCount: newFlyers.length,
    });
    toast.success(`Flyer "${newFlyerTitle}" berhasil diunggah ke set warta`);
    setUploadFlyerModalOpen(false);
    setNewFlyerTitle('');
  };

  const handleParseRawRundown = () => {
    const parsed = parseRawRundownText(rawText);
    if (parsed.length === 0) {
      toast.error('Tidak ada baris teks rundown yang valid untuk di-parse');
      return;
    }
    if (onReplaceItems) {
      onReplaceItems(parsed);
    }
    toast.success(`Berhasil mem-parse ${parsed.length} item ke timeline!`);
    setActiveTab('editor');
  };

  return (
    <div
      data-testid="mockup-editor"
      className="flex flex-col h-full bg-card/60 backdrop-blur-md rounded-2xl border border-border/80 shadow-sm overflow-hidden"
    >
      {/* Editor Header & Tab Switcher */}
      <div className="p-4 border-b border-border/70 flex items-center justify-between bg-card/80 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              In-Place Item Editor
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
              ID: {item.id}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Konfigurasi konteks spesifik tanpa berpindah halaman
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
          <button
            type="button"
            data-testid="tab-active-editor"
            onClick={() => setActiveTab('editor')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'editor'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Editor Item Aktif
          </button>
          <button
            type="button"
            data-testid="tab-raw-rundown"
            onClick={() => setActiveTab('raw')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'raw'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Teks Rundown Mentah
          </button>
        </div>
      </div>

      {/* Editor Content Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'raw' ? (
          /* Raw Rundown Parser Tab */
          <div className="space-y-4" data-testid="raw-rundown-panel">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Salin-Tempel Teks Rundown Mentah
              </Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={handleParseRawRundown}
                data-testid="parse-raw-rundown-button"
              >
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Parse ke Timeline</span>
              </Button>
            </div>
            <textarea
              className="w-full h-72 font-mono text-xs p-3 rounded-xl border border-border/80 bg-background/80 focus:outline-hidden focus:ring-1 focus:ring-primary"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Tempel rundown dari WhatsApp atau catatan rapat di sini..."
              data-testid="raw-rundown-textarea"
            />
            <p className="text-[11px] text-muted-foreground">
              Parser otomatis mengenali nomor lagu SDAH, pembacaan firman, nama pembicara, dan set warta jemaat.
            </p>
          </div>
        ) : (
          /* Contextual Item Editor Tab */
          <div className="space-y-5" data-testid="contextual-editor-panel">
            {/* Common Title & Subtitle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Judul Agenda</Label>
                <Input
                  value={item.title}
                  onChange={(e) => onUpdateItem({ title: e.target.value })}
                  className="h-8 text-xs bg-background/80"
                  data-testid="item-title-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Keterangan / Subtitle</Label>
                <Input
                  value={item.subtitle || ''}
                  onChange={(e) => onUpdateItem({ subtitle: e.target.value })}
                  placeholder="Keterangan tambahan..."
                  className="h-8 text-xs bg-background/80"
                  data-testid="item-subtitle-input"
                />
              </div>
            </div>

            {/* Context: Song */}
            {item.type === 'song' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5"
                data-testid="song-context-editor"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                    <Music className="w-4 h-4" />
                    <span>Konfigurasi Lagu & Lirik Pujian</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                    onClick={() => setAddSongModalOpen(true)}
                    data-testid="open-add-song-modal"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Lagu Baru...</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Buku Lagu</Label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background"
                      value={item.songData?.bookCode || 'SDAH'}
                      onChange={(e) =>
                        onUpdateItem({
                          songData: { ...item.songData, bookCode: e.target.value },
                        })
                      }
                    >
                      <option value="SDAH">SDAH (Adventist Hymnal)</option>
                      <option value="KLIK">KLIK (Lagu Pujian)</option>
                      <option value="PKI">PKI (Pujian Kristen)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Nomor / Judul Autocomplete</Label>
                    <Input
                      value={item.songData?.hymnNumber ? `#${item.songData.hymnNumber}` : '#123 - Hai Pujilah Tuhan'}
                      readOnly
                      className="h-8 text-xs bg-muted/50 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Transpose / Nada Dasar</Label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background"
                      value={item.songData?.key || 'D'}
                      onChange={(e) =>
                        onUpdateItem({
                          songData: { ...item.songData, key: e.target.value },
                        })
                      }
                      data-testid="song-key-selector"
                    >
                      {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                        <option key={k} value={k}>
                          Kunci {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SPEC-48-02: Song Background Picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Background Slide</Label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background"
                      value={item.songData?.backgroundUrl || '/assets/background-navy.jpg'}
                      onChange={(e) =>
                        onUpdateItem({
                          songData: { ...item.songData, backgroundUrl: e.target.value },
                        })
                      }
                      data-testid="song-background-picker"
                    >
                      <option value="/assets/background-navy.jpg">Gradient Default (Deep Navy)</option>
                      <option value="/assets/background-sanctuary.jpg">Sanctuary / Mimbar Gereja</option>
                      <option value="/assets/background-nature.jpg">Pemandangan Alam / Nature</option>
                      <option value="/assets/background-cross.jpg">Cross / Salib Minimalis</option>
                    </select>
                  </div>
                </div>

                {/* Bait / Verses Active Checkboxes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bait yang Dinyanyikan</Label>
                  <div className="flex flex-wrap items-center gap-2 pt-1" data-testid="verse-checkboxes">
                    {[1, 2, 3, 4].map((v) => {
                      const activeVerses = item.songData?.activeVerses || [1, 2, 4];
                      const isChecked = activeVerses.includes(v);

                      return (
                        <label
                          key={v}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-cyan-500/15 border-cyan-500 text-cyan-800 dark:text-cyan-200'
                              : 'bg-background border-border text-muted-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = isChecked
                                ? activeVerses.filter((x) => x !== v)
                                : [...activeVerses, v].sort();
                              onUpdateItem({
                                songData: { ...item.songData, activeVerses: next },
                                slidesCount: next.length,
                              });
                            }}
                            className="rounded text-cyan-600 w-3.5 h-3.5"
                          />
                          <span>Bait {v}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Context: Announcement */}
            {item.type === 'announcement' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5"
                data-testid="announcement-context-editor"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs">
                    <Megaphone className="w-4 h-4" />
                    <span>Set Warta Jemaat (Single-Row 4-Slot Grid)</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                    onClick={() => setUploadFlyerModalOpen(true)}
                    data-testid="open-upload-flyer-modal"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Unggah Flyer...</span>
                  </Button>
                </div>

                {/* 4-Slot Flyer Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="flyer-slots-grid">
                  {(item.announcementData?.flyers || [
                    { id: 'f1', title: 'Seminar Kesehatan', url: '/assets/flyer1.jpg', category: 'announcement' },
                    { id: 'f2', title: 'Perkemahan Pemuda', url: '/assets/flyer2.jpg', category: 'announcement' },
                    { id: 'f3', title: 'Jadwal Kebaktian Rumah Tangga', url: '/assets/flyer3.jpg', category: 'announcement' },
                    { id: 'f4', title: 'Perjamuan Kudus', url: '/assets/flyer4.jpg', category: 'announcement' },
                  ]).map((flyer, idx) => (
                    <div
                      key={flyer.id}
                      className="group relative aspect-video rounded-lg border border-purple-500/30 bg-background/80 overflow-hidden flex flex-col justify-end p-2 shadow-2xs hover:border-purple-500 transition-colors"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                      <div className="absolute top-1.5 left-1.5 z-20 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">
                        #{idx + 1}
                      </div>
                      <p className="relative z-20 text-[11px] font-semibold text-white truncate">
                        {flyer.title}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Looping Carousel Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-purple-500/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Looping Tayang Otomatis (Carousel)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Putar warta otomatis sebelum ibadah dimulai (interval 8 detik)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.announcementData?.looping ?? true}
                    onChange={(e) =>
                      onUpdateItem({
                        announcementData: {
                          flyers: item.announcementData?.flyers || [],
                          looping: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 text-purple-600 rounded"
                    data-testid="announcement-looping-toggle"
                  />
                </div>
              </div>
            )}

            {/* Context: Sermon */}
            {item.type === 'sermon' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
                data-testid="sermon-context-editor"
              >
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <Presentation className="w-4 h-4" />
                  <span>Predefined Field Khotbah & Pembicara</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nama Pengkhotbah ({'{speaker}'})</Label>
                    <Input
                      value={item.sermonData?.speaker || 'Pdt. Dr. Johnathan Doe'}
                      onChange={(e) =>
                        onUpdateItem({
                          sermonData: {
                            speaker: e.target.value,
                            title: item.sermonData?.title || item.title,
                            scriptureRef: item.sermonData?.scriptureRef || 'Yohanes 3:16',
                          },
                        })
                      }
                      className="h-8 text-xs bg-background/80"
                      data-testid="sermon-speaker-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Ayat Bacaan Pokok ({'{scripture_reference}'})</Label>
                    <Input
                      value={item.sermonData?.scriptureRef || 'Yohanes 3:16-17'}
                      onChange={(e) =>
                        onUpdateItem({
                          sermonData: {
                            speaker: item.sermonData?.speaker || 'Pdt. Dr. Johnathan Doe',
                            title: item.sermonData?.title || item.title,
                            scriptureRef: e.target.value,
                          },
                        })
                      }
                      className="h-8 text-xs bg-background/80"
                      data-testid="sermon-scripture-input"
                    />
                  </div>
                </div>

                {/* Instant Token Preview Badge */}
                <div className="p-3 rounded-lg bg-background/90 border border-border/80 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground">Token Preview:</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                    {item.sermonData?.speaker || 'Pdt. Dr. Johnathan Doe'}
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                    "{item.title}"
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                    {item.sermonData?.scriptureRef || 'Yohanes 3:16-17'}
                  </span>
                </div>
              </div>
            )}

            {/* Context: Scripture */}
            {item.type === 'scripture' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5"
                data-testid="scripture-context-editor"
              >
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <BookOpen className="w-4 h-4" />
                  <span>Ayat Pembacaan Alkitab</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Referensi Kitab / Fasal / Ayat</Label>
                    <Input
                      defaultValue="Yohanes 3:16-17"
                      className="h-8 text-xs bg-background/80"
                      data-testid="scripture-reference-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Terjemahan</Label>
                    <select className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-background">
                      <option value="TB2">TB2 (Terjemahan Baru 2)</option>
                      <option value="KJV">KJV (King James Version)</option>
                      <option value="BIS">BIS (Bahasa Indonesia Sehari-hari)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Context: General */}
            {item.type === 'general' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-zinc-500/20 bg-zinc-500/5"
                data-testid="general-context-editor"
              >
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-bold text-xs">
                  <FileText className="w-4 h-4" />
                  <span>Pengaturan Slide Umum</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Catatan / Keterangan Petugas</Label>
                  <Input
                    value={item.generalData?.notes || 'Dipimpin oleh Ketua Diaken'}
                    onChange={(e) =>
                      onUpdateItem({
                        generalData: { ...item.generalData, notes: e.target.value },
                      })
                    }
                    className="h-8 text-xs bg-background/80"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Drawer: Add New Song Simulation */}
      <Dialog open={addSongModalOpen} onOpenChange={setAddSongModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="add-song-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Music className="w-4 h-4 text-cyan-500" />
              <span>Tambah Lagu Baru ke Pustaka</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Judul Lagu</Label>
              <Input
                placeholder="Contoh: Bapa Sorgawi yang Mengasihi"
                value={newSongTitle}
                onChange={(e) => setNewSongTitle(e.target.value)}
                className="h-8 text-xs"
                data-testid="new-song-title-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nomor Lagu (Opsional)</Label>
              <Input
                placeholder="Contoh: 345"
                value={newSongNumber}
                onChange={(e) => setNewSongNumber(e.target.value)}
                className="h-8 text-xs"
                data-testid="new-song-number-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddSongModalOpen(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSimulateAddSong}
              className="h-8 text-xs"
              data-testid="save-new-song-button"
            >
              Simpan & Pilih
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Drawer: Upload Flyer Simulation */}
      <Dialog open={uploadFlyerModalOpen} onOpenChange={setUploadFlyerModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="upload-flyer-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-500" />
              <span>Unggah Flyer Warta Jemaat</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Judul Warta / Flyer</Label>
              <Input
                placeholder="Contoh: Perkemahan Pemuda Advent 2026"
                value={newFlyerTitle}
                onChange={(e) => setNewFlyerTitle(e.target.value)}
                className="h-8 text-xs"
                data-testid="new-flyer-title-input"
              />
            </div>
            <div className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center space-y-2 bg-muted/20">
              <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                Tarik berkas gambar flyer ke sini, atau klik untuk memilih
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                Format didukung: JPG, PNG, WebP (Rasio 16:9 disarankan)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUploadFlyerModalOpen(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleSimulateUploadFlyer}
              className="h-8 text-xs"
              data-testid="save-new-flyer-button"
            >
              Unggah & Sisipkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
