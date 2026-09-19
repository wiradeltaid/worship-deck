import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HymnNumberAutocomplete } from '@/components/HymnNumberAutocomplete';
import { ImageFieldPreview } from '@/components/ImageFieldPreview';
import { ImageUploadField } from '@/components/ImageUploadField';
import type { HymnIndexEntry } from '@/lib/worship-form-fields';
import { cn } from '@/lib/utils';

export interface PredefinedFieldDef {
  id: string;
  variable_name: string;
  shown_text: string;
  field_type: 'text' | 'text_area' | 'image';
  input_length?: number | null;
  initial_lines?: number | null;
  extraction_regex?: string | null;
  seed_key?: string | null;
  is_system?: number;
  is_active?: number;
}

export interface FormGroupSlotDef {
  id: string;
  layout_id: string;
  grouping_id: string;
  sort_order: number;
  widget_kind: 'predefined_field' | 'song_set_entry' | 'announcement_slot';
  ref_key: string;
}

export interface FormGroupingDef {
  id: string;
  layout_id: string;
  label: string;
  description: string;
  sort_order: number;
  slots: FormGroupSlotDef[];
}

export interface FormLayoutData {
  layout: {
    id: string;
    title: string;
    description: string;
    is_active: number;
    version: number;
  };
  groupings: FormGroupingDef[];
  predefined_fields: PredefinedFieldDef[];
}

export interface DynamicFormBodyProps {
  layoutData: FormLayoutData;
  fieldValues: Record<string, string>;
  onFieldValueChange: (variableName: string, value: string) => void;
  songSetValues: Record<
    string,
    { songNumber: string; songBookCode: string; background: string; lyricText: string }
  >;
  onSongSetChange: (
    variableName: string,
    field: 'songNumber' | 'songBookCode' | 'background' | 'lyricText',
    value: string
  ) => void;
  announcementInserts: string[];
  onAnnouncementInsertChange: (slotIndex: number, url: string) => void;
  songSetEntries: Array<{ variableName: string; title: string }>;
  songBooks: Array<{ bookCode: string; name: string; isDefault: boolean }>;
  backgroundLibrary: Array<{ id: number; url: string; isDefault: boolean }>;
  openLyricEditors: Record<string, boolean>;
  onToggleLyricEditor: (variableName: string) => void;
  savingBookStatus?: Record<string, boolean>;
  onSaveToBook?: (variableName: string) => void;
  fieldSuggestions?: Record<string, string>;
  onAcceptFieldSuggestion?: (variableName: string, value: string) => void;
  songSetSuggestions?: Record<string, any>;
  onAcceptSongSetSuggestion?: (variableName: string, suggestion: any) => void;
  disabled?: boolean;
  isAdmin?: boolean;
  onRefreshLayout?: () => void;
  hymnIndex?: HymnIndexEntry[];
}

