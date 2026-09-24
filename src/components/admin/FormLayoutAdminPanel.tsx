import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Trash2, ArrowUp, ArrowDown, Play, Sparkles, RefreshCw, CheckCircle2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { compileProfileRegex, extractPredefinedFields } from '@/lib/parser-rules';
import type { SongSetEntrySlot } from '@/lib/song-set-matching';
import type { FormLayoutData, FormGroupingDef, PredefinedFieldDef } from '@/lib/form-layout';

type AdminTab = 'layout' | 'fields' | 'sandbox';

const DEFAULT_RUNDOWN_SAMPLE = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE
Introit: SDAH #100
Praise Song: SDAH #159
Scripture Reading: Romans 8:28 (KJV)
Special Song: Sanctuary Choir
Sermon: Pastor Alexander "The Blessed Hope"
Closing Prayer: Deacon Michael
Family & Youth: Johnson Family`;

export function FormLayoutAdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('layout');
  const [layoutData, setLayoutData] = useState<FormLayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grouping creation state
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Slot creation state
  const [targetGroupingId, setTargetGroupingId] = useState<string>('');
  const [newSlotKind, setNewSlotKind] = useState<'predefined_field' | 'song_set_entry' | 'announcement_slot'>('predefined_field');
  const [newSlotRefKey, setNewSlotRefKey] = useState('');

  // Field creation/edit state
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldVarName, setFieldVarName] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'text_area' | 'image'>('text');
  const [inputLength, setInputLength] = useState<number | ''>(100);
  const [initialLines, setInitialLines] = useState<number | ''>(5);
  const [extractionRegex, setExtractionRegex] = useState('');
  const [fieldFormError, setFieldFormError] = useState<string | null>(null);

  // Inline slot regex edit state
  const [editingSlotRegexVar, setEditingSlotRegexVar] = useState<string | null>(null);
  const [slotInlineRegex, setSlotInlineRegex] = useState('');

  // Seeder state
  const [seeding, setSeeding] = useState(false);
  const [seedReport, setSeedReport] = useState<string | null>(null);

  // Master data for testing sandbox
  const [songSetEntries, setSongSetEntries] = useState<SongSetEntrySlot[]>([]);

  // Sandbox & Test Area state
  const [testRundownText, setTestRundownText] = useState(DEFAULT_RUNDOWN_SAMPLE);
  const [singleRegexPattern, setSingleRegexPattern] = useState('(?i)^Sermon\\s*[:\\-]\\s*(?<value>.+?)(?:\\s+[\"“](?<title>[^\"”]+)[\"”])?\\s*$');
  const [singleRegexResult, setSingleRegexResult] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{
    fields: Array<{ label: string; variableName: string; value: string; status: 'matched' | 'empty regex' | 'unmatched' }>;
    songs: Array<{ slotVariable: string; title: string; songNumber?: number; songBookCode?: string; matchKind?: string; status: 'matched' | 'unfilled' }>;
    unmappedLines: string[];
  } | null>(null);

  const fetchLayout = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resLayout, resEntries] = await Promise.all([
        fetch('/api/worship-form-layout'),
        fetch('/api/song-set-entries'),
      ]);

      if (resLayout.ok) {
        const data = (await resLayout.json()) as FormLayoutData;
        setLayoutData(data);
        if (data.groupings.length > 0 && !targetGroupingId) {
          setTargetGroupingId(data.groupings[0].id);
        }
      } else {
        setError('Failed to load form layout');
      }

      if (resEntries.ok) {
        const d = (await resEntries.json()) as { entries?: SongSetEntrySlot[] };
        if (Array.isArray(d.entries)) {
          setSongSetEntries(d.entries);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading form layout');
    } finally {
      setLoading(false);
    }
  };

  const fetchLayoutQuiet = async () => {
    try {
      const [resLayout, resEntries] = await Promise.all([
        fetch('/api/worship-form-layout'),
        fetch('/api/song-set-entries'),
      ]);
      if (resLayout.ok) {
        const data = (await resLayout.json()) as FormLayoutData;
        setLayoutData(data);
      }
      if (resEntries.ok) {
        const d = (await resEntries.json()) as { entries?: SongSetEntrySlot[] };
        if (Array.isArray(d.entries)) {
          setSongSetEntries(d.entries);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchLayout();
  }, []);

  // ---------------------------------------------------------------------------
  // Optimistic AJAX Actions with Automatic Snapshot Rollback
  // ---------------------------------------------------------------------------

  const handleCreateGrouping = async () => {
    if (!newGroupLabel.trim()) return;
    try {
      const res = await fetch('/api/admin/form-groupings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout_id: layoutData?.layout.id || 'default-layout',
          label: newGroupLabel.trim(),
          description: newGroupDesc.trim(),
        }),
      });
      if (res.ok) {
        setNewGroupLabel('');
        setNewGroupDesc('');
        await fetchLayoutQuiet();
        toast.success('Card grouping created successfully');
      } else {
        toast.error('Failed to create card grouping');
      }
    } catch {
      toast.error('Network error creating card grouping');
    }
  };

  const handleMoveGrouping = async (index: number, direction: 'up' | 'down') => {
    if (!layoutData) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= layoutData.groupings.length) return;

    const previousLayout = layoutData;
    const reordered = [...layoutData.groupings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const updatedGroupings = reordered.map((g, i) => ({ ...g, sort_order: i + 1 }));
    const payload = reordered.map((g, i) => ({ id: g.id, sort_order: i + 1 }));

    // Optimistic UI update: immediate state transformation without full-page spinner
    setLayoutData({ ...layoutData, groupings: updatedGroupings });

    try {
      const res = await fetch('/api/admin/form-groupings/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setLayoutData(previousLayout);
        toast.error('Failed to save card order. Reverting changes.');
      }
    } catch {
      setLayoutData(previousLayout);
      toast.error('Network error during card reorder. Reverting changes.');
    }
  };

  const handleMoveSlot = async (groupingId: string, slotIndex: number, direction: 'up' | 'down') => {
    if (!layoutData) return;
    const gIndex = layoutData.groupings.findIndex((g) => g.id === groupingId);
    if (gIndex === -1) return;
    const grouping = layoutData.groupings[gIndex];
    const targetIdx = direction === 'up' ? slotIndex - 1 : slotIndex + 1;
    if (targetIdx < 0 || targetIdx >= grouping.slots.length) return;

    const previousLayout = layoutData;
    const reorderedSlots = [...grouping.slots];
    const [moved] = reorderedSlots.splice(slotIndex, 1);
    reorderedSlots.splice(targetIdx, 0, moved);
    const updatedSlots = reorderedSlots.map((s, i) => ({ ...s, sort_order: i + 1 }));

    const updatedGroupings = [...layoutData.groupings];
    updatedGroupings[gIndex] = { ...grouping, slots: updatedSlots };

    // Optimistic UI update
    setLayoutData({ ...layoutData, groupings: updatedGroupings });

    try {
      const res = await fetch('/api/admin/form-grouping-slots/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grouping_id: groupingId,
          slots: updatedSlots.map((s) => ({ id: s.id, sort_order: s.sort_order })),
        }),
      });
      if (!res.ok) {
        setLayoutData(previousLayout);
        toast.error('Failed to save slot order. Reverting changes.');
      }
    } catch {
      setLayoutData(previousLayout);
      toast.error('Network error during slot reorder. Reverting changes.');
    }
  };

  const handleTransferSlot = async (slotId: string, targetGroupingId: string) => {
    if (!layoutData || !targetGroupingId) return;
    const previousLayout = layoutData;

    let foundSlot: any = null;
    const updatedGroupings = layoutData.groupings.map((g) => {
      const s = g.slots.find((sl) => sl.id === slotId);
      if (s) {
        foundSlot = { ...s, grouping_id: targetGroupingId };
        return { ...g, slots: g.slots.filter((sl) => sl.id !== slotId) };
      }
      return g;
    });

    if (!foundSlot) return;

    const targetGIndex = updatedGroupings.findIndex((g) => g.id === targetGroupingId);
    if (targetGIndex !== -1) {
      foundSlot.sort_order = updatedGroupings[targetGIndex].slots.length + 1;
      updatedGroupings[targetGIndex] = {
        ...updatedGroupings[targetGIndex],
        slots: [...updatedGroupings[targetGIndex].slots, foundSlot],
      };
    }

    // Optimistic UI update
    setLayoutData({ ...layoutData, groupings: updatedGroupings });

    try {
      const res = await fetch(`/api/admin/form-grouping-slots/${slotId}/move-grouping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_grouping_id: targetGroupingId }),
      });
      if (!res.ok) {
        setLayoutData(previousLayout);
        toast.error('Failed to transfer slot. Reverting changes.');
      } else {
        toast.success('Slot transferred successfully');
      }
    } catch {
      setLayoutData(previousLayout);
      toast.error('Network error during slot transfer. Reverting changes.');
    }
  };

  const handleDeleteGrouping = async (id: string) => {
    if (!layoutData || !window.confirm('Delete this grouping card and all its slots?')) return;
    const previousLayout = layoutData;
    setLayoutData({
      ...layoutData,
      groupings: layoutData.groupings.filter((g) => g.id !== id),
    });

    try {
      const res = await fetch(`/api/admin/form-groupings/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setLayoutData(previousLayout);
        toast.error('Failed to delete grouping. Reverting changes.');
      } else {
        toast.success('Grouping card deleted');
      }
    } catch {
      setLayoutData(previousLayout);
      toast.error('Network error deleting grouping. Reverting changes.');
    }
  };

  const handleAddSlot = async () => {
    if (!layoutData || !targetGroupingId || !newSlotRefKey.trim()) return;
    try {
      const res = await fetch('/api/admin/form-grouping-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grouping_id: targetGroupingId,
          widget_kind: newSlotKind,
          ref_key: newSlotRefKey.trim(),
        }),
      });
      if (res.ok) {
        setNewSlotRefKey('');
        const newSlot = (await res.json()) as any;
        if (newSlot && newSlot.id) {
          setLayoutData((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              groupings: prev.groupings.map((g) => {
                if (g.id === targetGroupingId) {
                  return { ...g, slots: [...g.slots, newSlot] };
                }
                return g;
              }),
            };
          });
        } else {
          await fetchLayoutQuiet();
        }
        toast.success('Slot added to grouping');
      } else if (res.status === 409) {
        toast.error('This slot already exists in this layout (cardinality limit).');
      } else {
        toast.error('Failed to add slot');
      }
    } catch {
      toast.error('Network error adding slot');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!layoutData) return;
    const previousLayout = layoutData;
    setLayoutData({
      ...layoutData,
      groupings: layoutData.groupings.map((g) => ({
        ...g,
        slots: g.slots.filter((s) => s.id !== slotId),
      })),
    });

    try {
      const res = await fetch(`/api/admin/form-grouping-slots/${slotId}`, { method: 'DELETE' });
      if (!res.ok) {
        setLayoutData(previousLayout);
        toast.error('Failed to delete slot. Reverting changes.');
      } else {
        toast.success('Slot removed');
      }
    } catch {
      setLayoutData(previousLayout);
      toast.error('Network error deleting slot. Reverting changes.');
    }
  };

  const handleSaveField = async () => {
    setFieldFormError(null);
    if (!fieldName.trim() || !fieldVarName.trim()) {
      setFieldFormError('Shown Text and Variable Name are required');
      return;
    }
    if (fieldType === 'image' && extractionRegex.trim()) {
      setFieldFormError('Image fields cannot have an extraction regex');
      return;
    }

    try {
      const res = await fetch('/api/admin/predefined-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFieldId || undefined,
          variable_name: fieldVarName.trim(),
          shown_text: fieldName.trim(),
          field_type: fieldType,
          input_length: inputLength !== '' ? Number(inputLength) : null,
          initial_lines: initialLines !== '' ? Number(initialLines) : null,
          extraction_regex: extractionRegex.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingFieldId(null);
        setFieldName('');
        setFieldVarName('');
        setFieldType('text');
        setInputLength(100);
        setInitialLines(5);
        setExtractionRegex('');
        await fetchLayoutQuiet();
        toast.success('Predefined field saved successfully');
      } else {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setFieldFormError(errData.error || 'Failed to save field');
      }
    } catch (err: unknown) {
      setFieldFormError(err instanceof Error ? err.message : 'Error saving field');
    }
  };

  const handleSaveInlineSlotRegex = async (varName: string, widgetKind?: string) => {
    const trimmed = slotInlineRegex.trim();
    if (trimmed) {
      try {
        compileProfileRegex(trimmed);
      } catch (err: unknown) {
        toast.error(`Invalid regex syntax: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    if (widgetKind === 'song_set_entry') {
      try {
        const res = await fetch(`/api/admin/song-set-entries/${encodeURIComponent(varName)}/extraction-regex`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extraction_regex: trimmed || '',
          }),
        });
        if (res.ok) {
          setEditingSlotRegexVar(null);
          setSlotInlineRegex('');
          await fetchLayoutQuiet();
          toast.success('Song Set entry regex saved');
        } else {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(errData.error || 'Failed to update song set regex');
        }
      } catch {
        toast.error('Network error updating song set regex');
      }
      return;
    }

    const field = layoutData?.predefined_fields.find((f) => f.variable_name === varName);
    if (!field) return;

    try {
      const res = await fetch('/api/admin/predefined-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: field.id,
          variable_name: field.variable_name,
          shown_text: field.shown_text,
          field_type: field.field_type,
          input_length: field.input_length,
          initial_lines: field.initial_lines,
          extraction_regex: trimmed || null,
        }),
      });
      if (res.ok) {
        setEditingSlotRegexVar(null);
        setSlotInlineRegex('');
        await fetchLayoutQuiet();
        toast.success(`Regex updated for ${field.shown_text}`);
      } else {
        toast.error('Failed to update regex pattern');
      }
    } catch {
      toast.error('Network error updating regex');
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedReport(null);
    try {
      const res = await fetch('/api/admin/predefined-fields/seed-defaults', { method: 'POST' });
      if (res.ok) {
        const report = (await res.json()) as { inserted: number; skipped: number; inactive_skipped: number };
        setSeedReport(`Seeded: ${report.inserted} inserted, ${report.skipped} skipped, ${report.inactive_skipped} inactive skipped.`);
        await fetchLayoutQuiet();
        toast.success('Default predefined fields seeded');
      }
    } catch {
      setSeedReport('Failed to run default seeder');
    } finally {
      setSeeding(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Production-Parity Live Rundown Test Area Execution
  // ---------------------------------------------------------------------------

  const handleRunRundownTest = () => {
    if (!testRundownText.trim() || !layoutData) return;

    const rawLines = testRundownText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    const mappedIndices = new Set<number>();

    // Standard date pattern & section delimiters (production parity)
    const dateRegex = /(?:20\d{2}-\d{2}-\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}/i;
    const sectionRegex = /^(BIBLE\s+TALK|DIVINE\s+SERVICE|BREAK)\b/i;

    rawLines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        mappedIndices.add(idx);
        return;
      }
      if (dateRegex.test(trimmed) || sectionRegex.test(trimmed)) {
        mappedIndices.add(idx);
      }
    });

    // 1. Predefined Fields extraction
    const extractedFieldsMap = extractPredefinedFields(testRundownText, layoutData.predefined_fields || []);
    const fieldResults = (layoutData.predefined_fields || []).map((f) => {
      const val = extractedFieldsMap[f.variable_name] || '';
      let status: 'matched' | 'empty regex' | 'unmatched' = 'unmatched';
      if (!f.extraction_regex || !f.extraction_regex.trim()) {
        status = 'empty regex';
      } else if (val) {
        status = 'matched';
      }
      return {
        label: f.shown_text,
        variableName: f.variable_name,
        value: val,
        status,
      };
    });

    // Mark lines matching active predefined field regexes as mapped
    for (const f of layoutData.predefined_fields || []) {
      if (!f.extraction_regex || !f.extraction_regex.trim()) continue;
      try {
        const re = compileProfileRegex(f.extraction_regex.trim());
        rawLines.forEach((line, idx) => {
          if (line.trim() && re.test(line)) {
            mappedIndices.add(idx);
          }
        });
      } catch {
        // ignore invalid regex
      }
    }

    // Mark lines matching active song set entry regexes as mapped
    for (const entry of songSetEntries || []) {
      const regexPattern = entry.extractionRegex || (entry as any).extraction_regex;
      if (!regexPattern || !regexPattern.trim()) continue;
      try {
        const re = compileProfileRegex(regexPattern.trim());
        rawLines.forEach((line, idx) => {
          if (line.trim() && re.test(line)) {
            mappedIndices.add(idx);
          }
        });
      } catch {
        // ignore invalid regex
      }
    }

    // 2. Dynamic Song Set entries extraction (direct regex evaluation)
    const songResults = (songSetEntries || []).map((entry) => {
      const varName = entry.variableName || (entry as any).variable_name;
      const regexPattern = entry.extractionRegex || (entry as any).extraction_regex;
      if (!regexPattern || !regexPattern.trim()) {
        return {
          slotVariable: varName,
          title: entry.title,
          status: 'unfilled' as const,
        };
      }

      let found = false;
      try {
        const re = compileProfileRegex(regexPattern.trim());
        for (let idx = 0; idx < rawLines.length; idx++) {
          const line = rawLines[idx];
          if (!line.trim()) continue;
          const m = line.match(re);
          if (m) {
            const numStr = m.groups?.number || (m[1] && /^\d+$/.test(m[1].trim()) ? m[1].trim() : null);
            const bookStr = m.groups?.book || 'SDAH';
            if (numStr) {
              const num = parseInt(numStr, 10);
              if (num > 0) {
                mappedIndices.add(idx);
                found = true;
                return {
                  slotVariable: varName,
                  title: entry.title,
                  songNumber: num,
                  songBookCode: bookStr.trim().toUpperCase(),
                  matchKind: 'dynamic_regex',
                  status: 'matched' as const,
                };
              }
            }
          }
        }

        if (!found) {
          const m = testRundownText.match(re);
          if (m) {
            const numStr = m.groups?.number || (m[1] && /^\d+$/.test(m[1].trim()) ? m[1].trim() : null);
            const bookStr = m.groups?.book || 'SDAH';
            if (numStr) {
              const num = parseInt(numStr, 10);
              if (num > 0) {
                return {
                  slotVariable: varName,
                  title: entry.title,
                  songNumber: num,
                  songBookCode: bookStr.trim().toUpperCase(),
                  matchKind: 'dynamic_regex',
                  status: 'matched' as const,
                };
              }
            }
          }
        }
      } catch {
        // ignore invalid regex
      }

      return {
        slotVariable: varName,
        title: entry.title,
        status: 'unfilled' as const,
      };
    });

    // 3. Collect truly unmapped lines
    const unmappedLines: string[] = [];
    rawLines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed && !mappedIndices.has(idx)) {
        unmappedLines.push(line);
      }
    });

    setTestResults({
      fields: fieldResults,
      songs: songResults,
      unmappedLines,
    });
  };

  const runSingleRegexTest = () => {
    if (!singleRegexPattern.trim()) {
      setSingleRegexResult('Please enter a valid regex pattern.');
      return;
    }
    try {
      const re = compileProfileRegex(singleRegexPattern.trim());
      const lines = testRundownText.split('\n');
      for (const line of lines) {
        const m = line.match(re);
        if (m) {
          const val = m.groups?.value || (m[1] !== undefined ? m[1] : m[0]);
          setSingleRegexResult(`Match on line: "${line}"\nExtracted value: "${val}"\nNamed Groups: ${JSON.stringify(m.groups || {})}`);
          return;
        }
      }
      setSingleRegexResult('No match found across any line in sample text.');
    } catch (err: unknown) {
      setSingleRegexResult(`Regex Compilation Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading && !layoutData) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading Form Layout Settings...</div>;
  }

  return (
    <div className="space-y-6" data-slot="admin-form-layout-panel">
      {/* Sub-tabs header */}
      <Card className="p-1.5 bg-muted/40">
        <div className="flex flex-wrap gap-1.5 items-center justify-between">
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant={activeTab === 'layout' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setActiveTab('layout')}
            >
              Card Groupings & Layout
            </Button>
            <Button
              type="button"
              variant={activeTab === 'fields' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setActiveTab('fields')}
            >
              Predefined Fields & Regex
            </Button>
            <Button
              type="button"
              variant={activeTab === 'sandbox' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setActiveTab('sandbox')}
            >
              Rundown Test Area & Sandbox
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={handleSeedDefaults}
              disabled={seeding}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {seeding ? 'Seeding...' : 'Seed Default Predefined Fields'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={fetchLayout}
              title="Refresh Layout"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {seedReport && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded text-xs text-primary font-mono">
          {seedReport}
        </div>
      )}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
          {error}
        </div>
      )}

      {/* TAB 1: Card Groupings & Layout Management */}
      {activeTab === 'layout' && layoutData && (
        <div className="space-y-6">
          {/* Add Grouping Card */}
          <Card className="border-border/70">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" /> Tambah Kartu Form Baru
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Label Kartu (misal: Afternoon Program)"
                  value={newGroupLabel}
                  onChange={(e) => setNewGroupLabel(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Deskripsi singkat"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="text-xs h-8"
                />
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

          {/* Add Slot to Grouping */}
          <Card className="border-border/70">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" /> Tambah Slot ke Kartu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                <Select value={targetGroupingId} onValueChange={(v) => setTargetGroupingId(v || '')}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Pilih Kartu" />
                  </SelectTrigger>
                  <SelectContent>
                    {layoutData.groupings.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={newSlotKind}
                  onValueChange={(v) =>
                    setNewSlotKind((v as 'predefined_field' | 'song_set_entry' | 'announcement_slot') || 'predefined_field')
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
                  value={newSlotRefKey}
                  onChange={(e) => setNewSlotRefKey(e.target.value)}
                  className="text-xs h-8 font-mono"
                />

                <Button
                  type="button"
                  size="sm"
                  className="text-xs h-8"
                  onClick={handleAddSlot}
                  disabled={!targetGroupingId || !newSlotRefKey.trim()}
                >
                  Tambahkan Slot
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Groupings & Slots List with Inline Regex Indicators */}
          <div className="space-y-4">
            {layoutData.groupings.map((grouping, idx) => (
              <Card key={grouping.id} className="border-border/70 bg-card/60">
                <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      #{grouping.sort_order}
                    </Badge>
                    <div>
                      <h4 className="font-bold text-sm">{grouping.label}</h4>
                      {grouping.description && (
                        <p className="text-xs text-muted-foreground">{grouping.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={idx === 0}
                      onClick={() => handleMoveGrouping(idx, 'up')}
                      title="Move Grouping Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={idx === layoutData.groupings.length - 1}
                      onClick={() => handleMoveGrouping(idx, 'down')}
                      title="Move Grouping Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteGrouping(grouping.id)}
                      title="Delete Grouping"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-3">
                  {grouping.slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Belum ada slot pada kartu ini.</p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {grouping.slots.map((s, sIdx) => {
                        const isPredefined = s.widget_kind === 'predefined_field';
                        const isSongSet = s.widget_kind === 'song_set_entry';
                        const fieldDef = isPredefined
                          ? layoutData.predefined_fields.find((f) => f.variable_name === s.ref_key)
                          : null;
                        const songSetDef = isSongSet
                          ? songSetEntries.find((se) => se.variableName === s.ref_key || (se as any).variable_name === s.ref_key)
                          : null;
                        const activeRegex = isSongSet
                          ? (songSetDef?.extraction_regex ?? songSetDef?.extractionRegex)
                          : fieldDef?.extraction_regex;
                        const hasRegex = !!activeRegex;
                        const canEditRegex = (isPredefined && fieldDef && fieldDef.field_type !== 'image') || isSongSet;

                        return (
                          <div key={s.id} className="py-2.5 space-y-1.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 font-mono">
                                <span className="text-muted-foreground">#{s.sort_order}</span>
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  {s.widget_kind}
                                </Badge>
                                <span className="font-semibold text-foreground">{s.ref_key}</span>
                                {fieldDef && (
                                  <span className="text-[11px] text-muted-foreground font-sans">
                                    ({fieldDef.shown_text})
                                  </span>
                                )}
                                {songSetDef && (
                                  <span className="text-[11px] text-muted-foreground font-sans">
                                    ({songSetDef.title})
                                  </span>
                                )}
                                {(isPredefined || isSongSet) && (
                                  hasRegex ? (
                                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 text-[10px]">
                                      Regex Aktif
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground/70 text-[10px]">
                                      Tanpa Regex
                                    </Badge>
                                  )
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {canEditRegex && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[11px] px-2 text-primary"
                                    onClick={() => {
                                      if (editingSlotRegexVar === s.ref_key) {
                                        setEditingSlotRegexVar(null);
                                      } else {
                                        setEditingSlotRegexVar(s.ref_key);
                                        setSlotInlineRegex(activeRegex || '');
                                      }
                                    }}
                                  >
                                    {editingSlotRegexVar === s.ref_key ? 'Tutup Regex' : 'Edit Regex'}
                                  </Button>
                                )}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  disabled={sIdx === 0}
                                  onClick={() => handleMoveSlot(grouping.id, sIdx, 'up')}
                                  title="Move Slot Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  disabled={sIdx === grouping.slots.length - 1}
                                  onClick={() => handleMoveSlot(grouping.id, sIdx, 'down')}
                                  title="Move Slot Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </Button>

                                {layoutData.groupings.filter((g) => g.id !== grouping.id).length > 0 && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 text-[11px] px-1.5 py-0 font-normal text-muted-foreground hover:text-foreground cursor-pointer"
                                      title="Pindah Kartu..."
                                    >
                                      Pindah Kartu...
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="text-xs">
                                      {layoutData.groupings
                                        .filter((g) => g.id !== grouping.id)
                                        .map((g) => (
                                          <DropdownMenuItem
                                            key={g.id}
                                            onClick={() => handleTransferSlot(s.id, g.id)}
                                            className="cursor-pointer text-xs"
                                          >
                                            → {g.label}
                                          </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteSlot(s.id)}
                                  title="Delete Slot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Active Regex display line */}
                            {hasRegex && editingSlotRegexVar !== s.ref_key && (
                              <p className="text-[11px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded truncate max-w-2xl">
                                regex: {activeRegex}
                              </p>
                            )}

                            {/* Inline Regex Editor Row */}
                            {editingSlotRegexVar === s.ref_key && (
                              <div className="flex gap-2 items-center pt-1">
                                <Input
                                  value={slotInlineRegex}
                                  onChange={(e) => setSlotInlineRegex(e.target.value)}
                                  placeholder="(?i)^Pattern\s*[:\-]\s*(?<value>.*)$"
                                  className="text-xs font-mono h-7 flex-1"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  className="text-xs h-7 px-2.5"
                                  onClick={() => handleSaveInlineSlotRegex(s.ref_key, s.widget_kind)}
                                >
                                  Simpan
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  onClick={() => setEditingSlotRegexVar(null)}
                                >
                                  Batal
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Predefined Fields Management */}
      {activeTab === 'fields' && layoutData && (
        <div className="space-y-6">
          {/* Create/Edit Field Card */}
          <Card className="border-border/70">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" />
                {editingFieldId ? 'Edit Predefined Field' : 'Buat Predefined Field Baru'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fieldFormError && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                  {fieldFormError}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Shown Text
                  </label>
                  <Input
                    placeholder="e.g. Visiting Speaker"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Variable Name (immutable)
                  </label>
                  <Input
                    placeholder="e.g. visiting_speaker"
                    value={fieldVarName}
                    onChange={(e) => setFieldVarName(e.target.value)}
                    disabled={!!editingFieldId}
                    className="text-xs h-8 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                    Field Type
                  </label>
                  <Select value={fieldType} onValueChange={(v) => setFieldType((v as 'text' | 'text_area' | 'image') || 'text')}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text (Scalar)</SelectItem>
                      <SelectItem value="text_area">Text Area (Multiline)</SelectItem>
                      <SelectItem value="image">Image Asset</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {fieldType === 'text' && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Visual Input Length (max chars)
                    </label>
                    <Input
                      type="number"
                      value={inputLength}
                      onChange={(e) => setInputLength(e.target.value ? Number(e.target.value) : '')}
                      className="text-xs h-8"
                    />
                  </div>
                )}
                {fieldType === 'text_area' && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Initial Lines (2-20 rows)
                    </label>
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      value={initialLines}
                      onChange={(e) => setInitialLines(e.target.value ? Number(e.target.value) : '')}
                      className="text-xs h-8"
                    />
                  </div>
                )}
                {fieldType !== 'image' && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Extraction Regex with (?&lt;value&gt;...) named group
                    </label>
                    <Input
                      placeholder="(?i)^Label\s*[:\-]\s*(?<value>.*)$"
                      value={extractionRegex}
                      onChange={(e) => setExtractionRegex(e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingFieldId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setEditingFieldId(null);
                      setFieldName('');
                      setFieldVarName('');
                      setExtractionRegex('');
                    }}
                  >
                    Batal
                  </Button>
                )}
                <Button type="button" size="sm" className="text-xs h-8" onClick={handleSaveField}>
                  {editingFieldId ? 'Simpan Perubahan' : 'Buat Field'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Predefined Fields List */}
          <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-card/60">
            {layoutData.predefined_fields.map((f) => (
              <div key={f.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{f.shown_text}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {f.variable_name}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {f.field_type}
                    </Badge>
                    {f.seed_key && (
                      <Badge variant="outline" className="border-primary/30 text-[10px]">
                        Seeded
                      </Badge>
                    )}
                    {f.extraction_regex ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        Regex Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground/60 text-[10px]">
                        No Regex
                      </Badge>
                    )}
                  </div>
                  {f.extraction_regex && (
                    <p className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-1.5 rounded">
                      regex: {f.extraction_regex}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    onClick={() => {
                      setEditingFieldId(f.id);
                      setFieldName(f.shown_text);
                      setFieldVarName(f.variable_name);
                      setFieldType(f.field_type);
                      setInputLength(f.input_length ?? '');
                      setInitialLines(f.initial_lines ?? '');
                      setExtractionRegex(f.extraction_regex ?? '');
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      if (!window.confirm(`Archive / soft-delete field "${f.shown_text}"?`)) return;
                      await fetch(`/api/admin/predefined-fields/${f.id}`, { method: 'DELETE' });
                      await fetchLayoutQuiet();
                      toast.success('Field archived');
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Executable Production-Parity Rundown Test Area & Sandbox */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6" data-slot="rundown-test-area">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="py-3.5">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" /> Rundown Parsing Test Area (Production-Parity)
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  Active Layout: {layoutData?.layout.title || 'Default'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Tempel teks buletin warta di bawah ini untuk menguji ekstraksi otomatis predefined fields dan song set matching secara real-time dengan parser produksi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                  Raw Rundown Text / Teks Warta Acara
                </label>
                <Textarea
                  rows={8}
                  value={testRundownText}
                  onChange={(e) => setTestRundownText(e.target.value)}
                  className="text-xs font-mono w-full"
                  placeholder="Tempel rundown lengkap di sini..."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="text-xs h-8 gap-1.5"
                  onClick={handleRunRundownTest}
                >
                  <Play className="w-3.5 h-3.5" /> Test Rundown Extraction (Production Parity)
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Evaluates against {layoutData?.predefined_fields.length || 0} predefined fields & {songSetEntries.length} song set slots
                </span>
              </div>

              {/* Extraction Results */}
              {testResults && (
                <div className="space-y-4 pt-3 border-t border-border/50">
                  {/* Predefined Fields Results */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Hasil Ekstraksi Predefined Fields
                    </h4>
                    <div className="rounded-md border border-border/50 overflow-hidden text-xs">
                      <table className="w-full divide-y divide-border/40">
                        <thead className="bg-muted/40 font-semibold">
                          <tr>
                            <th className="p-2 text-left">Field Label</th>
                            <th className="p-2 text-left">Variable Name</th>
                            <th className="p-2 text-left">Extracted Value</th>
                            <th className="p-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {testResults.fields.map((f) => (
                            <tr key={f.variableName} className="hover:bg-muted/20">
                              <td className="p-2 font-medium">{f.label}</td>
                              <td className="p-2 font-mono text-muted-foreground">{f.variableName}</td>
                              <td className="p-2">
                                {f.value ? (
                                  <span className="font-semibold text-foreground">{f.value}</span>
                                ) : (
                                  <span className="text-muted-foreground italic">—</span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                {f.status === 'matched' && (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                    Matched
                                  </Badge>
                                )}
                                {f.status === 'empty regex' && (
                                  <Badge variant="outline" className="text-muted-foreground/60 text-[10px]">
                                    Empty Regex
                                  </Badge>
                                )}
                                {f.status === 'unmatched' && (
                                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px]">
                                    Unmatched
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Song Sets Results */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Hasil Ekstraksi Song Set Entries
                    </h4>
                    {testResults.songs.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Belum ada song set entries terdaftar.</p>
                    ) : (
                      <div className="rounded-md border border-border/50 overflow-hidden text-xs">
                        <table className="w-full divide-y divide-border/40">
                          <thead className="bg-muted/40 font-semibold">
                            <tr>
                              <th className="p-2 text-left">Slot Variable</th>
                              <th className="p-2 text-left">Slot Title</th>
                              <th className="p-2 text-left">Matched Song / Number</th>
                              <th className="p-2 text-center">Match Kind</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {testResults.songs.map((s) => (
                              <tr key={s.slotVariable} className="hover:bg-muted/20">
                                <td className="p-2 font-mono text-muted-foreground">{s.slotVariable}</td>
                                <td className="p-2 font-medium">{s.title}</td>
                                <td className="p-2">
                                  {s.status === 'matched' ? (
                                    <span className="font-semibold text-foreground">
                                      {s.songBookCode} #{s.songNumber}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic">Unfilled</span>
                                  )}
                                </td>
                                <td className="p-2 text-center font-mono text-[11px]">
                                  {s.matchKind || '—'}
                                </td>
                                <td className="p-2 text-center">
                                  {s.status === 'matched' ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                      Matched
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground/60 text-[10px]">
                                      Unfilled
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Unmapped Lines */}
                  {testResults.unmappedLines.length > 0 && (
                    <div className="p-3 bg-muted/40 border border-border/50 rounded-lg space-y-2 text-xs text-muted-foreground">
                      <div>
                        <p className="font-semibold flex items-center gap-1 text-foreground">
                          <HelpCircle className="w-3.5 h-3.5 text-primary" /> Baris Teks Tidak Terpetakan (Unmapped Lines):
                        </p>
                        <ul className="list-disc pl-5 mt-1 font-mono text-[11px] max-h-32 overflow-y-auto">
                          {testResults.unmappedLines.map((ul, idx) => (
                            <li key={idx} className="truncate">
                              {ul}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Single Regex Evaluator */}
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-primary" /> Interactive Regex Testing Sandbox
              </CardTitle>
              <CardDescription className="text-xs">
                Uji satu baris regex khusus terhadap teks buletin di atas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={singleRegexPattern}
                  onChange={(e) => setSingleRegexPattern(e.target.value)}
                  className="text-xs font-mono flex-1 h-8"
                  placeholder="(?i)^Pattern\s*[:\-]\s*(?<value>.*)$"
                />
                <Button type="button" size="sm" className="text-xs h-8 gap-1.5" onClick={runSingleRegexTest}>
                  <Play className="w-3.5 h-3.5" /> Test Single Regex
                </Button>
              </div>

              {singleRegexResult && (
                <div className="p-3 bg-muted/40 border border-border/50 rounded font-mono text-xs whitespace-pre-wrap">
                  {singleRegexResult}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default FormLayoutAdminPanel;
