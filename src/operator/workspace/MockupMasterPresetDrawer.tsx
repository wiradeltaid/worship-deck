import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Archive,
  Layers,
  Sparkles,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MasterPreset,
  PresetLifecycleStatus,
  SYNTHETIC_MASTER_PRESETS,
  ScheduledServiceRecord,
  isValidPresetTransition,
  computePresetActiveServicesCount,
} from './types';
import { toast } from 'sonner';

interface MockupMasterPresetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  presets?: MasterPreset[];
  onUpdatePresets?: (presets: MasterPreset[]) => void;
  scheduledServices?: ScheduledServiceRecord[];
  onSelectPresetForBlueprint?: (preset: MasterPreset) => void;
}

export default function MockupMasterPresetDrawer({
  isOpen,
  onClose,
  presets: externalPresets,
  onUpdatePresets,
  scheduledServices = [],
  onSelectPresetForBlueprint,
}: MockupMasterPresetDrawerProps) {
  const [internalPresets, setInternalPresets] = useState<MasterPreset[]>(
    SYNTHETIC_MASTER_PRESETS
  );
  const presets = externalPresets || internalPresets;
  const updatePresets = onUpdatePresets || setInternalPresets;

  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft' | 'retired'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [guardBlockedPreset, setGuardBlockedPreset] = useState<MasterPreset | null>(null);

  // New Preset Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDefaultTime, setNewDefaultTime] = useState('09:00 WIB');
  const [newDescription, setNewDescription] = useState('');

  if (!isOpen) return null;

  const filteredPresets = presets.filter((p) => {
    if (activeTab === 'all') return true;
    return p.status === activeTab;
  });

  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Judul preset wajib diisi');
      return;
    }

    const slug =
      newSlug.trim() ||
      newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const created: MasterPreset = {
      id: `mp-${Date.now()}`,
      title: newTitle.trim(),
      slug,
      defaultTime: newDefaultTime.trim() || '09:00 WIB',
      description: newDescription.trim() || 'Cetak biru tata ibadah kustom jemaat.',
      status: 'draft',
      activeServicesCount: 0,
      version: 1,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    updatePresets([created, ...presets]);
    setIsCreateOpen(false);
    setNewTitle('');
    setNewSlug('');
    setNewDescription('');
    toast.success(`Preset '${created.title}' berhasil dibuat sebagai Draft.`);
  };

  const handleAttemptDelete = (preset: MasterPreset) => {
    // Dynamic dependency check guard: derived from actual scheduled services
    const activeCount =
      scheduledServices.length > 0
        ? computePresetActiveServicesCount(preset.slug, scheduledServices)
        : preset.activeServicesCount;

    if (activeCount > 0) {
      setGuardBlockedPreset({ ...preset, activeServicesCount: activeCount });
      return;
    }

    updatePresets(presets.filter((p) => p.id !== preset.id));
    toast.success(`Preset '${preset.title}' berhasil dihapus.`);
  };

  const handleArchivePreset = (preset: MasterPreset) => {
    updatePresets(
      presets.map((p) =>
        p.id === preset.id
          ? {
              ...p,
              isArchived: true,
              status: 'retired',
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : p
      )
    );
    setGuardBlockedPreset(null);
    toast.success(`Preset '${preset.title}' berhasil diarsipkan (status: Retired).`);
  };

  const handleStatusChange = (presetId: string, nextStatus: PresetLifecycleStatus) => {
    const target = presets.find((p) => p.id === presetId);
    if (!target) return;

    // Enforce state machine transition legality
    if (!isValidPresetTransition(target.status, nextStatus)) {
      toast.error(
        `Transisi status tidak valid: dari ${target.status.toUpperCase()} ke ${nextStatus.toUpperCase()}`
      );
      return;
    }

    updatePresets(
      presets.map((p) =>
        p.id === presetId
          ? {
              ...p,
              status: nextStatus,
              isArchived: nextStatus === 'retired' ? true : p.isArchived,
              version: p.version + 1,
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : p
      )
    );
    toast.info(`Status preset diperbarui menjadi: ${nextStatus.toUpperCase()}`);
  };

  return (
    <div
      data-testid="master-preset-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Kelola Master Preset Liturgi (Blueprint)
              </h2>
              <p className="text-xs text-muted-foreground">
                Atur blueprint tata ibadah baku, siklus hidup preset, dan aturan guardrail dependensi.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            data-testid="close-master-preset-drawer-button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Action Bar & Filter Tabs */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between gap-2 flex-wrap bg-background/50">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border border-border/60">
            {(['all', 'published', 'draft', 'retired'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`preset-tab-${tab}`}
              >
                {tab === 'all' ? 'Semua' : tab}
              </button>
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            onClick={() => setIsCreateOpen(true)}
            data-testid="add-new-preset-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Preset Baru</span>
          </Button>
        </div>

        {/* Deletion Dependency Guard Alert (When active services exist) */}
        {guardBlockedPreset && (
          <div
            data-testid="preset-deletion-guard-alert"
            className="m-4 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300 flex flex-col gap-3 animate-in fade-in"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 text-destructive mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Refusal: Penolakan Penghapusan Preset Terproteksi
                </h4>
                <p className="text-xs text-foreground/90 mt-1 leading-relaxed">
                  Preset <strong className="font-bold">"{guardBlockedPreset.title}"</strong> sedang digunakan
                  oleh <strong className="font-bold">{guardBlockedPreset.activeServicesCount} jadwal aktif</strong> di sistem.
                  Menghapus blueprint ini akan memutus relasi historis layanan.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sebagai gantinya, Anda dapat mengarsipkan preset ini agar tidak dapat dipilih lagi untuk jadwal baru
                  tanpa merusak jadwal yang sudah ada.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-destructive/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setGuardBlockedPreset(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs font-semibold gap-1.5"
                onClick={() => handleArchivePreset(guardBlockedPreset)}
                data-testid="archive-preset-button"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Arsipkan Preset (Ganti Status ke Retired)</span>
              </Button>
            </div>
          </div>
        )}

        {/* Create Preset Inline Dialog */}
        {isCreateOpen && (
          <form
            onSubmit={handleCreatePreset}
            className="m-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in"
            data-testid="create-preset-form"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Form Cetak Biru Preset Baru</span>
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Nama Preset
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ibadah Rumah Tangga"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                  data-testid="new-preset-title-input"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Slug / Pengenal Unik
                </label>
                <input
                  type="text"
                  placeholder="ibadah-rumah-tangga"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs font-mono"
                  data-testid="new-preset-slug-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Waktu Standar
                </label>
                <input
                  type="text"
                  placeholder="19:00 WIB"
                  value={newDefaultTime}
                  onChange={(e) => setNewDefaultTime(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-xs font-mono"
                  data-testid="new-preset-time-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Deskripsi Singkat Blueprint
              </label>
              <textarea
                placeholder="Jelaskan alur ibadah dan liturgi baku preset ini..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full h-16 p-2 rounded-md border border-border bg-background text-xs resize-none"
                data-testid="new-preset-desc-input"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsCreateOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs font-semibold"
                data-testid="submit-create-preset-button"
              >
                Simpan Preset (Draft)
              </Button>
            </div>
          </form>
        )}

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredPresets.map((preset) => {
            const isRetired = preset.status === 'retired';
            const isDraft = preset.status === 'draft';
            const isPublished = preset.status === 'published';
            const dynamicActiveCount =
              scheduledServices.length > 0
                ? computePresetActiveServicesCount(preset.slug, scheduledServices)
                : preset.activeServicesCount;

            return (
              <div
                key={preset.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isRetired
                    ? 'border-border/60 bg-muted/20 opacity-70'
                    : 'border-border/80 bg-card hover:border-primary/40 shadow-2xs'
                }`}
                data-testid={`preset-card-${preset.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-foreground">
                        {preset.title}
                      </h3>
                      <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted border border-border">
                        v{preset.version}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                          isPublished
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : isDraft
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30'
                        }`}
                      >
                        {preset.status}
                      </span>
                      {preset.isArchived && (
                        <span className="text-[10px] font-semibold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
                          Diarsipkan
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {preset.defaultTime}
                      </span>
                      <span>•</span>
                      <span>
                        Digunakan oleh:{' '}
                        <strong className="text-foreground font-bold">
                          {dynamicActiveCount} jadwal
                        </strong>
                      </span>
                      <span>•</span>
                      <span>Diperbarui: {preset.updatedAt}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Lifecycle status switch */}
                    {isDraft && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => handleStatusChange(preset.id, 'published')}
                      >
                        Publikasikan
                      </Button>
                    )}
                    {isPublished && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10"
                        onClick={() => handleStatusChange(preset.id, 'retired')}
                      >
                        Retire
                      </Button>
                    )}

                    {onSelectPresetForBlueprint && !isRetired && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-[11px] font-semibold"
                        onClick={() => {
                          onSelectPresetForBlueprint(preset);
                          onClose();
                        }}
                      >
                        Edit Blueprint
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleAttemptDelete(preset)}
                      data-testid={`delete-preset-${preset.id}`}
                      title="Hapus Preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total Blueprint: <strong className="text-foreground">{presets.length}</strong> master preset
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold"
          >
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
