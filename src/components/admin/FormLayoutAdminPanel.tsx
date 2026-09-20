import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowUp, ArrowDown, Play, Sparkles, RefreshCw } from 'lucide-react';
import { compileProfileRegex } from '@/lib/parser-rules';
import type { FormLayoutData, FormGroupingDef, PredefinedFieldDef } from '@/operator/DynamicFormBody';

type AdminTab = 'layout' | 'fields' | 'sandbox';

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

  // Seeder state
  const [seeding, setSeeding] = useState(false);
  const [seedReport, setSeedReport] = useState<string | null>(null);

  // Sandbox state
  const [sandboxText, setSandboxText] = useState(
`SABBATH, OCTOBER 24, 2026
DIVINE SERVICE
Introit: #100
Guest Speaker: Pastor Alexander
Opening Song: SDAH #159
Sermon: Pastor Alexander "The Blessed Hope"
Closing Prayer: Deacon Michael`
  );
  const [sandboxRegex, setSandboxRegex] = useState('(?i)^Guest\\s+Speaker\\s*[:\\-]\\s*(?<value>.*)$');
  const [sandboxResult, setSandboxResult] = useState<string | null>(null);

  const fetchLayout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/worship-form-layout');
      if (res.ok) {
        const data = (await res.json()) as FormLayoutData;
        setLayoutData(data);
        if (data.groupings.length > 0 && !targetGroupingId) {
          setTargetGroupingId(data.groupings[0].id);
        }
      } else {
        setError('Failed to load form layout');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading form layout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLayout();
  }, []);

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
        await fetchLayout();
      }
    } catch {
      // ignore
    }
  };

  const handleMoveGrouping = async (index: number, direction: 'up' | 'down') => {
    if (!layoutData) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= layoutData.groupings.length) return;

    const reordered = [...layoutData.groupings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const payload = reordered.map((g, i) => ({ id: g.id, sort_order: i + 1 }));

    try {
      const res = await fetch('/api/admin/form-groupings/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) await fetchLayout();
    } catch {
      // ignore
    }
  };

  const handleMoveSlot = async (groupingId: string, slotIndex: number, direction: 'up' | 'down') => {
    if (!layoutData) return;
    const grouping = layoutData.groupings.find(g => g.id === groupingId);
    if (!grouping) return;
    const targetIdx = direction === 'up' ? slotIndex - 1 : slotIndex + 1;
    if (targetIdx < 0 || targetIdx >= grouping.slots.length) return;

    const reordered = [...grouping.slots];
    const [moved] = reordered.splice(slotIndex, 1);
    reordered.splice(targetIdx, 0, moved);

    const payload = {
      grouping_id: groupingId,
      slots: reordered.map((s, i) => ({ id: s.id, sort_order: i + 1 })),
    };

    try {
      const res = await fetch('/api/admin/form-grouping-slots/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) await fetchLayout();
    } catch {
      // ignore
    }
  };

  const handleTransferSlot = async (slotId: string, targetGroupingId: string) => {
    if (!targetGroupingId) return;
    try {
      const res = await fetch(`/api/admin/form-grouping-slots/${slotId}/move-grouping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_grouping_id: targetGroupingId }),
      });
      if (res.ok) await fetchLayout();
    } catch {
      // ignore
    }
  };

  const handleDeleteGrouping = async (id: string) => {
    if (!window.confirm('Delete this grouping card and its slots?')) return;
    try {
      const res = await fetch(`/api/admin/form-groupings/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchLayout();
    } catch {
      // ignore
    }
  };

  const handleAddSlot = async () => {
    if (!targetGroupingId || !newSlotRefKey.trim()) return;
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
        await fetchLayout();
      } else if (res.status === 409) {
        alert('This slot already exists in this layout (cardinality limit).');
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const res = await fetch(`/api/admin/form-grouping-slots/${slotId}`, { method: 'DELETE' });
      if (res.ok) await fetchLayout();
    } catch {
      // ignore
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
        await fetchLayout();
      } else {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setFieldFormError(errData.error || 'Failed to save field');
      }
    } catch (err: unknown) {
      setFieldFormError(err instanceof Error ? err.message : 'Error saving field');
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
        await fetchLayout();
      }
    } catch {
      setSeedReport('Failed to run default seeder');
    } finally {
      setSeeding(false);
    }
  };

  const runSandboxTest = () => {
    if (!sandboxRegex.trim()) {
      setSandboxResult('Please enter a valid regex pattern.');
      return;
    }
    try {
      const re = compileProfileRegex(sandboxRegex.trim());
      const lines = sandboxText.split('\n');
      for (const line of lines) {
        const m = line.match(re);
        if (m) {
          const val = m.groups?.value || (m[1] !== undefined ? m[1] : m[0]);
          setSandboxResult(`Match on line: "${line}"\nExtracted value: "${val}"\nGroups: ${JSON.stringify(m.groups || {})}`);
          return;
        }
      }
      setSandboxResult('No match found across any line in sample text.');
    } catch (err: unknown) {
      setSandboxResult(`Regex Compilation Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading Form Layout Settings...</div>;
  }

  return (
    <div className="space-y-6" data-slot="admin-form-layout-panel">
      {/* Sub-tabs header */}
      <Card className="p-1.5 bg-muted/40">
        <div className="flex flex-wrap gap-1.5 items-center justify-between">
          <div className="flex gap-1">
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
              Predefined Fields
            </Button>
            <Button
              type="button"
              variant={activeTab === 'sandbox' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setActiveTab('sandbox')}
            >
              Regex Testing Sandbox
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

          {/* Existing Groupings & Slots List */}
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
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteGrouping(grouping.id)}
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
                      {grouping.slots.map((s, sIdx) => (
                        <div key={s.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-muted-foreground">#{s.sort_order}</span>
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {s.widget_kind}
                            </Badge>
                            <span className="font-semibold">{s.ref_key}</span>
                          </div>
                          <div className="flex items-center gap-1">
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
                              <select
                                className="h-6 text-[11px] px-1.5 rounded border border-border bg-background text-foreground cursor-pointer"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleTransferSlot(s.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                title="Pindah Kartu..."
                              >
                                <option value="" disabled>Pindah Kartu...</option>
                                {layoutData.groupings
                                  .filter((g) => g.id !== grouping.id)
                                  .map((g) => (
                                    <option key={g.id} value={g.id}>
                                      → {g.label}
                                    </option>
                                  ))}
                              </select>
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
                      ))}
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
                  </div>
                  {f.extraction_regex && (
                    <p className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-1 rounded">
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
                      await fetchLayout();
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

      {/* TAB 3: Regex Testing Sandbox */}
      {activeTab === 'sandbox' && (
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Play className="w-4 h-4 text-primary" /> Interactive Regex Testing Sandbox
            </CardTitle>
            <CardDescription className="text-xs">
              Uji regex ekstraksi terhadap contoh buletin warta secara real time menggunakan dialek regex aman.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Sample Bulletin Text
              </label>
              <Textarea
                rows={7}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                className="text-xs font-mono w-full"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Test Extraction Regex (with (?&lt;value&gt;...) group)
              </label>
              <div className="flex gap-2">
                <Input
                  value={sandboxRegex}
                  onChange={(e) => setSandboxRegex(e.target.value)}
                  className="text-xs font-mono flex-1 h-8"
                />
                <Button type="button" size="sm" className="text-xs h-8 gap-1.5" onClick={runSandboxTest}>
                  <Play className="w-3.5 h-3.5" /> Test Pattern
                </Button>
              </div>
            </div>

            {sandboxResult && (
              <div className="p-3 bg-muted/40 border border-border/50 rounded font-mono text-xs whitespace-pre-wrap">
                {sandboxResult}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FormLayoutAdminPanel;
