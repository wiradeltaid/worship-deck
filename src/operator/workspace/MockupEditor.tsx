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
  Palette,
  Users,
  Copy,
  Unlink,
  FileSpreadsheet,
  Settings,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  TimelineItem,
  PINNED_SLIDE_0_ID,
  WeeklyVariables,
  DEFAULT_WEEKLY_VARIABLES,
} from './types';
import { parseRawRundownText } from './utils';
import MockupCanvasDesignerModal from './MockupCanvasDesignerModal';
import MockupDutyRosterDrawer from './MockupDutyRosterDrawer';
import MockupMediaGalleryDrawer from './MockupMediaGalleryDrawer';
import { toast } from 'sonner';

interface MockupEditorProps {
  item: TimelineItem;
  weeklyVars?: WeeklyVariables;
  onUpdateWeeklyVars?: (updated: Partial<WeeklyVariables>) => void;
  onUpdateItem: (updated: Partial<TimelineItem>) => void;
  onReplaceItems?: (items: TimelineItem[]) => void;
  onOpenMasterLibraries?: (tab: 'song_sets' | 'announcements' | 'tokens') => void;
  onSaveToMasterSongSet?: (item: TimelineItem) => void;
  onSaveToMasterAnnouncementSet?: (item: TimelineItem) => void;
  onDetachMasterSongSet?: (item: TimelineItem) => void;
  onDetachMasterAnnouncementSet?: (item: TimelineItem) => void;
}

