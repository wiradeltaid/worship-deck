import React, { useState } from 'react';
import {
  Calendar,
  Sparkles,
  Zap,
  Play,
  Download,
  CheckCircle2,
  Layers,
  ChevronDown,
  Save,
  FolderOpen,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PRESET_OPTIONS,
  WorshipPreset,
  TimelineItem,
  TimelineItemType,
  WorkspaceStatus,
  WorkspaceMode,
  MasterPreset,
  ScheduledServiceRecord,
  SYNTHETIC_MASTER_PRESETS,
  SYNTHETIC_SCHEDULED_SERVICES,
} from '@/operator/workspace/types';
import { computePresetDate } from '@/operator/workspace/utils';
import MockupTimeline from '@/operator/workspace/MockupTimeline';
import MockupEditor from '@/operator/workspace/MockupEditor';
import MockupCanvasPreview from '@/operator/workspace/MockupCanvasPreview';
import MockupMasterPresetDrawer from '@/operator/workspace/MockupMasterPresetDrawer';
import MockupScheduleHistoryDrawer from '@/operator/workspace/MockupScheduleHistoryDrawer';
import { toast } from 'sonner';

const DEFAULT_TIMELINE_ITEMS: TimelineItem[] = [
  {
    id: 'item-1',
    type: 'general',
    title: 'Pembukaan & Ucapan Selamat Datang',
    subtitle: 'Selamat Beribadah di Sabat yang Kudus',
    duration: '09:00',
    slidesCount: 1,
    generalData: {
      notes: 'Dipimpin oleh Ketua Diaken & Tim Penyambut',
    },
  },
  {
    id: 'item-2',
    type: 'song',
    title: 'Lagu Buka — Hai Pujilah Tuhan',
    subtitle: 'SDAH 123 (Key of D)',
    duration: '09:05',
    slidesCount: 3,
    songData: {
      hymnNumber: 123,
      bookCode: 'SDAH',
      key: 'D',
      activeVerses: [1, 2, 4],
      backgroundUrl: '/assets/background-navy.jpg',
    },
  },
  {
    id: 'item-3',
    type: 'general',
    title: 'Doa Pembuka',
    subtitle: 'Doa Syafaat & Penebusan',
    duration: '09:15',
    slidesCount: 1,
    generalData: {
      speaker: 'Pnt. David Tan',
    },
  },
  {
    id: 'item-4',
    type: 'announcement',
    title: 'Warta Jemaat Mingguan',
    subtitle: '4 Slide Warta & Pengumuman',
    duration: '09:20',
    slidesCount: 4,
    announcementData: {
      looping: true,
      flyers: [
        { id: 'f1', title: 'Seminar Kesehatan & Nutrisi Nabati', url: '/assets/flyer1.jpg', category: 'announcement' },
        { id: 'f2', title: 'Perkemahan Pemuda Advent 2026', url: '/assets/flyer2.jpg', category: 'announcement' },
        { id: 'f3', title: 'Jadwal Pendalaman Alkitab Rumah Tangga', url: '/assets/flyer3.jpg', category: 'announcement' },
        { id: 'f4', title: 'Perjamuan Kudus Triwulan III', url: '/assets/flyer4.jpg', category: 'announcement' },
      ],
    },
  },
  {
    id: 'item-5',
    type: 'scripture',
    title: 'Pembacaan Alkitab — Yohanes 3:16',
    subtitle: 'Yohanes 3:16-17 (TB2)',
    duration: '09:30',
    slidesCount: 2,
  },
  {
    id: 'item-6',
    type: 'sermon',
    title: 'Khotbah — Kasih yang Mengubahkan',
    subtitle: 'Pdt. Dr. Johnathan Doe',
    duration: '09:35',
    slidesCount: 1,
    sermonData: {
      speaker: 'Pdt. Dr. Johnathan Doe',
      title: 'Kasih yang Mengubahkan',
      scriptureRef: 'Yohanes 3:16-17',
    },
  },
  {
    id: 'item-7',
    type: 'song',
    title: 'Lagu Tutup — Tuhan Allah Beserta Engkau',
    subtitle: 'SDAH 45 (Key of G)',
    duration: '10:15',
    slidesCount: 3,
    songData: {
      hymnNumber: 45,
      bookCode: 'SDAH',
      key: 'G',
      activeVerses: [1, 2, 3],
      backgroundUrl: '/assets/background-navy.jpg',
    },
  },
  {
    id: 'item-8',
    type: 'general',
    title: 'Doa Berkat & Penutup',
    subtitle: 'Berkat Apostolik',
    duration: '10:25',
    slidesCount: 1,
    generalData: {
      speaker: 'Pdt. Dr. Johnathan Doe',
    },
  },
];

