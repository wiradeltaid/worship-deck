import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/operator';
import ArtifactEditor from './ArtifactEditor';
import {
  createAnnouncementSetAdapter,
  CopiedSlide,
} from '@/lib/registry/canvas-adapters';

export interface AnnouncementSet {
  id: number;
  label: string;
  slideCount: number;
  updatedAt: string;
}

export interface AnnouncementSlide {
  id: number;
  annSetId: number;
  label: string;
  position: number;
  updatedAt: string;
  resettable: boolean;
  isPlaceholder?: boolean;
  placeholderSlot?: number;
}

export interface AnnouncementSetsPanelProps {
  copiedSlidePayload?: CopiedSlide | null;
  onCopySlidePayloadChange?: (slide: CopiedSlide | null) => void;
}

export function AnnouncementSetsPanel({
  copiedSlidePayload,
  onCopySlidePayloadChange,
}: AnnouncementSetsPanelProps = {}) {
  const { t } = useT();

  const [sets, setSets] = useState<AnnouncementSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);

  // Slides state for selected set
  const [slides, setSlides] = useState<AnnouncementSlide[]>([]);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);

  // Set creation state
  const [newSetName, setNewSetName] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);

  // Set Rename / Delete state
  const [isEditingSetName, setIsEditingSetName] = useState(false);
  const [editSetLabel, setEditSetLabel] = useState('');

  // Drag and drop state for slides
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);

  const fetchSets = async () => {
    try {
      const res = await fetch('/api/admin/announcement-sets', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load sets');
      const data = (await res.json()) as { sets: AnnouncementSet[] };
      const loadedSets = data.sets ?? [];
      setSets(loadedSets);
      if (loadedSets.length > 0) {
        setSelectedSetId((prev) => {
          if (prev !== null && loadedSets.some((s) => s.id === prev)) return prev;
          return loadedSets[0].id;
        });
      } else {
        setSelectedSetId(null);
      }
    } catch {
      toast.error(t('admin.annSets.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSlides = async (setId: number) => {
    setLoadingSlides(true);
    try {
      const res = await fetch(`/api/admin/announcement-sets/${setId}/slides`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load slides');
      const data = (await res.json()) as { slides: AnnouncementSlide[] };
      const loadedSlides = data.slides ?? [];
      setSlides(loadedSlides);
      if (loadedSlides.length > 0) {
        setSelectedSlideId((prev) => {
          if (prev !== null && loadedSlides.some((s) => s.id === prev)) return prev;
          return loadedSlides[0].id;
        });
      } else {
        setSelectedSlideId(null);
      }
    } catch {
      toast.error(t('admin.annSets.loadFailed'));
    } finally {
      setLoadingSlides(false);
    }
  };

  useEffect(() => {
    void fetchSets();
  }, []);

  useEffect(() => {
    if (selectedSetId !== null) {
      void fetchSlides(selectedSetId);
    } else {
      setSlides([]);
      setSelectedSlideId(null);
    }
  }, [selectedSetId]);

  const selectedSet = sets.find((s) => s.id === selectedSetId) ?? null;
  const activeSlide = slides.find((s) => s.id === selectedSlideId) ?? slides[0] ?? null;

  useEffect(() => {
    if (selectedSet) {
      setEditSetLabel(selectedSet.label);
      setIsEditingSetName(false);
    }
  }, [selectedSet?.id]);

  const handleCreateSet = async () => {
    const trimmed = newSetName.trim();
    let label = trimmed;
    if (!label) {
      let nextNum = sets.length + 1;
      label = `Announcement Set ${nextNum}`;
      while (sets.some((s) => s.label === label)) {
        nextNum++;
        label = `Announcement Set ${nextNum}`;
      }
    }

    setCreatingSet(true);
    try {
      const res = await fetch('/api/admin/announcement-sets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (res.status === 409) {
        toast.error(t('admin.annSets.createConflict'));
        return;
      }
      if (!res.ok) {
        toast.error(t('admin.annSets.createFailed'));
        return;
      }
      const created = (await res.json()) as AnnouncementSet;
      setSets((prev) => [...prev, created]);
      setSelectedSetId(created.id);
      setNewSetName('');
      toast.success(t('admin.annSets.created').replace('{label}', created.label));
    } catch {
      toast.error(t('admin.annSets.createFailed'));
    } finally {
      setCreatingSet(false);
    }
  };

  const handleSaveRenameSet = async () => {
    if (!selectedSet) return;
    const label = editSetLabel.trim();
    if (!label || label.length > 80) {
      toast.error(t('admin.annSets.labelInvalid'));
      return;
    }
    try {
      const res = await fetch(`/api/admin/announcement-sets/${selectedSet.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          updatedAt: selectedSet.updatedAt,
        }),
      });

      if (res.status === 409) {
        toast.error(t('admin.annSets.staleConflict'));
        void fetchSets();
        setIsEditingSetName(false);
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.annSets.renameFailed'));
        return;
      }

      const updated = (await res.json()) as AnnouncementSet;
      setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(t('admin.annSets.renamed').replace('{label}', updated.label));
      setIsEditingSetName(false);
    } catch {
      toast.error(t('admin.annSets.renameFailed'));
    }
  };

  const handleDeleteSet = async () => {
    if (!selectedSet) return;
    const ok = window.confirm(t('admin.annSets.confirmDelete').replace('{label}', selectedSet.label));
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/announcement-sets/${selectedSet.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: selectedSet.updatedAt,
        }),
      });

      if (res.status === 409) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error || t('admin.annSets.staleConflict'));
        void fetchSets();
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.annSets.deleteFailed'));
        return;
      }

      setSets((prev) => {
        const next = prev.filter((s) => s.id !== selectedSet.id);
        setSelectedSetId(next.length > 0 ? next[0].id : null);
        return next;
      });
      toast.success(t('admin.annSets.deleted').replace('{label}', selectedSet.label));
    } catch {
      toast.error(t('admin.annSets.deleteFailed'));
    }
  };

  const handleAddSlideAuto = async () => {
    if (!selectedSet) return;
    let nextNum = slides.length + 1;
    let label = `Slide ${nextNum}`;
    while (slides.some((s) => s.label === label)) {
      nextNum++;
      label = `Slide ${nextNum}`;
    }

    try {
      const res = await fetch(`/api/admin/announcement-sets/${selectedSet.id}/slides`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });

      if (!res.ok) {
        toast.error(t('admin.annSets.slideAddFailed'));
        return;
      }

      const created = (await res.json()) as AnnouncementSlide;
      setSlides((prev) => [...prev, created].sort((a, b) => a.position - b.position));
      setSelectedSlideId(created.id);
      toast.success(t('admin.annSets.slideAdded').replace('{label}', created.label));
      setSets((prev) =>
        prev.map((s) => (s.id === selectedSet.id ? { ...s, slideCount: s.slideCount + 1 } : s))
      );
    } catch {
      toast.error(t('admin.annSets.slideAddFailed'));
    }
  };

  const handleDeleteSlide = async (slide: AnnouncementSlide, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedSet) return;
    const ok = window.confirm(
      t('admin.annSets.confirmDeleteSlide').replace('{label}', slide.label)
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/admin/announcement-sets/${selectedSet.id}/slides/${slide.id}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updatedAt: slide.updatedAt,
          }),
        }
      );

      if (res.status === 409) {
        toast.error(t('admin.annSets.staleConflict'));
        void fetchSlides(selectedSet.id);
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.annSets.slideDeleteFailed'));
        return;
      }

      toast.success(t('admin.annSets.slideDeleted'));
      void fetchSlides(selectedSet.id);
      setSets((prev) =>
        prev.map((s) =>
          s.id === selectedSet.id ? { ...s, slideCount: Math.max(0, s.slideCount - 1) } : s
        )
      );
    } catch {
      toast.error(t('admin.annSets.slideDeleteFailed'));
    }
  };

  const handleMoveSlide = async (slide: AnnouncementSlide, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedSet) return;
    const index = slides.findIndex((s) => s.id === slide.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= slides.length) return;

    const desired = [...slides];
    [desired[index], desired[target]] = [desired[target], desired[index]];
    await handleReorderSlides(desired);
  };

  const handleReorderSlides = async (desired: AnnouncementSlide[]) => {
    if (!selectedSet) return;
    try {
      const res = await fetch(`/api/admin/announcement-sets/${selectedSet.id}/slides/order`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: desired.map(({ id, updatedAt }) => ({ id, updatedAt })),
        }),
      });

      if (res.status === 400 || res.status === 409) {
        toast.error(t('admin.annSets.slideReorderConflict'));
        void fetchSlides(selectedSet.id);
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.annSets.slideReorderFailed'));
        return;
      }

      const data = (await res.json()) as { slides: AnnouncementSlide[] };
      setSlides(data.slides ?? desired);
      toast.success(t('admin.annSets.slideReorderSaved'));
    } catch {
      toast.error(t('admin.annSets.slideReorderFailed'));
    }
  };

  const handleCloneSlide = async (slide: AnnouncementSlide, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedSet) return;

    try {
      const res = await fetch(
        `/api/admin/announcement-sets/${selectedSet.id}/slides/${slide.id}`,
        { credentials: 'same-origin' }
      );
      if (!res.ok) throw new Error('Failed to load slide');
      const data = (await res.json()) as { slide: { label: string; payload?: Record<string, unknown> } };

      const baseLabel = slide.label.replace(/\s*\(Copy(?:\s+\d+)?\)$/, '');
      let copyNum = 1;
      const regex = new RegExp(`^${baseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(Copy(?:\\s+(\\d+))?\\)$`);
      for (const s of slides) {
        const match = s.label.match(regex);
        if (match) {
          const n = match[1] ? parseInt(match[1], 10) : 1;
          if (n >= copyNum) copyNum = n + 1;
        }
      }
      const newLabel = `${baseLabel} (Copy ${copyNum})`;

      const createRes = await fetch(`/api/admin/announcement-sets/${selectedSet.id}/slides`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel }),
      });
      if (!createRes.ok) throw new Error('Failed to create slide');
      const created = (await createRes.json()) as AnnouncementSlide;

      if (data.slide.payload) {
        await fetch(`/api/admin/announcement-sets/${selectedSet.id}/slides/${created.id}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data.slide.payload,
            label: newLabel,
            updatedAt: created.updatedAt,
          }),
        });
      }

      await fetchSlides(selectedSet.id);
      setSelectedSlideId(created.id);
      toast.success(t('admin.annSets.slideAdded').replace('{label}', newLabel));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone slide');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSlideIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSlideIndex === null || draggedSlideIndex === targetIndex) {
      setDraggedSlideIndex(null);
      return;
    }
    const next = [...slides];
    const [moved] = next.splice(draggedSlideIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDraggedSlideIndex(null);
    setSlides(next);
    await handleReorderSlides(next);
  };

  const announcementSetAdapter = useMemo(() => {
    if (selectedSetId === null) return null;
    return createAnnouncementSetAdapter(selectedSetId, () => {
      void fetchSlides(selectedSetId);
    });
  }, [selectedSetId]);

  const handleTogglePlaceholder = async (slide: AnnouncementSlide, isPlaceholder: boolean) => {
    if (!announcementSetAdapter) return;
    try {
      const fullTmpl = await announcementSetAdapter.getOne(String(slide.id));
      const slot = slide.placeholderSlot ?? 1;
      const { updatedAt, ...body } = fullTmpl;
      const res = await announcementSetAdapter.save(String(slide.id), {
        ...body,
        isPlaceholder,
        placeholderSlot: isPlaceholder ? slot : undefined,
        updatedAt: slide.updatedAt,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to update placeholder status');
      setSlides((prev) =>
        prev.map((s) =>
          s.id === slide.id
            ? {
                ...s,
                isPlaceholder,
                placeholderSlot: isPlaceholder ? slot : undefined,
                updatedAt: res.data?.updatedAt ?? s.updatedAt,
              }
            : s
        )
      );
      toast.success(
        isPlaceholder
          ? `Designated as Weekly Placeholder (Slot ${slot})`
          : 'Removed weekly placeholder designation'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update placeholder status');
    }
  };

  const handleSetPlaceholderSlot = async (slide: AnnouncementSlide, slot: number) => {
    if (!announcementSetAdapter) return;
    try {
      const fullTmpl = await announcementSetAdapter.getOne(String(slide.id));
      const { updatedAt, ...body } = fullTmpl;
      const res = await announcementSetAdapter.save(String(slide.id), {
        ...body,
        isPlaceholder: true,
        placeholderSlot: slot,
        updatedAt: slide.updatedAt,
      });
      if (!res.ok) throw new Error(res.error || 'Failed to update placeholder slot');
      setSlides((prev) =>
        prev.map((s) =>
          s.id === slide.id
            ? {
                ...s,
                isPlaceholder: true,
                placeholderSlot: slot,
                updatedAt: res.data?.updatedAt ?? s.updatedAt,
              }
            : s
        )
      );
      toast.success(`Bound to Weekly Announcement Slot ${slot}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update placeholder slot');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] gap-6">
      {/* Panel Kiri: 3-Tier Hierarchy (Button -> Dropdown -> Slides List) */}
      <aside className="space-y-4">
        {/* Tier A: New Announcement Set panel per DEC-009 / DEC-010 */}
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Announcement Set</span>
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              Announcement Set
            </span>
          </div>
          <div className="flex gap-1.5 pt-0.5">
            <Input
              type="text"
              placeholder="Announcement set label..."
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              disabled={creatingSet || loading}
              className="flex-1 text-xs h-8"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreateSet()}
              disabled={creatingSet || loading}
              className="shrink-0 h-8 font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Tier B & C: Dropdown Selector & Slides in Set */}
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-sm">
          <div className="min-h-[58px]">
            <div className="flex items-center justify-between h-6 mb-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Active Announcement Set
              </label>
              {selectedSet && !isEditingSetName && (
                <div className="flex items-center gap-1 text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingSetName(true)}
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Rename
                  </Button>
                  <span className="text-muted-foreground/60">•</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDeleteSet()}
                    className="h-6 px-1.5 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {isEditingSetName ? (
              <div className="flex gap-1.5 items-center h-8">
                <Input
                  value={editSetLabel}
                  onChange={(e) => setEditSetLabel(e.target.value)}
                  className="h-8 text-xs flex-1"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={() => void handleSaveRenameSet()} className="h-8 text-xs font-semibold">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingSetName(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                value={selectedSetId !== null ? String(selectedSetId) : undefined}
                onValueChange={(val) => {
                  if (val) setSelectedSetId(Number(val));
                }}
                items={Object.fromEntries(sets.map((s) => [String(s.id), `${s.label} (${s.slideCount} slides)`]))}
              >
                <SelectTrigger className={cn("w-full text-xs font-semibold h-8", selectedSet !== null && "text-foreground [&[data-placeholder]]:text-foreground")}>
                  <SelectValue placeholder="Select set…">
                    {selectedSet ? `${selectedSet.label} (${selectedSet.slideCount} slides)` : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sets.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label} ({s.slideCount} slides)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="pt-2 border-t border-border/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Slides in Set</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleAddSlideAuto()}
                disabled={!selectedSet}
                className="h-6 px-1.5 text-[11px] text-primary hover:text-primary hover:bg-primary/10 flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                Add Slide
              </Button>
            </div>

            {/* List of Slides with Hover Actions */}
            {loadingSlides ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                <span>Loading slides…</span>
              </div>
            ) : slides.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">{t('admin.annSets.slidesEmpty')}</p>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                {slides.map((slide, index) => {
                  const isSelected = activeSlide?.id === slide.id;
                  return (
                    <div
                      key={slide.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => void handleDrop(e, index)}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedSlideId(slide.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedSlideId(slide.id);
                        }
                      }}
                      className={`group flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate text-foreground">
                          #{index + 1} {slide.label}
                        </p>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          {slide.isPlaceholder
                            ? `[Weekly Slot ${slide.placeholderSlot ?? 1}]`
                            : '[announcement-slide]'}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Move Up"
                          onClick={(e) => void handleMoveSlide(slide, -1, e)}
                          disabled={index === 0}
                          className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Move Down"
                          onClick={(e) => void handleMoveSlide(slide, 1, e)}
                          disabled={index === slides.length - 1}
                          className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Clone Slide"
                          onClick={(e) => void handleCloneSlide(slide, e)}
                          className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('admin.annSets.delete')}
                          onClick={(e) => void handleDeleteSlide(slide, e)}
                          className="h-7 w-7 p-1 text-destructive hover:text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Panel Kanan: Canvas Editor Identik dengan Main Spine */}
      <section className="space-y-4 min-w-0">
        {!selectedSet || !activeSlide || !announcementSetAdapter ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
            No announcement slide selected. Click "Add Slide" to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Weekly Placeholder Controls */}
            <div
              data-testid="announcement-placeholder-controls"
              className="p-3 rounded-lg border border-border/80 bg-card/60 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                  <input
                    type="checkbox"
                    data-testid="slide-is-placeholder"
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    checked={Boolean(activeSlide.isPlaceholder)}
                    onChange={(e) => void handleTogglePlaceholder(activeSlide, e.target.checked)}
                  />
                  <span>Designate as Weekly Placeholder</span>
                </label>
                {activeSlide.isPlaceholder && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Bound to:</span>
                    <Select
                      value={String(activeSlide.placeholderSlot ?? 1)}
                      onValueChange={(val) => void handleSetPlaceholderSlot(activeSlide, Number(val))}
                    >
                      <SelectTrigger
                        data-testid="slide-placeholder-slot"
                        className="h-7 w-28 text-xs font-semibold"
                      >
                        <SelectValue placeholder="Slot 1" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Slot 1</SelectItem>
                        <SelectItem value="2">Slot 2</SelectItem>
                        <SelectItem value="3">Slot 3</SelectItem>
                        <SelectItem value="4">Slot 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {activeSlide.isPlaceholder
                  ? `Populated with Slot ${activeSlide.placeholderSlot ?? 1} weekly poster; omitted if slot is empty.`
                  : 'Renders static slide canvas elements.'}
              </p>
            </div>
            <ArtifactEditor
              key={`ann-set-${selectedSet.id}-slide-${activeSlide.id}`}
              adapter={announcementSetAdapter}
              initialSelectedId={String(activeSlide.id)}
              hideList={true}
              copiedSlidePayload={copiedSlidePayload}
              onCopySlidePayloadChange={onCopySlidePayloadChange}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default AnnouncementSetsPanel;