export function DynamicFormBody({
  layoutData,
  fieldValues,
  onFieldValueChange,
  songSetValues,
  onSongSetChange,
  announcementInserts,
  onAnnouncementInsertChange,
  songSetEntries,
  songBooks,
  backgroundLibrary,
  openLyricEditors,
  onToggleLyricEditor,
  savingBookStatus = {},
  onSaveToBook,
  fieldSuggestions = {},
  onAcceptFieldSuggestion,
  songSetSuggestions = {},
  onAcceptSongSetSuggestion,
  disabled = false,
  isAdmin = false,
  onRefreshLayout,
  hymnIndex = [],
}: DynamicFormBodyProps) {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [seedReportMsg, setSeedReportMsg] = useState<string | null>(null);

  const [addingSlotGroupingId, setAddingSlotGroupingId] = useState<string | null>(null);
  const [inPlaceSlotKind, setInPlaceSlotKind] = useState<'predefined_field' | 'song_set_entry' | 'announcement_slot'>('predefined_field');
  const [inPlaceSlotRefKey, setInPlaceSlotRefKey] = useState('');

  const handleInPlaceAddSlot = async (groupingId: string) => {
    if (!inPlaceSlotRefKey.trim()) return;
    try {
      const res = await fetch('/api/admin/form-grouping-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grouping_id: groupingId,
          widget_kind: inPlaceSlotKind,
          ref_key: inPlaceSlotRefKey.trim(),
        }),
      });
      if (res.ok) {
        setInPlaceSlotRefKey('');
        setAddingSlotGroupingId(null);
        if (onRefreshLayout) onRefreshLayout();
      } else if (res.status === 409) {
        alert('Slot already exists in layout (cardinality limit).');
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        alert(d.error || 'Failed to add slot');
      }
    } catch {
      // ignore
    }
  };

  const fieldDefsByVarName = React.useMemo(() => {
    const map = new Map<string, PredefinedFieldDef>();
    for (const f of (layoutData.predefined_fields || [])) {
      map.set(f.variable_name, f);
    }
    return map;
  }, [layoutData.predefined_fields]);

  // Card reordering
  const handleMoveGrouping = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layoutData.groupings.length) return;

    const currentGroup = layoutData.groupings[index];
    const targetGroup = layoutData.groupings[targetIndex];

    const payload = [
      { id: currentGroup.id, sort_order: targetGroup.sort_order },
      { id: targetGroup.id, sort_order: currentGroup.sort_order },
    ];

    try {
      const res = await fetch('/api/admin/form-groupings/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && onRefreshLayout) {
        onRefreshLayout();
      }
    } catch {
      // ignore
    }
  };

  const handleCreateGrouping = async () => {
    if (!newGroupLabel.trim()) return;
    try {
      const res = await fetch('/api/admin/form-groupings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout_id: layoutData.layout.id || 'default-layout',
          label: newGroupLabel.trim(),
          description: newGroupDesc.trim(),
        }),
      });
      if (res.ok) {
        setNewGroupLabel('');
        setNewGroupDesc('');
        setIsCreatingGroup(false);
        if (onRefreshLayout) onRefreshLayout();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteGrouping = async (id: string) => {
    if (!window.confirm('Delete this card grouping and all its slots?')) return;
    try {
      const res = await fetch(`/api/admin/form-groupings/${id}`, {
        method: 'DELETE',
      });
      if (res.ok && onRefreshLayout) {
        onRefreshLayout();
      }
    } catch {
      // ignore
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeedingDefaults(true);
    setSeedReportMsg(null);
    try {
      const res = await fetch('/api/admin/predefined-fields/seed-defaults', {
        method: 'POST',
      });
      if (res.ok) {
        const report = (await res.json()) as {
          inserted: number;
          skipped: number;
          inactive_skipped: number;
        };
        setSeedReportMsg(
          `Seeder completed: ${report.inserted} inserted, ${report.skipped} skipped, ${report.inactive_skipped} inactive skipped.`
        );
        if (onRefreshLayout) onRefreshLayout();
      }
    } catch {
      setSeedReportMsg('Failed to run default seeder.');
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  const handleMoveSlot = async (grouping: FormGroupingDef, slotIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? slotIndex - 1 : slotIndex + 1;
    if (targetIndex < 0 || targetIndex >= grouping.slots.length) return;

    const currentSlot = grouping.slots[slotIndex];
    const targetSlot = grouping.slots[targetIndex];

    const payload = {
      grouping_id: grouping.id,
      slots: [
        { id: currentSlot.id, sort_order: targetSlot.sort_order },
        { id: targetSlot.id, sort_order: currentSlot.sort_order },
      ],
    };

    try {
      const res = await fetch('/api/admin/form-grouping-slots/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && onRefreshLayout) {
        onRefreshLayout();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const res = await fetch(`/api/admin/form-grouping-slots/${slotId}`, {
        method: 'DELETE',
      });
      if (res.ok && onRefreshLayout) {
        onRefreshLayout();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6" data-slot="dynamic-form-body">
      {/* In-place layout management toolbar for Admins */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isCustomizing ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setIsCustomizing((prev) => !prev)}
            >
              {isCustomizing ? 'Selesai Kelola Layout' : '⚙️ Kelola Layout Visual'}
            </Button>
            {isCustomizing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleSeedDefaults}
                disabled={isSeedingDefaults}
              >
                {isSeedingDefaults ? 'Seeding...' : 'Seed Default Predefined Fields'}
              </Button>
            )}
          </div>
          {seedReportMsg && (
            <span className="text-xs text-muted-foreground italic font-mono">
              {seedReportMsg}
            </span>
          )}
        </div>
      )}

      {/* Add New Grouping Card Form when customizing */}
      {isCustomizing && (
        <Card className="border-dashed border-primary/50 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-bold">Tambah Kartu Form Baru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Judul Kartu (misal: Mission Spotlight)"
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                placeholder="Deskripsi Kartu (opsional)"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                className="text-xs h-8"
                onClick={handleCreateGrouping}
                disabled={!newGroupLabel.trim()}
              >
                Simpan Kartu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Render each Card Grouping */}
      {(layoutData.groupings || []).map((grouping, groupIdx) => (
        <Card
          key={grouping.id}
          className="border-border/80 shadow-md bg-card/60 backdrop-blur-md"
          data-grouping-id={grouping.id}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg font-bold">{grouping.label}</CardTitle>
              {grouping.description && (
                <CardDescription>{grouping.description}</CardDescription>
              )}
            </div>

            {/* Customization controls for this Card Grouping */}
            {isCustomizing && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={groupIdx === 0}
                  onClick={() => handleMoveGrouping(groupIdx, 'up')}
                  title="Move Up"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={groupIdx === layoutData.groupings.length - 1}
                  onClick={() => handleMoveGrouping(groupIdx, 'down')}
                  title="Move Down"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleDeleteGrouping(grouping.id)}
                  title="Delete Grouping"
                >
                  Hapus
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {grouping.slots.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Belum ada slot pada kartu ini.
              </p>
            ) : (
              grouping.slots.map((slot, slotIdx) => {
                return (
                  <div
                    key={slot.id}
                    className="relative group/slot"
                    data-slot-id={slot.id}
                    data-slot-kind={slot.widget_kind}
                    data-slot-ref={slot.ref_key}
                  >
                    {isCustomizing && (
                      <div className="absolute top-0 right-0 z-10 flex items-center gap-1 bg-background/90 p-1 rounded border border-border/60 shadow-sm text-xs opacity-80 hover:opacity-100">
                        <span className="text-[10px] text-muted-foreground font-mono mr-1">
                          {slot.widget_kind}:{slot.ref_key}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-[10px]"
                          disabled={slotIdx === 0}
                          onClick={() => handleMoveSlot(grouping, slotIdx, 'up')}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-[10px]"
                          disabled={slotIdx === grouping.slots.length - 1}
                          onClick={() => handleMoveSlot(grouping, slotIdx, 'down')}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => handleDeleteSlot(slot.id)}
                        >
                          ×
                        </Button>
                      </div>
                    )}

                    {/* Specialized Slot Renderers */}
                    {slot.widget_kind === 'predefined_field' && (
                      <PredefinedFieldSlotRenderer
                        fieldDef={fieldDefsByVarName.get(slot.ref_key)}
                        refKey={slot.ref_key}
                        value={fieldValues[slot.ref_key] || ''}
                        onChange={(v) => onFieldValueChange(slot.ref_key, v)}
                        suggestion={fieldSuggestions[slot.ref_key]}
                        onAcceptSuggestion={() => {
                          if (fieldSuggestions[slot.ref_key] && onAcceptFieldSuggestion) {
                            onAcceptFieldSuggestion(slot.ref_key, fieldSuggestions[slot.ref_key]);
                          }
                        }}
                        disabled={disabled}
                      />
                    )}

                    {slot.widget_kind === 'song_set_entry' && (
                      <SongSetSlotRenderer
                        refKey={slot.ref_key}
                        songSetEntries={songSetEntries}
                        songBooks={songBooks}
                        backgroundLibrary={backgroundLibrary}
                        values={songSetValues[slot.ref_key] || {
                          songNumber: '',
                          songBookCode: '',
                          background: '',
                          lyricText: '',
                        }}
                        onChange={(field, val) => onSongSetChange(slot.ref_key, field, val)}
                        isLyricOpen={!!openLyricEditors[slot.ref_key]}
                        onToggleLyricEditor={() => onToggleLyricEditor(slot.ref_key)}
                        isSavingBook={!!savingBookStatus[slot.ref_key]}
                        onSaveToBook={() => onSaveToBook && onSaveToBook(slot.ref_key)}
                        suggestion={songSetSuggestions[slot.ref_key]}
                        onAcceptSuggestion={() => {
                          if (songSetSuggestions[slot.ref_key] && onAcceptSongSetSuggestion) {
                            onAcceptSongSetSuggestion(slot.ref_key, songSetSuggestions[slot.ref_key]);
                          }
                        }}
                        disabled={disabled}
                        hymnIndex={hymnIndex}
                      />
                    )}

                    {slot.widget_kind === 'announcement_slot' && (
                      <AnnouncementSlotRenderer
                        slotIndex={parseInt(slot.ref_key, 10) || 1}
                        value={announcementInserts[(parseInt(slot.ref_key, 10) || 1) - 1] || ''}
                        onChange={(url) =>
                          onAnnouncementInsertChange((parseInt(slot.ref_key, 10) || 1) - 1, url)
                        }
                        disabled={disabled}
                      />
                    )}
                  </div>
                );
              })
            )}

            {isCustomizing && (
              <div className="pt-3 border-t border-dashed border-border/60">
                {addingSlotGroupingId === grouping.id ? (
                  <div className="p-3 bg-muted/40 rounded-lg space-y-2 border border-border/50">
                    <span className="text-xs font-bold block">Tambah Slot ke "{grouping.label}"</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={inPlaceSlotKind}
                        onValueChange={(v) =>
                          setInPlaceSlotKind(
                            (v as 'predefined_field' | 'song_set_entry' | 'announcement_slot') || 'predefined_field'
                          )
                        }
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Jenis Widget" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="predefined_field">Predefined Field</SelectItem>
                          <SelectItem value="song_set_entry">Song Set Entry</SelectItem>
                          <SelectItem value="announcement_slot">Announcement Slot (1-4)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Ref Key (variable_name / slot #)"
                        value={inPlaceSlotRefKey}
                        onChange={(e) => setInPlaceSlotRefKey(e.target.value)}
                        className="text-xs h-8 font-mono"
                      />

                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="text-xs h-8 flex-1"
                          onClick={() => handleInPlaceAddSlot(grouping.id)}
                          disabled={!inPlaceSlotRefKey.trim()}
                        >
                          Simpan Slot
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => setAddingSlotGroupingId(null)}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1 border-dashed"
                    onClick={() => {
                      setAddingSlotGroupingId(grouping.id);
                      setInPlaceSlotRefKey('');
                    }}
                  >
                    + Tambah Slot ke Kartu Ini
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------------
// Slot Sub-Renderers
// --------------------------------------------------------------------------------

interface PredefinedFieldSlotRendererProps {
  fieldDef?: PredefinedFieldDef;
  refKey: string;
  value: string;
  onChange: (value: string) => void;
  suggestion?: string;
  onAcceptSuggestion?: () => void;
  disabled?: boolean;
}

function PredefinedFieldSlotRenderer({
  fieldDef,
  refKey,
  value,
  onChange,
  suggestion,
  onAcceptSuggestion,
  disabled = false,
}: PredefinedFieldSlotRendererProps) {
  const label = fieldDef?.shown_text || refKey;
  const fieldType = fieldDef?.field_type || 'text';

  const hasSuggestion = suggestion && suggestion.trim() && suggestion.trim() !== value.trim();

  // Width classes derived from input_length
  let widthClass = 'w-full';
  if (fieldDef?.input_length) {
    if (fieldDef.input_length <= 50) widthClass = 'max-w-xs';
    else if (fieldDef.input_length <= 100) widthClass = 'max-w-md';
  }

  // Initial lines for textarea
  const rows = Math.min(Math.max(fieldDef?.initial_lines || 5, 2), 20);

  return (
    <div className="space-y-1.5" data-field-variable={refKey}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
          {label}
        </label>
        {hasSuggestion && (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] font-normal border-primary/30">
              Saran: {suggestion.slice(0, 30)}
              {suggestion.length > 30 ? '...' : ''}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={onAcceptSuggestion}
              disabled={disabled}
            >
              Gunakan
            </Button>
          </div>
        )}
      </div>

      {fieldType === 'text' && (
        <Input
          type="text"
          className={cn('text-xs', widthClass)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={fieldDef?.input_length || undefined}
          disabled={disabled}
        />
      )}

      {fieldType === 'text_area' && (
        <Textarea
          className="text-xs font-sans w-full"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {fieldType === 'image' && (
        <ImageThreeColumnRenderer
          label={label}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ImageThreeColumnRenderer({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) {
          onChange(data.url);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
    }
  };

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-lg border border-border/50 bg-background/50"
      data-slot="image-three-column"
    >
      {/* Column 1: Image Thumbnail Preview (3 cols) */}
      <div className="md:col-span-3 flex justify-center items-center h-28 bg-muted/20 rounded border border-border/40 overflow-hidden">
        {value ? (
          <ImageFieldPreview url={value} alt={label} />
        ) : (
          <span className="text-[11px] text-muted-foreground italic">Belum ada gambar</span>
        )}
      </div>

      {/* Column 2: File upload & URL input (6 cols) */}
      <div className="md:col-span-6 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="w-full text-xs text-muted-foreground file:mr-2 file:cursor-pointer file:rounded file:border file:border-primary/20 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
          onChange={handleFileUpload}
          disabled={disabled || isUploading}
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="url"
            placeholder="Atau tempel URL gambar (https://...)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="h-8 text-xs flex-1"
            disabled={disabled || isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs shrink-0"
            onClick={handleApplyUrl}
            disabled={disabled || isUploading || !urlInput.trim()}
          >
            Terapkan
          </Button>
        </div>
      </div>

      {/* Column 3: Action Controls (Download & Clear) (3 cols) */}
      <div className="md:col-span-3 flex flex-col gap-1.5 justify-center items-stretch">
        {value && (
          <a
            href={value}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-background hover:bg-accent h-8 px-3 transition-colors"
          >
            Download Asset
          </a>
        )}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-destructive hover:bg-destructive/10"
            onClick={() => onChange('')}
            disabled={disabled}
          >
            Hapus Gambar
          </Button>
        )}
      </div>
    </div>
  );
}

function SongSetSlotRenderer({
  refKey,
  songSetEntries,
  songBooks,
  backgroundLibrary,
  values,
  onChange,
  isLyricOpen,
  onToggleLyricEditor,
  isSavingBook = false,
  onSaveToBook,
  suggestion,
  onAcceptSuggestion,
  disabled = false,
  hymnIndex = [],
}: {
  refKey: string;
  songSetEntries: Array<{ variableName: string; title: string }>;
  songBooks: Array<{ bookCode: string; name: string; isDefault: boolean }>;
  backgroundLibrary: Array<{ id: number; url: string; isDefault: boolean }>;
  values: { songNumber: string; songBookCode: string; background: string; lyricText: string };
  onChange: (field: 'songNumber' | 'songBookCode' | 'background' | 'lyricText', val: string) => void;
  isLyricOpen: boolean;
  onToggleLyricEditor: () => void;
  isSavingBook?: boolean;
  onSaveToBook?: () => void;
  suggestion?: any;
  onAcceptSuggestion?: () => void;
  disabled?: boolean;
  hymnIndex?: HymnIndexEntry[];
}) {
  const entryDef = songSetEntries.find((e) => e.variableName === refKey);
  const title = entryDef?.title || refKey.replace(/_/g, ' ').toUpperCase();
  const defaultBook = songBooks.find((b) => b.isDefault);
  const selectedBookCode = values.songBookCode || defaultBook?.bookCode || 'SDAH';
  const hasValidNum = /^\d+$/.test(values.songNumber.trim());

  return (
    <div
      data-slot="song-set-row"
      className="rounded-lg border border-border/50 bg-background/50 p-3 transition-colors hover:border-border space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          {title}
        </span>
        {suggestion && (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="border-primary/40 text-[10px]">
              Saran: #{suggestion.songNumber || suggestion.number} ({suggestion.songBookCode || 'SDAH'})
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={onAcceptSuggestion}
              disabled={disabled}
            >
              Gunakan
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Book Selector */}
        <div className="w-28 shrink-0">
          <Select
            value={values.songBookCode || defaultBook?.bookCode || ''}
            onValueChange={(val) => onChange('songBookCode', val ?? '')}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Book" />
            </SelectTrigger>
            <SelectContent>
              {songBooks.map((b) => (
                <SelectItem key={b.bookCode} value={b.bookCode}>
                  {b.bookCode} {b.isDefault ? '(Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Number Autocomplete */}
        <div className="min-w-[10rem] flex-1">
          <HymnNumberAutocomplete
            value={values.songNumber}
            bookCode={selectedBookCode}
            onChange={(v) => onChange('songNumber', v)}
            hymnIndex={hymnIndex}
            placeholder="Nomor lagu..."
            disabled={disabled}
          />
        </div>

        {/* Background Selector */}
        <div className="w-36 shrink-0">
          <Select
            value={values.background || 'default'}
            onValueChange={(val) =>
              onChange('background', !val || val === 'default' ? '' : val)
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Background" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Background</SelectItem>
              {backgroundLibrary.map((img) => (
                <SelectItem key={img.id} value={img.url}>
                  {img.url.split('/').pop() || `Image ${img.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lyrics Editor Toggle */}
        <div className="shrink-0 flex items-center gap-1.5">
          {hasValidNum && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs"
              onClick={onToggleLyricEditor}
            >
              {isLyricOpen ? 'Tutup Lirik' : 'Edit Lirik'}
            </Button>
          )}
          {hasValidNum && onSaveToBook && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-2.5 text-xs text-primary"
              onClick={onSaveToBook}
              disabled={disabled || isSavingBook}
            >
              {isSavingBook ? 'Menyimpan...' : 'Simpan ke Buku'}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Lyrics Editor */}
      {isLyricOpen && (
        <div className="pt-2 border-t border-border/40">
          <Textarea
            className="text-xs font-mono w-full h-32"
            value={values.lyricText}
            onChange={(e) => onChange('lyricText', e.target.value)}
            placeholder="Ketik atau edit bait lirik di sini..."
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function AnnouncementSlotRenderer({
  slotIndex,
  value,
  onChange,
  disabled = false,
}: {
  slotIndex: number;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="p-3 rounded-md border border-border/60 bg-muted/20 space-y-2 flex flex-col gap-4"
      data-slot={`announcement-slot-${slotIndex}`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
        Announcement Slot {slotIndex}
      </span>
      <ImageUploadField
        label={`Slot ${slotIndex} Poster`}
        value={value}
        onChange={onChange}
        previewAlt={`Announcement Slot ${slotIndex}`}
        uploadLabel={`Upload Slot ${slotIndex} Poster`}
        disabled={disabled}
      />
    </div>
  );
}
