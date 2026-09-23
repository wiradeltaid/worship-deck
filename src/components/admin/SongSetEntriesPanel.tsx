import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/operator';
import ArtifactEditor from '@/components/admin/ArtifactEditor';
import { createSongSetTrioAdapter } from '@/lib/registry/canvas-adapters';
import { compileProfileRegex } from '@/lib/parser-rules';

export interface SongSetEntry {
  variableName: string;
  title: string;
  position: number;
  updatedAt: string;
  extractionRegex?: string | null;
  extraction_regex?: string | null;
}

type SongSetLayoutRole = 'title' | 'verse' | 'reff';

export function SongSetEntriesPanel() {
  const { t } = useT();

  const [entries, setEntries] = useState<SongSetEntry[]>([]);
  const [selectedVarName, setSelectedVarName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New Song Set creation inputs
  const [newTitle, setNewTitle] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [newRegex, setNewRegex] = useState('');
  const [newRegexError, setNewRegexError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Inline rename and regex edit state in configured entries list (SPEC-14-06 / BUG-24 / SPEC-68)
  const [editingVarName, setEditingVarName] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftVarName, setDraftVarName] = useState('');
  const [draftRegex, setDraftRegex] = useState('');
  const [draftRegexError, setDraftRegexError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  // Layout trio active role
  const [selectedRole, setSelectedRole] = useState<SongSetLayoutRole>('title');

  const songSetAdapter = useMemo(() => createSongSetTrioAdapter(), []);

  const validateRegexSyntax = (pattern: string): string | null => {
    const trimmed = pattern.trim();
    if (!trimmed) return null;
    try {
      compileProfileRegex(trimmed);
      return null;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Invalid regex syntax';
    }
  };

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/admin/song-set-entries', { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error('Failed to load');
      }
      const data = (await res.json()) as { entries: SongSetEntry[] };
      const list = (data.entries ?? []).map((e) => ({
        ...e,
        extractionRegex: e.extraction_regex ?? e.extractionRegex ?? null,
      }));
      setEntries(list);
      if (list.length > 0 && !selectedVarName) {
        setSelectedVarName(list[0].variableName);
        setDraftTitle(list[0].title);
        setDraftRegex(list[0].extractionRegex ?? '');
      }
    } catch {
      toast.error(t('admin.songSets.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEntries();
  }, []);

  const activeEntry = entries.find((e) => e.variableName === selectedVarName) ?? entries[0] ?? null;
  const editingEntry = entries.find((e) => e.variableName === editingVarName) ?? null;

  useEffect(() => {
    if (activeEntry && !editingVarName) {
      setDraftTitle(activeEntry.title);
      setDraftVarName(activeEntry.variableName);
      setDraftRegex(activeEntry.extraction_regex ?? activeEntry.extractionRegex ?? '');
      setDraftRegexError(null);
    }
  }, [activeEntry?.variableName, editingVarName]);

  const handleStartEdit = (entry: SongSetEntry) => {
    setSelectedVarName(entry.variableName);
    setDraftTitle(entry.title);
    setDraftVarName(entry.variableName);
    setDraftRegex(entry.extraction_regex ?? entry.extractionRegex ?? '');
    setDraftRegexError(null);
    setEditingVarName(entry.variableName);
    setNewTitle('');
    setNewVarName('');
    setNewRegex('');
    setNewRegexError(null);
  };

  const handleCancelEdit = () => {
    setEditingVarName(null);
    setDraftTitle('');
    setDraftVarName('');
    setDraftRegex('');
    setDraftRegexError(null);
    setNewTitle('');
    setNewVarName('');
    setNewRegex('');
    setNewRegexError(null);
  };

  const handleCreate = async () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      toast.error(t('admin.songSets.titleInvalid'));
      return;
    }
    const regexErr = validateRegexSyntax(newRegex);
    if (regexErr) {
      setNewRegexError(regexErr);
      toast.error(`Invalid regex syntax: ${regexErr}`);
      return;
    }
    let candidateVar = newVarName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!candidateVar) {
      let nextNum = entries.length + 1;
      candidateVar = `song_set_${nextNum}`;
      while (entries.some((e) => e.variableName === candidateVar)) {
        nextNum++;
        candidateVar = `song_set_${nextNum}`;
      }
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/song-set-entries', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variableName: candidateVar,
          title: trimmedTitle,
          extraction_regex: newRegex.trim() || null,
        }),
      });

      if (res.status === 409) {
        toast.error(t('admin.songSets.createConflict'));
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.songSets.createFailed'));
        return;
      }

      const rawCreated = (await res.json()) as SongSetEntry;
      const created: SongSetEntry = {
        ...rawCreated,
        extractionRegex: rawCreated.extraction_regex ?? rawCreated.extractionRegex ?? (newRegex.trim() || null),
      };
      setEntries((prev) => [...prev, created].sort((a, b) => a.position - b.position));
      setSelectedVarName(created.variableName);
      setDraftTitle(created.title);
      setDraftRegex(created.extractionRegex ?? '');
      setNewTitle('');
      setNewVarName('');
      setNewRegex('');
      setNewRegexError(null);
      setEditingVarName(null);
      toast.success(t('admin.songSets.created').replace('{title}', created.title));
    } catch {
      toast.error(t('admin.songSets.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveRename = async () => {
    const targetVar = editingVarName ?? activeEntry?.variableName;
    const targetEntry = entries.find((e) => e.variableName === targetVar);
    if (!targetEntry) return;
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle || trimmedTitle.length > 120) {
      toast.error(t('admin.songSets.titleInvalid'));
      return;
    }
    const trimmedVar = draftVarName.trim().toLowerCase();
    if (!trimmedVar) {
      toast.error(t('admin.songSets.variableNameInvalid'));
      return;
    }
    if (!/^[a-z][a-z0-9_-]{0,79}$/.test(trimmedVar)) {
      toast.error(t('admin.songSets.variableNameInvalid'));
      return;
    }
    const regexErr = validateRegexSyntax(draftRegex);
    if (regexErr) {
      setDraftRegexError(regexErr);
      toast.error(`Invalid regex syntax: ${regexErr}`);
      return;
    }

    setRenaming(true);
    try {
      // Atomic patch of title, variableName, and extraction_regex
      const res = await fetch(
        `/api/admin/song-set-entries/${encodeURIComponent(targetEntry.variableName)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            variableName: trimmedVar,
            extraction_regex: draftRegex.trim() || null,
            updatedAt: targetEntry.updatedAt,
          }),
        }
      );

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        if (data.error && String(data.error).includes('already exists')) {
          toast.error(t('admin.songSets.createConflict'));
        } else {
          toast.error(t('admin.songSets.staleConflict'));
          void fetchEntries();
          setEditingVarName(null);
        }
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.songSets.renameFailed'));
        return;
      }

      const rawUpdated = (await res.json()) as SongSetEntry;
      const updated: SongSetEntry = {
        ...rawUpdated,
        extractionRegex: rawUpdated.extraction_regex ?? rawUpdated.extractionRegex ?? (draftRegex.trim() || null),
        extraction_regex: rawUpdated.extraction_regex ?? rawUpdated.extractionRegex ?? (draftRegex.trim() || null),
      };
      setEntries((prev) =>
        prev.map((item) => (item.variableName === targetEntry.variableName ? updated : item))
      );
      setSelectedVarName(updated.variableName);
      toast.success(t('admin.songSets.renamed').replace('{title}', updated.title));
      setEditingVarName(null);
    } catch {
      toast.error(t('admin.songSets.renameFailed'));
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (entry: SongSetEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(
      t('admin.songSets.confirmDelete')
        .replace('{title}', entry.title)
        .replace('{variableName}', entry.variableName)
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/admin/song-set-entries/${encodeURIComponent(entry.variableName)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updatedAt: entry.updatedAt,
          }),
        }
      );

      if (res.status === 409) {
        toast.error(t('admin.songSets.staleConflict'));
        void fetchEntries();
        return;
      }

      if (!res.ok) {
        toast.error(t('admin.songSets.deleteFailed'));
        return;
      }

      setEntries((prev) => {
        const next = prev.filter((item) => item.variableName !== entry.variableName);
        if (selectedVarName === entry.variableName) {
          setSelectedVarName(next[0]?.variableName ?? null);
        }
        if (editingVarName === entry.variableName) {
          handleCancelEdit();
        }
        return next;
      });
      toast.success(t('admin.songSets.deleted').replace('{title}', entry.title));
    } catch {
      toast.error(t('admin.songSets.deleteFailed'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] gap-6">
      {/* Panel Kiri: Add New Song Set & List */}
      <aside className="space-y-4">
        {/* New / Edit Song Set creation/edit panel per DEC-009 / DEC-010 / SPEC-15-04 */}
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate min-w-0 mr-2">
              {editingVarName
                ? t('admin.songSets.editTitle')
                : t('admin.songSets.createTitle')}
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                editingVarName
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-primary bg-primary/10 border-primary/20'
              }`}
            >
              {editingVarName ? t('admin.songSets.editingBadge') : t('admin.songSets.badge')}
            </span>
          </div>
          {editingVarName ? (
            <div className="space-y-2 pt-0.5">
              <Input
                type="text"
                placeholder={t('admin.songSets.entryTitle')}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveRename();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                disabled={renaming}
                aria-label={t('admin.songSets.entryTitle')}
                className="text-xs font-semibold h-8 w-full"
                autoFocus
              />
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  placeholder={t('admin.songSets.variableName')}
                  value={draftVarName}
                  onChange={(e) =>
                    setDraftVarName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveRename();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  disabled={renaming}
                  aria-label={t('admin.songSets.variableName')}
                  className="text-xs font-mono h-8 flex-1 min-w-0"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveRename()}
                  disabled={renaming || !draftTitle.trim() || !draftVarName.trim() || !!draftRegexError}
                  className="shrink-0 h-8 font-semibold text-xs text-primary-foreground"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {t('admin.songSets.save')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={renaming}
                  className="shrink-0 h-8 text-xs"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  {t('admin.songSets.cancel')}
                </Button>
              </div>
              <Input
                type="text"
                placeholder="Extraction regex, e.g. (?i)^Opening Hymn\s*[:\-]\s*(?<number>\d+)"
                value={draftRegex}
                onChange={(e) => {
                  setDraftRegex(e.target.value);
                  const err = validateRegexSyntax(e.target.value);
                  setDraftRegexError(err);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveRename();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                disabled={renaming}
                className={`text-xs font-mono h-8 w-full ${draftRegexError ? 'border-destructive' : ''}`}
              />
              {draftRegexError && (
                <p className="text-[10px] text-destructive font-mono">{draftRegexError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-0.5">
              <Input
                type="text"
                placeholder={t('admin.songSets.createTitlePlaceholder')}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={creating || loading}
                className="text-xs h-8"
              />
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  placeholder={t('admin.songSets.createVarPlaceholder')}
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  disabled={creating || loading}
                  className="flex-1 text-xs h-8 font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={creating || loading || !newTitle.trim() || !!newRegexError}
                  className="shrink-0 h-8 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New
                </Button>
              </div>
              <Input
                type="text"
                placeholder="Extraction regex (optional), e.g. (?i)^Opening Hymn\s*[:\-]\s*(?<number>\d+)"
                value={newRegex}
                onChange={(e) => {
                  setNewRegex(e.target.value);
                  const err = validateRegexSyntax(e.target.value);
                  setNewRegexError(err);
                }}
                disabled={creating || loading}
                className={`text-xs h-8 font-mono w-full ${newRegexError ? 'border-destructive' : ''}`}
              />
              {newRegexError && (
                <p className="text-[10px] text-destructive font-mono">{newRegexError}</p>
              )}
            </div>
          )}
        </div>

        {/* List Song Sets */}
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground">Configured Song Sets</span>
              <p className="text-[10px] text-muted-foreground">Entries share the canvas trio on the right</p>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">{entries.length} items</span>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              <span>Loading…</span>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">{t('admin.songSets.empty')}</p>
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {entries.map((entry) => {
                const isSelected = activeEntry?.variableName === entry.variableName;
                const isItemEditing = editingVarName === entry.variableName;

                return (
                  <div
                    key={entry.variableName}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedVarName(entry.variableName);
                      if (editingVarName && editingVarName !== entry.variableName) {
                        handleCancelEdit();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedVarName(entry.variableName);
                        if (editingVarName && editingVarName !== entry.variableName) {
                          handleCancelEdit();
                        }
                      }
                    }}
                    className={`group flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all h-[48px] min-h-[48px] ${
                      isItemEditing
                        ? 'border-amber-500/80 bg-amber-500/10 ring-1 ring-amber-500/30'
                        : isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate text-foreground">{entry.title}</p>
                        {isItemEditing && (
                          <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1 py-0.5 rounded border border-amber-500/30 leading-none shrink-0">
                            {t('admin.songSets.editingBadge')}
                          </span>
                        )}
                        {entry.extractionRegex || entry.extraction_regex ? (
                          <span
                            className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-[120px]"
                            title={entry.extractionRegex || entry.extraction_regex || ''}
                          >
                            /{entry.extractionRegex || entry.extraction_regex}/
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">[{entry.variableName}]</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title={t('admin.songSets.rename')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(entry);
                        }}
                        className={`h-7 w-7 p-1 hover:bg-muted hover:text-foreground ${
                          isItemEditing ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title={t('admin.songSets.delete')}
                        onClick={(e) => void handleDelete(entry, e)}
                        className="h-7 w-7 p-1 text-destructive hover:bg-destructive/20 hover:text-destructive"
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
      </aside>

      {/* Panel Kanan: Trio Switcher & Canvas Workspace */}
      <section className="space-y-4 min-w-0">
        {!activeEntry ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
            No song set selected. Click "New Song Set" to create one.
          </div>
        ) : (
          <>
            {/* Layout Trio Switcher & Canvas Workspace */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Shared Canvas Trio
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Shared across all song sets
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {t('admin.songSets.active')}{' '}
                  <strong className="text-foreground">{activeEntry.title}</strong>{' '}
                  <span className="font-mono text-[10px]">[{activeEntry.variableName}]</span>
                  {' · '}
                  {entries.length === 1
                    ? t('admin.songSets.editsApplyAllOne')
                    : t('admin.songSets.editsApplyAll').replace('{count}', String(entries.length))}
                </span>
              </div>

              {/* Trio Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg border border-border">
                <Button
                  type="button"
                  variant={selectedRole === 'title' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedRole('title')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    selectedRole === 'title'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  1. Title Slide
                </Button>
                <Button
                  type="button"
                  variant={selectedRole === 'verse' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedRole('verse')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    selectedRole === 'verse'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  2. Verse Layout
                </Button>
                <Button
                  type="button"
                  variant={selectedRole === 'reff' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedRole('reff')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    selectedRole === 'reff'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  3. Refrain Layout
                </Button>
              </div>

              {/* Artifact Editor for the selected trio layout */}
              <ArtifactEditor
                key={`song-set-trio-${selectedRole}`}
                adapter={songSetAdapter}
                initialSelectedId={selectedRole}
                hideList={true}
                allowImages={selectedRole === 'title'}
                allowRename={false}
                bannerNote={
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between min-h-[42px] h-[42px] overflow-hidden">
                    {selectedRole === 'title' ? (
                      <>
                        <span className="flex-1 min-w-0 truncate mr-2">🎨 <strong>Song Title Slide (Shared)</strong> — Layout applies to all song sets. Canvas customizes title, number & metadata graphics.</span>
                        <span className="font-mono text-[10px] bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30 shrink-0">SHARED TITLE SLIDE</span>
                      </>
                    ) : selectedRole === 'verse' ? (
                      <>
                        <span className="flex-1 min-w-0 truncate mr-2">📐 <strong>Auto Lyric Box: 2/3 Height (Shared)</strong> — Standard lyric formula applied to all song sets.</span>
                        <span className="font-mono text-[10px] bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30 shrink-0">SHARED VERSE LAYOUT</span>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 truncate mr-2">📐 <strong>Auto Lyric Box: 2/3 Height (Shared)</strong> — Refrain formula applied to all song sets.</span>
                        <span className="font-mono text-[10px] bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30 shrink-0">SHARED REFRAIN LAYOUT</span>
                      </>
                    )}
                  </div>
                }
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