export default function WorkspaceMockupPage() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('instance');
  const [isMasterPresetDrawerOpen, setIsMasterPresetDrawerOpen] = useState(false);
  const [isScheduleHistoryDrawerOpen, setIsScheduleHistoryDrawerOpen] = useState(false);
  const [scheduleRevision, setScheduleRevision] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState('10:45 WIB');

  // Shared master presets and scheduled services state
  const [masterPresets, setMasterPresets] = useState<MasterPreset[]>(SYNTHETIC_MASTER_PRESETS);
  const [scheduledServices, setScheduledServices] = useState<ScheduledServiceRecord[]>(
    SYNTHETIC_SCHEDULED_SERVICES
  );

  const [preset, setPreset] = useState<WorshipPreset>('sabbath-morning');
  const [serviceDate, setServiceDate] = useState('2026-09-19');
  const [status, setStatus] = useState<WorkspaceStatus>('ready');

  // Local instance items vs Master blueprint items isolation
  const [instanceItems, setInstanceItems] = useState<TimelineItem[]>(DEFAULT_TIMELINE_ITEMS);
  const [masterBlueprintItems, setMasterBlueprintItems] = useState<Record<string, TimelineItem[]>>({
    'sabbath-morning': JSON.parse(JSON.stringify(DEFAULT_TIMELINE_ITEMS)),
  });

  const [selectedItemId, setSelectedItemId] = useState<string>('item-1');
  const [quickScriptureOpen, setQuickScriptureOpen] = useState(false);

  // Active items depend strictly on workspaceMode
  const items =
    workspaceMode === 'instance'
      ? instanceItems
      : masterBlueprintItems[preset] || DEFAULT_TIMELINE_ITEMS;

  const setItems = (action: TimelineItem[] | ((prev: TimelineItem[]) => TimelineItem[])) => {
    if (workspaceMode === 'instance') {
      setInstanceItems(action);
    } else {
      setMasterBlueprintItems((prevMap) => {
        const currentBlueprint = prevMap[preset] || DEFAULT_TIMELINE_ITEMS;
        const nextBlueprint = typeof action === 'function' ? action(currentBlueprint) : action;
        return {
          ...prevMap,
          [preset]: nextBlueprint,
        };
      });
    }
  };

  const selectedItem =
    items.find((i) => i.id === selectedItemId) || items[0] || DEFAULT_TIMELINE_ITEMS[0];

  const currentPresetMeta =
    PRESET_OPTIONS.find((p) => p.id === preset) || PRESET_OPTIONS[0];

  const handleSaveSchedule = () => {
    setScheduleRevision((prev) => prev + 1);
    setHasUnsavedChanges(false);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    setLastSavedTime(timeStr);

    // Synchronize to scheduled services history with full items snapshot
    setScheduledServices((prev) => {
      const existingIdx = prev.findIndex(
        (s) => s.serviceDate === serviceDate && s.presetId === preset
      );
      const title =
        items.find((i) => i.type === 'sermon')?.sermonData?.title ||
        `Kebaktian ${currentPresetMeta.label}`;

      const updatedRecord: ScheduledServiceRecord = {
        id: existingIdx !== -1 ? prev[existingIdx].id : `srv-${Date.now()}`,
        presetId: preset,
        presetLabel: currentPresetMeta.label,
        serviceDate,
        serviceTitle: title,
        status,
        itemsCount: items.length,
        scheduleRevision: scheduleRevision + 1,
        updatedAt: `${serviceDate} ${timeStr}`,
        items: JSON.parse(JSON.stringify(items)),
      };

      if (existingIdx !== -1) {
        const copy = [...prev];
        copy[existingIdx] = updatedRecord;
        return copy;
      }
      return [updatedRecord, ...prev];
    });

    toast.success(
      `Jadwal ibadah berhasil disimpan & tersinkron ke Riwayat Jadwal (Revisi ${scheduleRevision + 1} • ${timeStr})`
    );
  };

  const handleOpenHistoricalService = (service: ScheduledServiceRecord) => {
    const matchedPreset = PRESET_OPTIONS.find((p) => p.id === service.presetId);
    if (matchedPreset) {
      setPreset(matchedPreset.id);
    }
    setServiceDate(service.serviceDate);
    setStatus(service.status);
    setScheduleRevision(service.scheduleRevision);

    // Restore full timeline items snapshot from historical service
    if (service.items && service.items.length > 0) {
      setInstanceItems(JSON.parse(JSON.stringify(service.items)));
      setSelectedItemId(service.items[0].id);
    }

    setHasUnsavedChanges(false);
    toast.info(`Jadwal tanggal ${service.serviceDate} berhasil dimuat ke workspace.`);
  };

  const handleSelectPreset = (newPreset: WorshipPreset) => {
    setPreset(newPreset);
    const meta = PRESET_OPTIONS.find((p) => p.id === newPreset);
    const nextDate = computePresetDate(newPreset);
    setServiceDate(nextDate);
    setHasUnsavedChanges(true);
    toast.info(`Preset diubah ke: ${meta?.label} (${nextDate} • ${meta?.defaultTime})`);
  };

  const handleAddItem = (type: TimelineItemType) => {
    const nextId = `item-${Date.now()}`;
    let newItem: TimelineItem;

    switch (type) {
      case 'song':
        newItem = {
          id: nextId,
          type: 'song',
          title: 'Lagu Baru — Bapa Surgawi',
          subtitle: 'SDAH 300',
          duration: '10:30',
          slidesCount: 3,
          songData: {
            hymnNumber: 300,
            bookCode: 'SDAH',
            key: 'F',
            activeVerses: [1, 2],
            backgroundUrl: '/assets/background-navy.jpg',
          },
        };
        break;
      case 'announcement':
        newItem = {
          id: nextId,
          type: 'announcement',
          title: 'Warta Khusus Baru',
          subtitle: '2 Slide Warta',
          duration: '10:35',
          slidesCount: 2,
          announcementData: {
            looping: true,
            flyers: [
              { id: 'f-new-1', title: 'Pengumuman Baru A', url: '/assets/flyer1.jpg', category: 'announcement' },
              { id: 'f-new-2', title: 'Pengumuman Baru B', url: '/assets/flyer2.jpg', category: 'announcement' },
            ],
          },
        };
        break;
      case 'scripture':
        newItem = {
          id: nextId,
          type: 'scripture',
          title: 'Pembacaan Firman Tambahan',
          subtitle: 'Mazmur 23:1-6 (TB2)',
          duration: '10:40',
          slidesCount: 1,
        };
        break;
      case 'sermon':
        newItem = {
          id: nextId,
          type: 'sermon',
          title: 'Renungan Tambahan',
          subtitle: 'Pnt. Pembicara Tamu',
          duration: '10:45',
          slidesCount: 1,
          sermonData: {
            speaker: 'Pnt. Pembicara Tamu',
            title: 'Renungan Tambahan',
            scriptureRef: 'Mazmur 23',
          },
        };
        break;
      case 'custom_slide':
        newItem = {
          id: nextId,
          type: 'custom_slide',
          title: 'Slide Bebas Baru',
          subtitle: 'Kustom Konten',
          duration: '10:50',
          slidesCount: 1,
          customSlideData: {
            title: 'Slide Bebas Baru',
            content: 'Ketik nats, puisi, atau responsif warta di sini...',
            subtitle: 'Kustom Konten',
            backgroundUrl: '/assets/background-navy.jpg',
            style: {
              alignment: 'center',
              fontSize: 28,
              color: 'white',
            },
          },
        };
        break;
      case 'general':
      default:
        newItem = {
          id: nextId,
          type: 'general',
          title: 'Custom Slide Baru',
          subtitle: 'Pengumuman Acara',
          duration: '10:50',
          slidesCount: 1,
        };
        break;
    }

    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(nextId);
    setHasUnsavedChanges(true);
    toast.success(`Berhasil menambahkan ${newItem.title} ke timeline!`);
  };

  const handleUpdateCurrentItem = (updated: Partial<TimelineItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === selectedItemId ? { ...it, ...updated } : it))
    );
    setHasUnsavedChanges(true);
  };

  const handleMoveItem = (id: string, direction: 'up' | 'down') => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  return (
    <div
      data-testid="workspace-mockup"
      className="flex flex-col gap-4 w-full min-h-[calc(100vh-140px)]"
    >
      {/* Top Workspace Navigation Bar: Mode Switcher & History / Master Preset Management */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1">
        {/* Workspace Mode Switcher */}
        <div
          data-testid="workspace-mode-switcher"
          className="flex items-center gap-1 p-1 bg-card/90 rounded-xl border border-border shadow-2xs"
          role="tablist"
          aria-label="Mode Workspace"
        >
          <Button
            type="button"
            role="tab"
            variant="ghost"
            size="sm"
            aria-selected={workspaceMode === 'instance'}
            onClick={() => {
              setWorkspaceMode('instance');
              toast.info('Beralih ke Mode: Jadwal Ibadah (Instance Operasional)');
            }}
            className={`h-8 text-xs font-bold gap-1.5 rounded-lg px-3 transition-colors ${
              workspaceMode === 'instance'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="mode-instance-button"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>● Jadwal Ibadah (Instance)</span>
          </Button>

          <Button
            type="button"
            role="tab"
            variant="ghost"
            size="sm"
            aria-selected={workspaceMode === 'master_preset'}
            onClick={() => {
              setWorkspaceMode('master_preset');
              toast.info('Beralih ke Mode: Master Preset Builder (Cetak Biru Baku)');
            }}
            className={`h-8 text-xs font-bold gap-1.5 rounded-lg px-3 transition-colors ${
              workspaceMode === 'master_preset'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid="mode-master-preset-button"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>○ Master Preset Builder</span>
          </Button>
        </div>

        {/* Global Toolbar: History & Master Preset Drawers */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsScheduleHistoryDrawerOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="schedule-history-drawer-button"
          >
            <FolderOpen className="w-3.5 h-3.5 text-primary" />
            <span>📂 Riwayat Jadwal</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMasterPresetDrawerOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="manage-presets-button"
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>⚙️ Kelola Master Preset</span>
          </Button>
        </div>
      </div>

      {/* Mode Information & Local Override Isolation Banner */}
      {workspaceMode === 'master_preset' ? (
        <div
          data-testid="master-preset-banner"
          className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 flex-wrap animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Mode Master Preset Builder Aktif — Blueprint: {currentPresetMeta.label}
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                Perubahan pada susunan timeline dan konfigurasi slide di sini menjadi cetak biru baku bagi seluruh jadwal ibadah mendatang.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
            onClick={() => setIsMasterPresetDrawerOpen(true)}
          >
            Buka Daftar Master Preset
          </Button>
        </div>
      ) : (
        <div
          data-testid="local-override-isolation-badge"
          className="px-3.5 py-2 rounded-xl bg-card/60 border border-border/80 text-[11px] text-muted-foreground flex items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Perubahan lokal pada jadwal ini tidak mengubah master preset{' '}
              <strong className="text-foreground font-semibold">"{currentPresetMeta.label}"</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-semibold">
              Revisi: rev.{scheduleRevision}
            </span>
            <span className="text-muted-foreground">
              {hasUnsavedChanges ? '● Belum Disimpan' : `✓ ${lastSavedTime}`}
            </span>
          </div>
        </div>
      )}

      {/* Top Workspace Header Bar */}
      <div
        data-testid="workspace-header-bar"
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-card/80 backdrop-blur-md border border-border/80 shadow-xs"
      >
        {/* Preset Selector & Date Picker */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Dropdown */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Preset Ibadah
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-between rounded-md border border-input bg-background/90 hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                data-testid="preset-selector-dropdown"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{currentPresetMeta.label}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {PRESET_OPTIONS.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    data-testid={`preset-option-${p.id}`}
                    onClick={() => handleSelectPreset(p.id)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-xs text-foreground">
                        {p.label}
                      </span>
                      {p.id === preset && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {p.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Service Date & Time Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Tanggal & Waktu Ibadah
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => {
                  setServiceDate(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="h-9 text-xs px-3 rounded-lg border border-border bg-background/90 font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                data-testid="service-date-input"
              />
              <span
                className="h-9 px-2.5 rounded-lg border border-border bg-muted/40 text-[11px] font-mono font-semibold flex items-center text-muted-foreground"
                data-testid="preset-default-time-badge"
              >
                {currentPresetMeta.defaultTime}
              </span>
            </div>
          </div>

          {/* Status Badge (Accessible Radio Buttons) */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Status Jadwal
            </span>
            <div
              className="flex items-center gap-1.5"
              role="radiogroup"
              aria-label="Status Jadwal Ibadah"
              data-testid="status-badges-group"
            >
              <Button
                type="button"
                role="radio"
                variant="ghost"
                aria-checked={status === 'draft'}
                onClick={() => {
                  setStatus('draft');
                  setHasUnsavedChanges(true);
                }}
                className={`h-auto text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  status === 'draft'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
                }`}
                data-testid="status-badge-draft"
              >
                Draft
              </Button>
              <Button
                type="button"
                role="radio"
                variant="ghost"
                aria-checked={status === 'ready'}
                onClick={() => {
                  setStatus('ready');
                  setHasUnsavedChanges(true);
                }}
                className={`h-auto text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  status === 'ready'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50 shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
                }`}
                data-testid="status-badge-ready"
              >
                Siap Tayang
              </Button>
              <Button
                type="button"
                role="radio"
                variant="ghost"
                aria-checked={status === 'live'}
                onClick={() => {
                  setStatus('live');
                  setHasUnsavedChanges(true);
                }}
                className={`h-auto text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  status === 'live'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50 shadow-xs animate-pulse'
                    : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
                }`}
                data-testid="status-badge-live"
              >
                ● Live
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Scripture Modal Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs font-semibold gap-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            onClick={() => setQuickScriptureOpen(true)}
            data-testid="quick-verse-header-button"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Ayat Cepat</span>
          </Button>

          {/* Live Presentation Button */}
          <Button
            size="sm"
            className="h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
            onClick={() => {
              toast.success('Simulasi Presenter Window dibuka di monitor proyektor');
              setStatus('live');
            }}
            data-testid="live-present-header-button"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>▶ Tayangkan</span>
          </Button>

          {/* PPTX Export Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs font-semibold gap-1.5"
            onClick={() => {
              toast.success('Simulasi: Mengunduh deck presentasi PPTX widescreen 16:9');
            }}
            data-testid="pptx-export-header-button"
          >
            <Download className="w-3.5 h-3.5" />
            <span>⬇ Unduh PPTX</span>
          </Button>

          {/* Explicit Save Schedule Action */}
          <Button
            size="sm"
            variant={hasUnsavedChanges ? 'default' : 'outline'}
            className="h-9 text-xs font-bold gap-1.5"
            onClick={handleSaveSchedule}
            data-testid="save-schedule-button"
          >
            <Save className="w-3.5 h-3.5" />
            <span>💾 Simpan Jadwal</span>
          </Button>

          {/* Auto-Save Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 text-[11px] font-mono font-medium text-muted-foreground"
            data-testid="auto-save-indicator"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                hasUnsavedChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span>
              {hasUnsavedChanges
                ? `Ada perubahan belum disimpan (rev. ${scheduleRevision})`
                : `Tersimpan otomatis ${lastSavedTime} (rev. ${scheduleRevision})`}
            </span>
          </div>

          {/* Sync Status Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400"
            data-testid="sync-status-indicator"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Tersinkron</span>
          </div>
        </div>
      </div>

      {/* Blank Slate Workflow Banner for Non-Preset */}
      {preset === 'custom-non-preset' && (
        <div
          className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 flex-wrap"
          data-testid="blank-slate-banner"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Mode Jadwal Bebas (Non-Preset) Aktif
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Mulai dari jadwal kosong untuk menyusun urutan ibadah mandiri tanpa template bawaan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => {
                setItems([]);
                setSelectedItemId('');
                toast.success('Jadwal ibadah dikosongkan (Blank Slate)');
              }}
              data-testid="blank-slate-clear-button"
            >
              Mulai dari Jadwal Kosong (Blank Slate)
            </Button>
            {items.length === 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setItems(DEFAULT_TIMELINE_ITEMS);
                  setSelectedItemId('item-1');
                  toast.success('Template contoh dimuat');
                }}
                data-testid="blank-slate-load-sample-button"
              >
                Gunakan Template Contoh
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 3-Panel Unified Workspace Layout with Strict Enforced Pixel Widths */}
      <div
        className="flex flex-col lg:flex-row gap-4 flex-1 items-start w-full"
        data-testid="three-panel-container"
      >
        {/* Left Panel: Run Sheet Timeline (300px - 340px) */}
        <div className="w-full lg:w-[320px] lg:min-w-[300px] lg:max-w-[340px] shrink-0 h-[720px]">
          <MockupTimeline
            items={items}
            selectedId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onAddItem={handleAddItem}
            onMoveItem={handleMoveItem}
          />
        </div>

        {/* Center Panel: In-Place Contextual Editor (fluid width) */}
        <div className="flex-1 min-w-0 h-[720px] w-full">
          <MockupEditor
            item={selectedItem}
            onUpdateItem={handleUpdateCurrentItem}
            onReplaceItems={(newItems) => {
              setItems(newItems);
              setHasUnsavedChanges(true);
              if (newItems.length > 0) {
                setSelectedItemId(newItems[0].id);
              }
            }}
          />
        </div>

        {/* Right Panel: Sticky Live Canvas Preview & Quick Tools (400px - 460px) */}
        <div className="w-full lg:w-[440px] lg:min-w-[400px] lg:max-w-[460px] shrink-0 h-[720px] sticky top-4">
          <MockupCanvasPreview
            item={selectedItem}
            quickScriptureOpen={quickScriptureOpen}
            onSetQuickScriptureOpen={setQuickScriptureOpen}
            onUpdateItem={handleUpdateCurrentItem}
          />
        </div>
      </div>

      {/* Master Preset Management Drawer */}
      <MockupMasterPresetDrawer
        isOpen={isMasterPresetDrawerOpen}
        onClose={() => setIsMasterPresetDrawerOpen(false)}
        presets={masterPresets}
        onUpdatePresets={setMasterPresets}
        scheduledServices={scheduledServices}
        onSelectPresetForBlueprint={(p) => {
          const matched = PRESET_OPTIONS.find((opt) => opt.id === p.slug);
          if (matched) {
            setPreset(matched.id);
          }
          setWorkspaceMode('master_preset');
          toast.info(`Memuat cetak biru: ${p.title}`);
        }}
      />

      {/* Schedule History Drawer */}
      <MockupScheduleHistoryDrawer
        isOpen={isScheduleHistoryDrawerOpen}
        onClose={() => setIsScheduleHistoryDrawerOpen(false)}
        services={scheduledServices}
        onUpdateServices={setScheduledServices}
        onOpenService={handleOpenHistoricalService}
      />
    </div>
  );
}
