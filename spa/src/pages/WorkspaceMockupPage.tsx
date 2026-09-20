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
  ShieldAlert,
  RotateCcw,
  Tag,
  Smartphone,
  Settings,
  Plus,
  Copy,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PRESET_OPTIONS,
  WorshipPreset,
  PresetOption,
  TimelineItem,
  TimelineItemType,
  WorkspaceStatus,
  WorkspaceMode,
  MasterPreset,
  ScheduledServiceRecord,
  SYNTHETIC_MASTER_PRESETS,
  SYNTHETIC_SCHEDULED_SERVICES,
  CustomSlideType,
  resolveSyncConflict,
  SyncAggregatePayload,
  createPinnedSlide0,
  PINNED_SLIDE_0_ID,
  sanitizeScheduleToPreset,
  WeeklyVariables,
  DEFAULT_WEEKLY_VARIABLES,
} from '@/operator/workspace/types';
import { computePresetDate } from '@/operator/workspace/utils';
import MockupTimeline from '@/operator/workspace/MockupTimeline';
import MockupEditor from '@/operator/workspace/MockupEditor';
import MockupCanvasPreview from '@/operator/workspace/MockupCanvasPreview';
import MockupMasterPresetDrawer from '@/operator/workspace/MockupMasterPresetDrawer';
import MockupScheduleHistoryDrawer from '@/operator/workspace/MockupScheduleHistoryDrawer';
import MockupMasterLibrariesDrawer, {
  MasterSongSet,
  MasterAnnouncementSet,
  PredefinedToken,
  SYNTHETIC_MASTER_SONG_SETS,
  SYNTHETIC_MASTER_ANNOUNCEMENT_SETS,
  SYNTHETIC_PREDEFINED_TOKENS,
} from '@/operator/workspace/MockupMasterLibrariesDrawer';
import MockupRemotePairingModal from '@/operator/workspace/MockupRemotePairingModal';
import MockupSyncDialog from '@/operator/workspace/MockupSyncDialog';
import MockupSettingsDrawer from '@/operator/workspace/MockupSettingsDrawer';
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
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [isLivenessGuardOpen, setIsLivenessGuardOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [pendingLiveAction, setPendingLiveAction] = useState<(() => void) | null>(null);
  const [scheduleRevision, setScheduleRevision] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState('10:45 WIB');

  const [isMasterLibrariesDrawerOpen, setIsMasterLibrariesDrawerOpen] = useState(false);
  const [masterLibrariesTab, setMasterLibrariesTab] = useState<'song_sets' | 'announcements' | 'tokens'>('song_sets');

  // Shared master presets and scheduled services state
  const [masterPresets, setMasterPresets] = useState<MasterPreset[]>(SYNTHETIC_MASTER_PRESETS);
  const [scheduledServices, setScheduledServices] = useState<ScheduledServiceRecord[]>(
    SYNTHETIC_SCHEDULED_SERVICES
  );

  // Reusable Master Libraries State
  const [masterSongSets, setMasterSongSets] = useState<MasterSongSet[]>(SYNTHETIC_MASTER_SONG_SETS);
  const [masterAnnouncementSets, setMasterAnnouncementSets] = useState<MasterAnnouncementSet[]>(
    SYNTHETIC_MASTER_ANNOUNCEMENT_SETS
  );
  const [predefinedTokens, setPredefinedTokens] = useState<PredefinedToken[]>(
    SYNTHETIC_PREDEFINED_TOKENS
  );
  const [customSlideTypes, setCustomSlideTypes] = useState<CustomSlideType[]>([]);

  const [preset, setPreset] = useState<WorshipPreset>('sabbath-morning');
  const [serviceDate, setServiceDate] = useState('2026-09-19');
  const [status, setStatus] = useState<WorkspaceStatus>('ready');

  // Slide 0 weekly variables state
  const [weeklyVars, setWeeklyVars] = useState<WeeklyVariables>(DEFAULT_WEEKLY_VARIABLES);

  // Local instance items vs Master blueprint items isolation
  const [instanceItems, setInstanceItems] = useState<TimelineItem[]>([
    createPinnedSlide0(),
    ...DEFAULT_TIMELINE_ITEMS,
  ]);
  const [masterBlueprintItems, setMasterBlueprintItems] = useState<Record<string, TimelineItem[]>>({
    'sabbath-morning': JSON.parse(JSON.stringify(DEFAULT_TIMELINE_ITEMS)),
  });

  const [selectedItemId, setSelectedItemId] = useState<string>('item-1');
  const [quickScriptureOpen, setQuickScriptureOpen] = useState(false);

  // Modal & Dialog states for SPEC-52 lifecycle
  const [isCopyPresetDialogOpen, setIsCopyPresetDialogOpen] = useState(false);
  const [isOverwriteWarningOpen, setIsOverwriteWarningOpen] = useState(false);
  const [presetToCopy, setPresetToCopy] = useState<MasterPreset | PresetOption | null>(null);
  const [isNewScheduleConfirmOpen, setIsNewScheduleConfirmOpen] = useState(false);
  const [isSaveAsPresetModalOpen, setIsSaveAsPresetModalOpen] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

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

  const handleNewScheduleClick = () => {
    const regularItems = instanceItems.filter((i) => i.id !== PINNED_SLIDE_0_ID);
    if (regularItems.length > 0 || hasUnsavedChanges) {
      setIsNewScheduleConfirmOpen(true);
    } else {
      setInstanceItems([createPinnedSlide0(DEFAULT_WEEKLY_VARIABLES)]);
      setWeeklyVars(DEFAULT_WEEKLY_VARIABLES);
      setSelectedItemId(PINNED_SLIDE_0_ID);
      setHasUnsavedChanges(false);
      toast.info('Jadwal baru dimulai dari Slide 0.');
    }
  };

  const handleSelectPresetToCopy = (targetPreset: MasterPreset | PresetOption) => {
    const regularItems = instanceItems.filter((i) => i.id !== PINNED_SLIDE_0_ID);
    if (regularItems.length > 0 || hasUnsavedChanges) {
      setPresetToCopy(targetPreset);
      setIsOverwriteWarningOpen(true);
      return;
    }
    executePresetCopy(targetPreset);
  };

  const executePresetCopy = (targetPreset: MasterPreset | PresetOption) => {
    const targetKey = 'slug' in targetPreset ? targetPreset.slug : targetPreset.id;
    const blueprint = masterBlueprintItems[targetKey] || DEFAULT_TIMELINE_ITEMS;
    const copiedSlides = JSON.parse(
      JSON.stringify(blueprint.filter((i) => i.id !== PINNED_SLIDE_0_ID))
    );
    const nextItems = [createPinnedSlide0(weeklyVars), ...copiedSlides];
    setInstanceItems(nextItems);
    const matched = PRESET_OPTIONS.find((p) => p.id === targetKey);
    if (matched) {
      setPreset(matched.id);
    }
    setSelectedItemId(PINNED_SLIDE_0_ID);
    setHasUnsavedChanges(true);
    setIsOverwriteWarningOpen(false);
    setIsCopyPresetDialogOpen(false);
    toast.success(
      `Cetak biru preset "${'title' in targetPreset ? targetPreset.title : targetPreset.label}" berhasil disalin ke jadwal aktif.`
    );
  };

  const handleSelectMasterSongSet = (songSet: MasterSongSet) => {
    if (songSet.songs.length === 0) return;
    const first = songSet.songs[0];
    handleUpdateCurrentItem({
      title: `Lagu — ${first.title}`,
      subtitle: `${first.bookCode} ${first.hymnNumber} (Key of ${first.key}) • Master: ${songSet.title}`,
      masterSongSetId: songSet.id,
      masterSongSetTitle: songSet.title,
      isMasterBound: true,
      songData: {
        hymnNumber: first.hymnNumber,
        bookCode: first.bookCode,
        key: first.key,
        activeVerses: [...first.activeVerses],
        backgroundUrl: '/assets/background-navy.jpg',
      },
    });

    // If song set has additional songs, append them to the timeline preserving frozen snapshot
    if (songSet.songs.length > 1) {
      const additionalItems: TimelineItem[] = songSet.songs.slice(1).map((s, idx) => ({
        id: `item-${Date.now()}-${idx + 1}`,
        type: 'song',
        title: `Lagu — ${s.title}`,
        subtitle: `${s.bookCode} ${s.hymnNumber} (Key of ${s.key}) • Master: ${songSet.title}`,
        duration: '10:00',
        slidesCount: s.activeVerses.length || 3,
        masterSongSetId: songSet.id,
        masterSongSetTitle: songSet.title,
        isMasterBound: true,
        songData: {
          hymnNumber: s.hymnNumber,
          bookCode: s.bookCode,
          key: s.key,
          activeVerses: [...s.activeVerses],
          backgroundUrl: '/assets/background-navy.jpg',
        },
      }));
      setItems((prev) => [...prev, ...additionalItems]);
    }

    setHasUnsavedChanges(true);
    toast.success(`Master Songset "${songSet.title}" (${songSet.songs.length} lagu) terikat ke timeline.`);
  };

  const handleSelectMasterAnnouncementSet = (announcementSet: MasterAnnouncementSet) => {
    handleUpdateCurrentItem({
      title: announcementSet.title,
      subtitle: `${announcementSet.flyersCount} Slide Warta (Master: ${announcementSet.title})`,
      slidesCount: announcementSet.flyersCount,
      masterAnnouncementSetId: announcementSet.id,
      masterAnnouncementSetTitle: announcementSet.title,
      isMasterBound: true,
      announcementData: {
        looping: announcementSet.looping,
        flyers: announcementSet.flyers.map((f) => ({ ...f })),
      },
    });
    setHasUnsavedChanges(true);
    toast.success(`Master Warta "${announcementSet.title}" terikat ke timeline.`);
  };

  const handleSaveToMasterSongSet = (songItem: TimelineItem) => {
    const newMasterSet: MasterSongSet = {
      id: `mss-${Date.now()}`,
      title: `Koleksi ${songItem.title}`,
      description: `Disimpan dari jadwal ${serviceDate}`,
      usageCount: 1,
      songs: [
        {
          id: `s-${Date.now()}`,
          title: songItem.title,
          bookCode: songItem.songData?.bookCode || 'SDAH',
          hymnNumber: songItem.songData?.hymnNumber || 100,
          key: songItem.songData?.key || 'D',
          activeVerses: songItem.songData?.activeVerses || [1, 2, 3],
        },
      ],
    };
    setMasterSongSets((prev) => [newMasterSet, ...prev]);
    toast.success(`Lagu "${songItem.title}" berhasil didaftarkan ke Master Songset.`);
  };

  const handleSaveToMasterAnnouncementSet = (announcementItem: TimelineItem) => {
    const flyers = announcementItem.announcementData?.flyers || [];
    const newMasterSet: MasterAnnouncementSet = {
      id: `mas-${Date.now()}`,
      title: announcementItem.title || 'Warta Jemaat Baru',
      flyersCount: flyers.length,
      looping: announcementItem.announcementData?.looping ?? true,
      updatedAt: serviceDate,
      flyers: flyers.map((f) => ({ ...f })),
    };
    setMasterAnnouncementSets((prev) => [newMasterSet, ...prev]);
    toast.success(`Warta "${newMasterSet.title}" berhasil didaftarkan ke Master Warta.`);
  };

  const handleSaveAsNewSlideType = (newType: {
    title: string;
    category: string;
    canvasStyle: any;
  }) => {
    const created: CustomSlideType = {
      id: `cst-${Date.now()}`,
      title: newType.title,
      category: newType.category,
      canvasStyle: newType.canvasStyle,
      createdAt: serviceDate,
    };
    setCustomSlideTypes((prev) => [created, ...prev]);
    toast.success(`Tipe slide baru "${created.title}" berhasil didaftarkan ke master katalog.`);
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
    const applyMove = () => {
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

    if (status === 'live') {
      // Defer mutation until confirmed by operator
      setPendingLiveAction(() => applyMove);
      setIsLivenessGuardOpen(true);
    } else {
      applyMove();
    }
  };

  return (
    <div
      data-testid="workspace-mockup"
      className="w-full max-w-[2560px] mx-auto px-4 2xl:px-8 py-3 flex flex-col gap-4"
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsScheduleHistoryDrawerOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="schedule-history-drawer-button"
          >
            <FolderOpen className="w-3.5 h-3.5 text-primary" />
            <span>📂 Muat Jadwal</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSaveAsPresetModalOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            data-testid="save-as-preset-button"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>✨ Simpan sebagai Preset Baru</span>
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

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMasterLibrariesTab('tokens');
              setIsMasterLibrariesDrawerOpen(true);
            }}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="predefined-fields-drawer-button"
            data-drawer="master-libraries"
          >
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span data-testid="master-libraries-drawer-button">🏷️ Kamus Variabel & Master</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsDrawerOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="workspace-settings-button"
          >
            <Settings className="w-3.5 h-3.5 text-primary" />
            <span>⚙️ Pengaturan</span>
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

      {/* Top Workspace Header Bar (1920 Full HD Consolidated AV Command Center) */}
      <div
        data-testid="workspace-header-bar"
        className="flex flex-col 2xl:flex-row items-start 2xl:items-center justify-between gap-4 p-4 rounded-2xl bg-card/80 backdrop-blur-md border border-border/80 shadow-xs"
      >
        {/* Zone A: Primary Schedule Navigation & Lifecycle Controls */}
        <div data-testid="command-zone-a" className="flex flex-wrap items-center gap-3">
          {/* Action Buttons: New, Load, Copy Preset */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Navigasi Jadwal & Preset
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNewScheduleClick}
                className="h-9 text-xs font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10 shadow-2xs"
                data-testid="new-schedule-button"
                title="Buka jadwal bersih baru (Slide 0)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Jadwal Baru</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsScheduleHistoryDrawerOpen(true)}
                className="h-9 text-xs font-semibold gap-1.5 shadow-2xs"
                data-testid="load-schedule-button"
                title="Cari dan buka jadwal tersimpan"
              >
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                <span>Muat Jadwal</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCopyPresetDialogOpen(true)}
                className="h-9 text-xs font-semibold gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 shadow-2xs"
                data-testid="copy-preset-button"
                title="Salin susunan slide dari cetak biru master preset"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Preset</span>
              </Button>
            </div>
          </div>

          {/* Service Date & Time Selector */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Tanggal & Waktu Ibadah
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => {
                  setServiceDate(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="h-9 text-xs px-3 font-medium"
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

        {/* Zone B: Realtime Monitoring & Quick Injections */}
        <div data-testid="command-zone-b" className="flex flex-wrap items-center gap-2">
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

          {/* Sync Status Trigger */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsSyncDialogOpen(true)}
            className="flex items-center gap-1.5 h-auto px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 hover:bg-muted transition-colors cursor-pointer"
            data-testid="sync-status-indicator"
            title="Buka Status & Resolusi Sinkronisasi Desktop-ke-Web"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Tersinkron</span>
          </Button>

          {/* Auto-Save & Save Revision Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/80 text-[11px] font-mono font-medium text-muted-foreground"
            data-testid="save-revision-indicator"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                hasUnsavedChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span data-testid="auto-save-indicator">
              {hasUnsavedChanges
                ? `Ada perubahan belum disimpan (rev. ${scheduleRevision})`
                : `Tersimpan otomatis ${lastSavedTime} (rev. ${scheduleRevision})`}
            </span>
          </div>
        </div>

        {/* Zone C: Live Presentation & Actions */}
        <div data-testid="command-zone-c" className="flex flex-wrap items-center gap-2">
          {/* Remote Control Pairing Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs font-semibold gap-1.5 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
            onClick={() => setIsRemoteModalOpen(true)}
            data-testid="remote-control-header-button"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>📱 Remote</span>
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

      {/* 3-Panel Unified Workspace Layout with 1920 Full HD Responsive Baseline */}
      <div
        className="flex flex-col lg:flex-row gap-4 flex-1 items-start w-full h-[calc(100vh-175px)] min-h-[560px] 2xl:min-h-[700px] max-h-[1200px]"
        data-testid="three-panel-container"
      >
        {/* Left Panel: Run Sheet Timeline (300px - 340px on lg / 2xl:400px) */}
        <div className="w-full lg:w-[320px] lg:min-w-[300px] lg:max-w-[340px] 2xl:w-[400px] shrink-0 h-full flex flex-col">
          <MockupTimeline
            items={items}
            selectedId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onAddItem={handleAddItem}
            onMoveItem={handleMoveItem}
          />
        </div>

        {/* Center Panel: In-Place Contextual Editor (fluid min-w 0 / 2xl:min-w-[600px] max-w-[900px]) */}
        <div className="flex-1 min-w-0 2xl:min-w-[600px] max-w-[900px] h-full overflow-y-auto w-full">
          <MockupEditor
            item={selectedItem}
            weeklyVars={weeklyVars}
            onUpdateWeeklyVars={(updated) => {
              setWeeklyVars((prev) => ({ ...prev, ...updated }));
              setHasUnsavedChanges(true);
            }}
            onUpdateItem={handleUpdateCurrentItem}
            onReplaceItems={(newItems) => {
              const withSlide0 = [createPinnedSlide0(weeklyVars), ...newItems];
              setItems(withSlide0);
              setHasUnsavedChanges(true);
              setSelectedItemId(newItems[0]?.id || PINNED_SLIDE_0_ID);
            }}
            onOpenMasterLibraries={(tab) => {
              setMasterLibrariesTab(tab);
              setIsMasterLibrariesDrawerOpen(true);
            }}
            onSaveToMasterSongSet={handleSaveToMasterSongSet}
            onSaveToMasterAnnouncementSet={handleSaveToMasterAnnouncementSet}
            onDetachMasterSongSet={(songItem) => {
              handleUpdateCurrentItem({
                masterSongSetId: null,
                masterSongSetTitle: undefined,
                isMasterBound: false,
                songData: songItem.songData ? JSON.parse(JSON.stringify(songItem.songData)) : undefined,
              });
              setHasUnsavedChanges(true);
              toast.success('Lagu telah dilepas (detached) dari Master Songset.');
            }}
            onDetachMasterAnnouncementSet={(announcementItem) => {
              handleUpdateCurrentItem({
                masterAnnouncementSetId: null,
                masterAnnouncementSetTitle: undefined,
                isMasterBound: false,
                announcementData: announcementItem.announcementData
                  ? JSON.parse(JSON.stringify(announcementItem.announcementData))
                  : undefined,
              });
              setHasUnsavedChanges(true);
              toast.success('Warta telah dilepas (detached) dari Master Warta.');
            }}
          />
        </div>

        {/* Right Panel: Sticky Live Canvas Preview & Quick Tools (400px - 460px on lg / 2xl:580px) */}
        <div className="w-full lg:w-[440px] lg:min-w-[400px] lg:max-w-[460px] 2xl:w-[580px] shrink-0 h-full flex flex-col sticky top-4">
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

      {/* Master Libraries & Predefined Fields Drawer */}
      <MockupMasterLibrariesDrawer
        isOpen={isMasterLibrariesDrawerOpen}
        onClose={() => setIsMasterLibrariesDrawerOpen(false)}
        defaultTab={masterLibrariesTab}
        songSets={masterSongSets}
        onUpdateSongSets={setMasterSongSets}
        announcementSets={masterAnnouncementSets}
        onUpdateAnnouncementSets={setMasterAnnouncementSets}
        tokens={predefinedTokens}
        onUpdateTokens={setPredefinedTokens}
        onSelectSongSet={handleSelectMasterSongSet}
        onSelectAnnouncementSet={handleSelectMasterAnnouncementSet}
      />

      {/* Remote Control Pairing Modal */}
      <MockupRemotePairingModal
        open={isRemoteModalOpen}
        onOpenChange={setIsRemoteModalOpen}
        serviceId={serviceDate}
      />

      {/* Presenter Liveness Guard Confirmation Dialog */}
      {isLivenessGuardOpen && (
        <div
          data-testid="presenter-liveness-guard-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md bg-card border border-destructive/40 rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2.5 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-bold text-foreground">
                Peringatan: Presenter Liveness Guard Aktif
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Presentasi saat ini sedang tayang langsung di monitor proyektor (Status:{' '}
              <strong className="text-rose-500">Live</strong>). Mengubah struktur atau urutan
              jadwal saat ini akan langsung disinkronkan secara real-time ke proyektor jemaat.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingLiveAction(null);
                  setIsLivenessGuardOpen(false);
                  toast.info('Perubahan dibatalkan. Struktur timeline tidak berubah.');
                }}
                className="h-8 text-xs font-semibold"
              >
                Batalkan Perubahan
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (pendingLiveAction) {
                    pendingLiveAction();
                  }
                  setPendingLiveAction(null);
                  setIsLivenessGuardOpen(false);
                  toast.warning('Perubahan disinkronkan ke live presentation.');
                }}
                className="h-8 text-xs font-semibold"
              >
                Lanjutkan & Siarkan Live
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop-to-Web Sync & Conflict Resolver Dialog */}
      <MockupSyncDialog
        open={isSyncDialogOpen}
        onOpenChange={setIsSyncDialogOpen}
        localRevision={scheduleRevision}
        serverRevision={scheduleRevision + 1}
        serviceTitle={currentPresetMeta.label}
        serviceDate={serviceDate}
        onResolveConflict={(strategy) => {
          const localPayload: SyncAggregatePayload = {
            serviceId: serviceDate,
            revision: scheduleRevision,
            serviceDate,
            serviceTitle: currentPresetMeta.label,
            items: [...items],
            schemaVersion: 1,
          };
          const serverPayload: SyncAggregatePayload = {
            serviceId: serviceDate,
            revision: scheduleRevision + 1,
            serviceDate,
            serviceTitle: currentPresetMeta.label,
            items: [...items],
            schemaVersion: 1,
          };

          const resolved = resolveSyncConflict(strategy, localPayload, serverPayload);
          if (strategy === 'local') {
            setScheduleRevision(resolved.revision);
            setHasUnsavedChanges(false);
          } else if (strategy === 'server') {
            setInstanceItems(resolved.items);
            setScheduleRevision(resolved.revision);
            setHasUnsavedChanges(false);
          } else if (strategy === 'fork') {
            const nextDate = computePresetDate(preset, new Date(Date.now() + 86400000 * 7));
            setServiceDate(nextDate);
            setScheduleRevision(1);
            setHasUnsavedChanges(false);
          }
        }}
      />

      {/* In-Workspace Settings & Administration Drawer */}
      <MockupSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
      />

      {/* Copy Preset Dialog (Ticket 01) */}
      <Dialog open={isCopyPresetDialogOpen} onOpenChange={setIsCopyPresetDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="copy-preset-modal">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Copy className="w-4 h-4" />
              <span>Salin Cetak Biru Master Preset</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">
              Pilih master preset untuk menyalin susunan slide ke jadwal aktif saat ini:
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {masterPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPresetToCopy(p)}
                  className="w-full text-left p-2.5 rounded-lg border border-border/80 bg-background hover:bg-muted/60 transition-colors flex items-center justify-between cursor-pointer"
                  data-testid={`select-preset-to-copy-${p.id}`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{p.title}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {p.defaultTime}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setIsCopyPresetDialogOpen(false)}>
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overwrite Warning Modal (Ticket 01) */}
      <Dialog open={isOverwriteWarningOpen} onOpenChange={setIsOverwriteWarningOpen}>
        <DialogContent className="sm:max-w-md" data-testid="overwrite-warning-modal">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span>Konfirmasi Timpa Susunan Slide Jadwal</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Menyalin preset akan menggantikan susunan slide jadwal aktif saat ini. Seluruh slide yang ada akan ditimpa dengan cetak biru preset. Lanjutkan?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOverwriteWarningOpen(false)}
              data-testid="overwrite-cancel-button"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (presetToCopy) executePresetCopy(presetToCopy);
              }}
              data-testid="overwrite-confirm-button"
            >
              Gantikan Slide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Schedule Confirmation Modal */}
      <Dialog open={isNewScheduleConfirmOpen} onOpenChange={setIsNewScheduleConfirmOpen}>
        <DialogContent className="sm:max-w-md" data-testid="new-schedule-confirm-modal">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <RotateCcw className="w-4 h-4" />
              <span>Buat Jadwal Baru (Reset ke Slide 0)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Membuat jadwal baru akan mengosongkan seluruh slide dan memulai jadwal bersih dari Slide 0. Perubahan yang belum disimpan akan hilang. Lanjutkan?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsNewScheduleConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                setInstanceItems([createPinnedSlide0(DEFAULT_WEEKLY_VARIABLES)]);
                setWeeklyVars(DEFAULT_WEEKLY_VARIABLES);
                setSelectedItemId(PINNED_SLIDE_0_ID);
                setHasUnsavedChanges(false);
                setIsNewScheduleConfirmOpen(false);
                toast.success('Jadwal baru berhasil dibuat. Fokus pada Slide 0 Rundown Hub.');
              }}
              data-testid="confirm-new-schedule-button"
            >
              Buat Jadwal Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as Preset Modal with Sanitizer (Ticket 01) */}
      <Dialog open={isSaveAsPresetModalOpen} onOpenChange={setIsSaveAsPresetModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="save-as-preset-modal">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4" />
              <span>Simpan sebagai Master Preset Baru</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Jadwal aktif saat ini akan disanitasi secara otomatis: urutan slide, tipe slide, dan gaya tipografi dipertahankan, sementara teks mentah, flyer unggahan, dan tanggal spesifik dibersihkan untuk dijadikan cetak biru preset baru.
            </p>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Master Preset Baru</Label>
              <Input
                value={newPresetTitle}
                onChange={(e) => setNewPresetTitle(e.target.value)}
                placeholder="Contoh: Kebaktian Sabat Remaja..."
                className="h-8 text-xs"
                data-testid="save-as-preset-title-input"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Keterangan / Deskripsi</Label>
              <Input
                value={newPresetDesc}
                onChange={(e) => setNewPresetDesc(e.target.value)}
                placeholder="Deskripsi singkat cetak biru..."
                className="h-8 text-xs"
                data-testid="save-as-preset-desc-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSaveAsPresetModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!newPresetTitle.trim()) {
                  toast.error('Nama master preset wajib diisi');
                  return;
                }
                const { preset: sanitizedPreset } = sanitizeScheduleToPreset(
                  instanceItems,
                  newPresetTitle,
                  newPresetDesc
                );
                setMasterPresets((prev) => [sanitizedPreset, ...prev]);
                setIsSaveAsPresetModalOpen(false);
                setNewPresetTitle('');
                setNewPresetDesc('');
                toast.success(
                  `Jadwal berhasil disanitasi dan disimpan sebagai Master Preset "${sanitizedPreset.title}".`
                );
              }}
              data-testid="submit-save-as-preset-button"
            >
              Simpan Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