export default function MockupEditor({
  item,
  weeklyVars = DEFAULT_WEEKLY_VARIABLES,
  onUpdateWeeklyVars,
  onUpdateItem,
  onReplaceItems,
  onOpenMasterLibraries,
  onSaveToMasterSongSet,
  onSaveToMasterAnnouncementSet,
  onDetachMasterSongSet,
  onDetachMasterAnnouncementSet,
}: MockupEditorProps) {
  const isSlide0 = item.id === PINNED_SLIDE_0_ID;

  const [rawText, setRawText] = useState(
    `09:00 - Pembukaan & Ucapan Selamat Datang\n09:05 - Lagu Buka: SDAH 123 "Hai Pujilah Tuhan"\n09:15 - Doa Pembuka\n09:20 - Warta Jemaat Mingguan\n09:30 - Pembacaan Alkitab: Yohanes 3:16\n09:35 - Khotbah: Pdt. John Doe "Kasih yang Mengubahkan"\n10:15 - Lagu Tutup: SDAH 45 "Tuhan Allah Beserta Engkau"\n10:25 - Doa Berkat`
  );

  // Modal drawer states for in-place creation simulation
  const [addSongModalOpen, setAddSongModalOpen] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongNumber, setNewSongNumber] = useState('');

  const [uploadFlyerModalOpen, setUploadFlyerModalOpen] = useState(false);
  const [newFlyerTitle, setNewFlyerTitle] = useState('');

  // Milestone workflow drawer states
  const [canvasDesignerOpen, setCanvasDesignerOpen] = useState(false);
  const [dutyRosterOpen, setDutyRosterOpen] = useState(false);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const [isFormLayoutModalOpen, setIsFormLayoutModalOpen] = useState(false);

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
      ...(weeklyVars.announcement_flyers || item.announcementData?.flyers || []),
      {
        id: `flyer-${Date.now()}`,
        title: newFlyerTitle,
        url: '/assets/demo-flyer.jpg',
        category: 'announcement',
      },
    ];
    if (onUpdateWeeklyVars) {
      onUpdateWeeklyVars({ announcement_flyers: newFlyers });
    }
    onUpdateItem({
      announcementData: {
        looping: item.announcementData?.looping ?? true,
        flyers: newFlyers,
      },
      slidesCount: newFlyers.length,
    });
    toast.success(`Flyer "${newFlyerTitle}" berhasil diunggah ke slot warta`);
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
  };

  const handleInsertToken = (token: string) => {
    const current = item.textContent || item.customSlideData?.content || item.title || '';
    const updated = current ? `${current}\n${token}` : token;
    onUpdateItem({
      textContent: updated,
      title: updated.split('\n')[0] || item.title,
      customSlideData: {
        title: updated.split('\n')[0] || item.title,
        content: updated,
        backgroundUrl: item.canvasStyle?.backgroundUrl,
      },
    });
    toast.info(`Token ${token} disisipkan ke slide.`);
  };

  const handleDetachSongSet = () => {
    if (onDetachMasterSongSet) {
      onDetachMasterSongSet(item);
    } else {
      onUpdateItem({
        masterSongSetId: null,
        masterSongSetTitle: undefined,
        isMasterBound: false,
        songData: item.songData ? JSON.parse(JSON.stringify(item.songData)) : undefined,
      });
      toast.success('Lagu telah dilepas (detached) dari Master Songset.');
    }
  };

  const handleDetachAnnouncement = () => {
    if (onDetachMasterAnnouncementSet) {
      onDetachMasterAnnouncementSet(item);
    } else {
      onUpdateItem({
        masterAnnouncementSetId: null,
        masterAnnouncementSetTitle: undefined,
        isMasterBound: false,
        announcementData: item.announcementData
          ? JSON.parse(JSON.stringify(item.announcementData))
          : undefined,
      });
      toast.success('Warta telah dilepas (detached) dari Master Warta.');
    }
  };

  return (
    <div
      data-testid="mockup-editor"
      className="flex flex-col h-full bg-card/60 backdrop-blur-md rounded-2xl border border-border/80 shadow-sm overflow-hidden"
    >
      {/* Editor Header */}
      <div className="p-4 border-b border-border/70 flex items-center justify-between bg-card/80 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              {isSlide0 ? 'Slide 0: Rundown & Formulir Ibadah' : 'In-Place Canvas-First Editor'}
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
              {isSlide0 ? 'PINNED HUB' : `ID: ${item.id}`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSlide0
              ? 'Pusat salin-tempel rundown mentah WhatsApp dan variabel mingguan terpusat'
              : 'Editor slide kanvas bebas visual dengan integrasi token dinamis'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isSlide0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setCanvasDesignerOpen(true)}
              data-testid="open-canvas-designer-button"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Ubah Tata Letak Kanvas</span>
            </Button>
          )}

          {isSlide0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              onClick={() => setIsFormLayoutModalOpen(true)}
              data-testid="edit-form-layout-button"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>⚙️ Edit Tata Letak Form</span>
            </Button>
          )}

          {/* View Tab Buttons (SPEC-48 backward compatibility) */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="tab-active-editor"
              className="h-auto px-2 py-0.5 text-[11px] font-semibold rounded bg-card text-foreground shadow-2xs"
            >
              Editor Item Aktif
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="tab-raw-rundown"
              className="h-auto px-2 py-0.5 text-[11px] font-semibold rounded text-muted-foreground hover:text-foreground"
            >
              Teks Rundown Mentah
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {isSlide0 ? (
          /* =========================================================================
             PINNED SLIDE 0: RUNDOWN & FORM HUB
             ========================================================================= */
          <div className="space-y-6" data-testid="rundown-hub-panel">
            {/* 1. Primary Ingestion Card: WhatsApp / Email Rundown */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Salin-Tempel Teks Rundown Mentah (WhatsApp / Email)</span>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  onClick={handleParseRawRundown}
                  data-testid="parse-raw-rundown-button"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ Parse Rundown ke Timeline</span>
                </Button>
              </div>

              <textarea
                className="w-full h-44 font-mono text-xs p-3 rounded-xl border border-border/80 bg-background/90 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Tempel rundown dari WhatsApp atau catatan rapat di sini (contoh: 09:00 - Lagu Buka: SDAH 123...)"
                data-testid="raw-rundown-textarea"
              />
              <p className="text-[11px] text-muted-foreground">
                Parser otomatis menguraikan nomor lagu SDAH, pembacaan firman, pengkhotbah, dan warta ke slide 1..N.
              </p>
            </div>

            {/* 2. Central Predefined Fields Form */}
            <div className="p-4 rounded-xl border border-border/80 bg-card/70 space-y-4 shadow-2xs" data-testid="predefined-fields-form">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                  <Tag className="w-4 h-4 text-primary" />
                  <span>Variabel Formulir Ibadah Mingguan ({'{tokens}'})</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  DEC-004 Instance Binding
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sermon Speaker */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Pengkhotbah ({'{sermon_speaker}'})</Label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => setDutyRosterOpen(true)}
                      className="h-auto p-0 text-[11px] text-primary hover:underline"
                    >
                      Buka Roster
                    </Button>
                  </div>
                  <Input
                    value={weeklyVars.sermon_speaker}
                    onChange={(e) => {
                      if (onUpdateWeeklyVars) onUpdateWeeklyVars({ sermon_speaker: e.target.value });
                    }}
                    className="h-8 text-xs bg-background/90"
                    placeholder="Nama Pengkhotbah..."
                    data-testid="sermon-speaker-input"
                  />
                </div>

                {/* Sermon Title */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Judul Khotbah ({'{sermon_title}'})</Label>
                  <Input
                    value={weeklyVars.sermon_title}
                    onChange={(e) => {
                      if (onUpdateWeeklyVars) onUpdateWeeklyVars({ sermon_title: e.target.value });
                    }}
                    className="h-8 text-xs bg-background/90"
                    placeholder="Judul Khotbah..."
                    data-testid="sermon-title-input"
                  />
                </div>

                {/* Scripture Reference */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ayat Alkitab Pokok ({'{scripture_reference}'})</Label>
                  <Input
                    value={weeklyVars.scripture_reference}
                    onChange={(e) => {
                      if (onUpdateWeeklyVars) onUpdateWeeklyVars({ scripture_reference: e.target.value });
                    }}
                    className="h-8 text-xs bg-background/90"
                    placeholder="Contoh: Yohanes 3:16-17"
                    data-testid="scripture-reference-input"
                  />
                </div>

                {/* Worship Leader */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Pemimpin Acara / Liturgis ({'{worship_leader}'})</Label>
                  <Input
                    value={weeklyVars.worship_leader}
                    onChange={(e) => {
                      if (onUpdateWeeklyVars) onUpdateWeeklyVars({ worship_leader: e.target.value });
                    }}
                    className="h-8 text-xs bg-background/90"
                    placeholder="Nama Pemimpin Acara..."
                    data-testid="worship-leader-input"
                  />
                </div>

                {/* Family of the Week */}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold">Keluarga yang Didoakan ({'{family_of_the_week}'})</Label>
                  <Input
                    value={weeklyVars.family_of_the_week}
                    onChange={(e) => {
                      if (onUpdateWeeklyVars) onUpdateWeeklyVars({ family_of_the_week: e.target.value });
                    }}
                    className="h-8 text-xs bg-background/90"
                    placeholder="Contoh: Keluarga Bpk. David Tan"
                    data-testid="family-of-the-week-input"
                  />
                </div>
              </div>

              {/* Central Flyer Slots */}
              <div className="pt-2 border-t border-border/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    Slot Flyer Warta Jemaat Mingguan
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                    onClick={() => setUploadFlyerModalOpen(true)}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Unggah Flyer Mingguan</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="slide0-flyer-slots">
                  {(weeklyVars.announcement_flyers || []).map((flyer, idx) => (
                    <div
                      key={flyer.id}
                      className="group relative aspect-video rounded-lg border border-purple-500/30 bg-background/80 overflow-hidden flex flex-col justify-end p-2 shadow-2xs"
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
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             SLIDE 1..N: CANVAS-FIRST PRESENTATION SLIDE MODEL
             (Judul Agenda and Subtitle input boxes permanently removed)
             ========================================================================= */
          <div className="space-y-5" data-testid="canvas-first-editor">
            {/* Dynamic Master Songset / Announcement Binding Indicator */}
            {item.isMasterBound && item.type === 'song' && (
              <div
                className="p-3 bg-cyan-500/10 border border-cyan-500/40 rounded-xl flex items-center justify-between gap-3 flex-wrap animate-in fade-in"
                data-testid="master-bound-badge"
              >
                <div className="flex items-center gap-2">
                  <span className="text-cyan-700 dark:text-cyan-300 font-bold text-xs">
                    🔗 Terikat Master: {item.masterSongSetTitle || item.title}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-cyan-500/40 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-500/20"
                  onClick={handleDetachSongSet}
                  data-testid="detach-master-songset-button"
                >
                  <Unlink className="w-3 h-3" />
                  <span>🔓 Detach dari Master Songset</span>
                </Button>
              </div>
            )}

            {item.isMasterBound && item.type === 'announcement' && (
              <div
                className="p-3 bg-purple-500/10 border border-purple-500/40 rounded-xl flex items-center justify-between gap-3 flex-wrap animate-in fade-in"
                data-testid="announcement-master-bound-badge"
              >
                <div className="flex items-center gap-2">
                  <span className="text-purple-700 dark:text-purple-300 font-bold text-xs">
                    🔗 Terikat Master Warta: {item.masterAnnouncementSetTitle || item.title}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-purple-500/40 text-purple-800 dark:text-purple-200 hover:bg-purple-500/20"
                  onClick={handleDetachAnnouncement}
                  data-testid="detach-master-announcement-button"
                >
                  <Unlink className="w-3 h-3" />
                  <span>🔓 Detach dari Master Warta</span>
                </Button>
              </div>
            )}

            {/* Canvas-First Visual & Typography Toolbar */}
            <div className="p-3 rounded-xl border border-border/80 bg-background/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Font Family */}
                <Select
                  value={item.canvasStyle?.fontFamily || 'sans'}
                  onValueChange={(val) =>
                    onUpdateItem({
                      canvasStyle: { ...item.canvasStyle, fontFamily: val || 'sans' },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-28 text-xs font-medium">
                    <SelectValue placeholder="Font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sans">Sans (Geist)</SelectItem>
                    <SelectItem value="serif">Serif (Classic)</SelectItem>
                    <SelectItem value="mono">Mono (Code)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Font Size */}
                <Select
                  value={String(item.canvasStyle?.fontSize || 28)}
                  onValueChange={(val) =>
                    onUpdateItem({
                      canvasStyle: { ...item.canvasStyle, fontSize: parseInt(val || '28', 10) },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-20 text-xs font-mono">
                    <SelectValue placeholder="Ukuran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 pt</SelectItem>
                    <SelectItem value="24">24 pt</SelectItem>
                    <SelectItem value="28">28 pt</SelectItem>
                    <SelectItem value="36">36 pt</SelectItem>
                    <SelectItem value="44">44 pt</SelectItem>
                  </SelectContent>
                </Select>

                {/* Text Alignment */}
                <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-lg border border-border/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 p-0 ${
                      item.canvasStyle?.alignX === 'left' ? 'bg-background shadow-2xs' : 'text-muted-foreground'
                    }`}
                    onClick={() =>
                      onUpdateItem({
                        canvasStyle: { ...item.canvasStyle, alignX: 'left' },
                      })
                    }
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 p-0 ${
                      !item.canvasStyle?.alignX || item.canvasStyle?.alignX === 'center'
                        ? 'bg-background shadow-2xs'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() =>
                      onUpdateItem({
                        canvasStyle: { ...item.canvasStyle, alignX: 'center' },
                      })
                    }
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 p-0 ${
                      item.canvasStyle?.alignX === 'right' ? 'bg-background shadow-2xs' : 'text-muted-foreground'
                    }`}
                    onClick={() =>
                      onUpdateItem({
                        canvasStyle: { ...item.canvasStyle, alignX: 'right' },
                      })
                    }
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Text Accent Color */}
                <Select
                  value={item.canvasStyle?.textColor || 'default'}
                  onValueChange={(val) =>
                    onUpdateItem({
                      canvasStyle: { ...item.canvasStyle, textColor: val || 'default' },
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-28 text-xs font-medium">
                    <SelectValue placeholder="Warna Teks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Putih / Netral</SelectItem>
                    <SelectItem value="amber">Amber Gold</SelectItem>
                    <SelectItem value="cyan">Cyan Blue</SelectItem>
                    <SelectItem value="emerald">Emerald Green</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Background Picker */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setMediaGalleryOpen(true)}
                data-testid="open-media-gallery-button"
              >
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                <span>Pilih Background</span>
              </Button>
            </div>

            {/* Predefined Field Compact Token Inserter Palette */}
            <div className="p-2.5 rounded-xl border border-border/70 bg-card/40 space-y-1.5" data-testid="token-palette">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Sisipkan Variabel Mingguan ke Teks Slide
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { token: '{sermon_speaker}', label: 'Pengkhotbah' },
                  { token: '{sermon_title}', label: 'Judul Khotbah' },
                  { token: '{scripture_reference}', label: 'Ayat Alkitab' },
                  { token: '{worship_leader}', label: 'Liturgis' },
                  { token: '{family_of_the_week}', label: 'Keluarga Syafaat' },
                ].map(({ token, label }) => (
                  <Button
                    key={token}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInsertToken(token)}
                    className="h-auto px-2 py-1 rounded-md text-[11px] font-mono bg-muted hover:bg-primary/20 hover:text-primary transition-colors border border-border/80 cursor-pointer flex items-center gap-1"
                    title={`Sisipkan ${token}`}
                    data-testid={`insert-token-${token.replace(/[{}]/g, '')}`}
                  >
                    <span>{token}</span>
                    <span className="text-[10px] text-muted-foreground">({label})</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Direct Slide Text Body (Canvas-First) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Konten Teks Slide (WYSIWYG Kanvas)</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Judul kartu timeline otomatis diambil dari baris pertama teks.
                </span>
              </Label>
              <Textarea
                value={
                  item.textContent ??
                  (item.customSlideData?.content || item.generalData?.notes || item.title)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const firstLine = val.split('\n')[0] || item.title;
                  onUpdateItem({
                    textContent: val,
                    title: firstLine,
                    customSlideData: {
                      title: firstLine,
                      content: val,
                      backgroundUrl: item.canvasStyle?.backgroundUrl,
                    },
                  });
                }}
                placeholder="Ketik isi teks slide atau sisipkan token di sini..."
                rows={6}
                className="text-xs bg-background/90 resize-none font-sans p-3 leading-relaxed"
                data-testid="slide-content-textarea"
              />
            </div>

            {/* Specific Context Controls: Song */}
            {item.type === 'song' && (
              <div className="space-y-4 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5" data-testid="song-context-editor">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 font-bold text-xs">
                    <Music className="w-4 h-4" />
                    <span>Konfigurasi Lagu & Lirik Pujian</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                      onClick={() => {
                        if (onOpenMasterLibraries) onOpenMasterLibraries('song_sets');
                      }}
                      data-testid="choose-master-song-set-button"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Pilih dari Master Songset</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                      onClick={() => {
                        if (onSaveToMasterSongSet) {
                          onSaveToMasterSongSet(item);
                        } else {
                          toast.success(`Lagu "${item.title}" berhasil disimpan ke Master Songset.`);
                        }
                      }}
                      data-testid="save-to-master-song-set-button"
                    >
                      <span>Simpan ke Master Songset</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
                      onClick={() => setAddSongModalOpen(true)}
                      data-testid="add-local-song-button"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Lagu Lokal</span>
                    </Button>
                  </div>
                </div>

                {/* Dual-Column 1920 Full HD Ergonomic Song Editor */}
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                  {/* Left Column: Metadata & Nada Lagu */}
                  <div className="space-y-3 p-3 rounded-lg bg-background/60 border border-border/60">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Metadata & Nada Lagu
                    </h4>
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <Label className="text-xs">Buku Lagu</Label>
                        <Select
                          value={item.songData?.bookCode || 'SDAH'}
                          onValueChange={(val) =>
                            onUpdateItem({
                              songData: { ...item.songData, bookCode: val || 'SDAH' },
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SDAH">SDAH</SelectItem>
                            <SelectItem value="KLIK">KLIK</SelectItem>
                            <SelectItem value="PKI">PKI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Nomor Lagu</Label>
                        <Input
                          value={item.songData?.hymnNumber ? `#${item.songData.hymnNumber}` : '#123'}
                          readOnly
                          className="h-8 text-xs bg-muted/50"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Nada Dasar</Label>
                        <Select
                          value={item.songData?.key || 'D'}
                          onValueChange={(val) =>
                            onUpdateItem({
                              songData: { ...item.songData, key: val || 'D' },
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 text-xs" data-testid="song-key-selector">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                              <SelectItem key={k} value={k}>
                                Kunci {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Background Slide</Label>
                        <Select
                          value={item.songData?.backgroundUrl || '/assets/background-navy.jpg'}
                          onValueChange={(val) =>
                            onUpdateItem({
                              songData: { ...item.songData, backgroundUrl: val || '/assets/background-navy.jpg' },
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-8 text-xs" data-testid="song-background-picker">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="/assets/background-navy.jpg">Gradient Default (Navy)</SelectItem>
                            <SelectItem value="/assets/background-sanctuary.jpg">Sanctuary Mimbar</SelectItem>
                            <SelectItem value="/assets/background-nature.jpg">Alam / Nature</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Verses Selector */}
                  <div className="space-y-3 p-3 rounded-lg bg-background/60 border border-border/60">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Bait yang Dinyanyikan
                    </h4>
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-semibold">Pilih Bait Aktif</Label>
                      <div className="flex flex-wrap items-center gap-2" data-testid="verse-checkboxes">
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
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...activeVerses, v].sort()
                                    : activeVerses.filter((x) => x !== v);
                                  onUpdateItem({
                                    songData: { ...item.songData, activeVerses: next },
                                    slidesCount: next.length,
                                  });
                                }}
                                className="w-3.5 h-3.5"
                              />
                              <span>Bait {v}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Specific Context Controls: Announcement */}
            {item.type === 'announcement' && (
              <div className="space-y-4 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5" data-testid="announcement-context-editor">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                    <Megaphone className="w-4 h-4" />
                    <span>Set Warta Jemaat (Carousel Slide)</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                      onClick={() => {
                        if (onOpenMasterLibraries) onOpenMasterLibraries('announcements');
                      }}
                      data-testid="choose-master-announcement-button"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Pilih dari Master Warta</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                      onClick={() => {
                        if (onSaveToMasterAnnouncementSet) {
                          onSaveToMasterAnnouncementSet(item);
                        } else {
                          toast.success('Koleksi flyer warta berhasil disimpan sebagai Master Warta Baru.');
                        }
                      }}
                      data-testid="save-to-master-announcement-button"
                    >
                      <span>Simpan sebagai Master Warta Baru</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                      onClick={() => setUploadFlyerModalOpen(true)}
                    >
                      <Upload className="w-3 h-3" />
                      <span>Unggah Flyer...</span>
                    </Button>
                  </div>
                </div>

                {/* 4-Slot Flyer Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="flyer-slots-grid">
                  {(item.announcementData?.flyers || [
                    { id: 'f1', title: 'Seminar Kesehatan', url: '/assets/flyer1.jpg', category: 'announcement' },
                    { id: 'f2', title: 'Perkemahan Pemuda', url: '/assets/flyer2.jpg', category: 'announcement' },
                  ]).map((flyer, idx) => (
                    <div
                      key={flyer.id}
                      className="group relative aspect-video rounded-lg border border-purple-500/30 bg-background/80 overflow-hidden flex flex-col justify-end p-2 shadow-2xs"
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
              </div>
            )}

            {/* Specific Context Controls: Sermon (SPEC-49) */}
            {item.type === 'sermon' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
                data-testid="sermon-context-editor"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                    <Presentation className="w-4 h-4" />
                    <span>Predefined Field Khotbah & Pembicara</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    onClick={() => setDutyRosterOpen(true)}
                    data-testid="open-duty-roster-button"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Pilih dari Roster Pelayan</span>
                  </Button>
                </div>

                {/* Instant Token Preview Badge */}
                <div
                  className="p-3 rounded-lg bg-background/90 border border-border/80 flex items-center gap-2 flex-wrap"
                  data-testid="sermon-speaker-token-badge"
                >
                  <span className="text-xs font-bold text-muted-foreground">Token Binding:</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                    {'{sermon_speaker}'} → {weeklyVars.sermon_speaker || item.sermonData?.speaker || 'Pdt. Pembicara'}
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                    "{weeklyVars.sermon_title || item.sermonData?.title || item.title}"
                  </span>
                </div>
              </div>
            )}

            {/* Specific Context Controls: Custom Slide (SPEC-49) */}
            {item.type === 'custom_slide' && (
              <div
                className="space-y-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5"
                data-testid="custom-slide-context-editor"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                    <FileCode className="w-4 h-4" />
                    <span>Slide Bebas (Kanvas Kustom)</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={() => setMediaGalleryOpen(true)}
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Galeri Media</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Judul Slide Bebas</Label>
                    <Input
                      value={item.customSlideData?.title || item.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem({
                          title: val,
                          customSlideData: {
                            ...item.customSlideData,
                            title: val,
                            content: item.customSlideData?.content || item.textContent || '',
                          },
                        });
                      }}
                      className="h-8 text-xs bg-background/80"
                      data-testid="custom-slide-title-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Konten / Teks Bebas (Multi-Baris)</Label>
                    <Textarea
                      value={item.customSlideData?.content || item.textContent || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateItem({
                          textContent: val,
                          customSlideData: {
                            ...item.customSlideData,
                            title: item.customSlideData?.title || item.title,
                            content: val,
                          },
                        });
                      }}
                      placeholder="Ketik lirik bebas, puisi, responsif warta, atau kutipan nats di sini..."
                      rows={4}
                      className="text-xs bg-background/80 resize-none font-mono"
                      data-testid="custom-slide-content-textarea"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auxiliary Modals & Drawers */}
      <MockupCanvasDesignerModal
        open={canvasDesignerOpen}
        onOpenChange={setCanvasDesignerOpen}
        item={item}
        onApply={(updated) => {
          onUpdateItem(updated);
          setCanvasDesignerOpen(false);
        }}
      />

      <MockupDutyRosterDrawer
        open={dutyRosterOpen}
        onOpenChange={setDutyRosterOpen}
        currentSpeaker={weeklyVars.sermon_speaker}
        onSelectSpeaker={(speakerName) => {
          if (onUpdateWeeklyVars) onUpdateWeeklyVars({ sermon_speaker: speakerName });
          toast.success(`${speakerName} ditetapkan sebagai Pengkhotbah.`);
        }}
      />

      <MockupMediaGalleryDrawer
        open={mediaGalleryOpen}
        onOpenChange={setMediaGalleryOpen}
        onSelectAsset={(assetUrl) => {
          onUpdateItem({
            canvasStyle: { ...item.canvasStyle, backgroundUrl: assetUrl },
          });
          toast.success('Background berhasil diterapkan.');
        }}
      />

      {/* Add Local Song Modal */}
      <Dialog open={addSongModalOpen} onOpenChange={setAddSongModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="add-song-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Tambah Lagu Lokal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Judul Lagu</Label>
              <Input
                value={newSongTitle}
                onChange={(e) => setNewSongTitle(e.target.value)}
                placeholder="Contoh: Indah Kasih-Nya..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nomor Lagu (Opsional)</Label>
              <Input
                value={newSongNumber}
                onChange={(e) => setNewSongNumber(e.target.value)}
                placeholder="Contoh: 145"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setAddSongModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSimulateAddSong}>
              Simpan Lagu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Flyer Modal */}
      <Dialog open={uploadFlyerModalOpen} onOpenChange={setUploadFlyerModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="upload-flyer-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Unggah Flyer Warta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Judul Acara / Warta</Label>
              <Input
                value={newFlyerTitle}
                onChange={(e) => setNewFlyerTitle(e.target.value)}
                placeholder="Contoh: Seminar Alkitab Khusus..."
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setUploadFlyerModalOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSimulateUploadFlyer}>
              Simpan Flyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Layout Configuration Modal (Slide 0) */}
      <Dialog open={isFormLayoutModalOpen} onOpenChange={setIsFormLayoutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Konfigurasi Tata Letak Formulir Ibadah</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs text-muted-foreground">
            <p>
              Sesuaikan urutan dan visibilitas kolom formulir mingguan khusus jadwal ini.
              Perubahan di sini hanya memengaruhi instance jadwal aktif tanpa mengubah skema baku kamus master (DEC-004 boundary).
            </p>
            <div className="space-y-2 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <span>Pengkhotbah & Judul Khotbah</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Aktif</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Ayat Pembacaan Pokok</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Aktif</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pemimpin Acara & Keluarga Syafaat</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Aktif</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Slot Flyer Warta Jemaat</span>
                <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Aktif</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setIsFormLayoutModalOpen(false)}>
              Tutup & Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
