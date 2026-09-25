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
import { ImageUploadField } from '@/components/ImageUploadField';
import type { HymnIndexEntry } from '@/lib/worship-form-fields';
import { cn } from '@/lib/utils';
import type {
  PredefinedFieldDef,
  FormGroupSlotDef,
  FormGroupingDef,
  FormLayoutData,
} from '@/lib/form-layout';

export type {
  PredefinedFieldDef,
  FormGroupSlotDef,
  FormGroupingDef,
  FormLayoutData,
};

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
  hymnIndex = [],
}: DynamicFormBodyProps) {
  const fieldDefsByVarName = React.useMemo(() => {
    const map = new Map<string, PredefinedFieldDef>();
    for (const f of (layoutData.predefined_fields || [])) {
      map.set(f.variable_name, f);
    }
    return map;
  }, [layoutData.predefined_fields]);

  return (
    <div className="space-y-6" data-slot="dynamic-form-body">
      {/* Render each Card Grouping */}
      {(layoutData.groupings || []).map((grouping) => (
        <Card
          key={grouping.id}
          className="border-border/80 shadow-md bg-card/60 backdrop-blur-md"
          data-grouping-id={grouping.id}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-bold">{grouping.label}</CardTitle>
            {grouping.description && (
              <CardDescription>{grouping.description}</CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {grouping.slots.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Belum ada slot pada kartu ini.
              </p>
            ) : (
              grouping.slots.map((slot) => {
                return (
                  <div
                    key={slot.id}
                    className="relative group/slot"
                    data-slot-id={slot.id}
                    data-slot-kind={slot.widget_kind}
                    data-slot-ref={slot.ref_key}
                  >
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
              Suggestion: {suggestion.slice(0, 30)}
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
              Use
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
        <ImageUploadField
          label={label}
          value={value}
          onChange={onChange}
          previewAlt={label}
          uploadLabel={`Upload ${label}`}
          disabled={disabled}
          cropConfig={
            refKey === 'family_of_the_week' || refKey === 'youth_of_the_week'
              ? { defaultAspect: 1, defaultResize: '800px' }
              : { defaultAspect: null, defaultResize: '1080p' }
          }
        />
      )}
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
  const selectedFormBg = backgroundLibrary.find((b) => b.url === values.background);

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
              Suggestion: #{suggestion.songNumber || suggestion.number} ({suggestion.songBookCode || 'SDAH'})
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={onAcceptSuggestion}
              disabled={disabled}
            >
              Use
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
            placeholder="Song number..."
            disabled={disabled}
          />
        </div>

        {/* Background Selector */}
        <div className="w-48 shrink-0">
          <Select
            value={values.background || 'default'}
            onValueChange={(val) =>
              onChange('background', !val || val === 'default' ? '' : val)
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-9 text-xs">
              {selectedFormBg ? (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <img
                    src={selectedFormBg.url}
                    alt=""
                    className="h-4 w-6 shrink-0 rounded border border-border object-cover bg-muted"
                  />
                  <span className="truncate text-xs">
                    Image {selectedFormBg.id}{selectedFormBg.isDefault ? ' (Default)' : ''}
                  </span>
                </div>
              ) : (
                <SelectValue placeholder="Default Background" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                <span className="truncate text-xs text-muted-foreground">Default Background</span>
              </SelectItem>
              {backgroundLibrary.map((img) => (
                <SelectItem key={img.id} value={img.url}>
                  <div className="flex items-center gap-2 py-0.5">
                    <img
                      src={img.url}
                      alt=""
                      className="h-6 w-9 shrink-0 rounded border border-border object-cover bg-muted"
                    />
                    <span className="truncate text-xs">
                      Image {img.id}{img.isDefault ? ' (Default)' : ''}
                    </span>
                  </div>
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
              {isLyricOpen ? 'Close Lyrics' : 'Edit Lyrics'}
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
              {isSavingBook ? 'Saving...' : 'Save to Book'}
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
        cropConfig={{ defaultAspect: null, defaultResize: '1080p' }}
      />
    </div>
  );
}
