import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Download, Plus, Trash2, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/operator';
import { parseRundownWithProfile, type ParserProfileRules } from '@/lib/parser-rules';
import { matchSongSets, type SongSetEntrySlot } from '@/lib/song-set-matching';

export interface ParserProfile {
  id: string;
  slug: string;
  title: string;
  description: string;
  rulesJson: string;
  isBuiltin: boolean;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_SANDBOX_SAMPLE = `September 20, 2026
BIBLE TALK (9.00 - 10.00 / 60 min)
Opening song: SDAH 159 (5m)
Leader: Bro. Alpha
Opening prayer: Sis. Beta
DIVINE SERVICE (10.00 - 12.00 / 120 min)
Theme Verse: John 3:16 For God so loved the world
Verse Reading: Psalm 23:1-3 The Lord is my shepherd
Special Song: Youth Choir
Sermon: Pastor Jonathan "Walking with God"
Family & Youth: Bro. Delta
Closing Prayer: The Speaker
Closing song: Hymn 1
[Organist] Sis. Epsilon
Unmapped bulletin note for congregation`;

type EditorTab = 'preprocess' | 'hymns' | 'fields' | 'advanced';

export function ParserProfilesPanel() {
  const { t } = useT();

  const [profiles, setProfiles] = useState<ParserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EditorTab>('preprocess');

  // Active profile edit state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [rulesObj, setRulesObj] = useState<ParserProfileRules>({
    schema_version: 1,
    default_book: 'SDAH',
  });
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New profile modal/form state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Live Sandbox state
  const [sandboxText, setSandboxText] = useState(DEFAULT_SANDBOX_SAMPLE);
  const [configuredSlots, setConfiguredSlots] = useState<SongSetEntrySlot[]>([
    { variableName: 'ds_opening_song', title: 'Opening Song', position: 1 },
    { variableName: 'praise_song_1', title: 'Praise 1', position: 2 },
    { variableName: 'praise_song_2', title: 'Praise 2', position: 3 },
    { variableName: 'praise_song_3', title: 'Praise 3', position: 4 },
    { variableName: 'ds_closing_song', title: 'Closing Song', position: 5 },
  ]);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0] || null;
  }, [profiles, selectedProfileId]);

  const fetchProfiles = async (selectId?: string) => {
    try {
      const res = await fetch('/api/admin/parser-profiles', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load');
      const data = (await res.json()) as { profiles: ParserProfile[] };
      const list = data.profiles ?? [];
      setProfiles(list);

      const target = selectId
        ? list.find((p) => p.id === selectId)
        : list.find((p) => p.isDefault) || list[0];

      if (target) {
        setSelectedProfileId(target.id);
        loadProfileIntoEditor(target);
      }
    } catch {
      toast.error('Failed to load parser profiles');
    } finally {
      setLoading(false);
    }
  };

  const loadProfileIntoEditor = (profile: ParserProfile) => {
    setTitle(profile.title);
    setSlug(profile.slug);
    setDescription(profile.description);
    setRawJson(profile.rulesJson);
    try {
      const parsed = JSON.parse(profile.rulesJson) as ParserProfileRules;
      setRulesObj(parsed);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON');
    }
  };

  useEffect(() => {
    void fetchProfiles();
  }, []);

  const handleSelectProfile = (id: string) => {
    const target = profiles.find((p) => p.id === id);
    if (target) {
      setSelectedProfileId(target.id);
      loadProfileIntoEditor(target);
      setIsCreatingNew(false);
    }
  };

  const handleSetDefault = async () => {
    if (!activeProfile) return;
    try {
      const res = await fetch(`/api/admin/parser-profiles/${activeProfile.id}/set-default`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Failed to set default');
      toast.success(t('admin.parsing.defaultSuccess'));
      await fetchProfiles(activeProfile.id);
    } catch {
      toast.error(t('admin.parsing.defaultFailed'));
    }
  };

  const handleClone = () => {
    if (!activeProfile) return;
    const clonedSlug = `${activeProfile.slug}-clone-${Date.now().toString().slice(-4)}`;
    const clonedTitle = `${activeProfile.title} (Clone)`;
    setNewSlug(clonedSlug);
    setNewTitle(clonedTitle);
    setNewDescription(`Cloned from ${activeProfile.title}`);
    setIsCreatingNew(true);
  };

  const handleDelete = async () => {
    if (!activeProfile || activeProfile.isBuiltin || activeProfile.isDefault) return;
    if (!confirm(`Delete profile "${activeProfile.title}" permanently?`)) return;
    try {
      const res = await fetch(`/api/admin/parser-profiles/${activeProfile.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete');
      }
      toast.success(t('admin.parsing.deleted'));
      await fetchProfiles();
    } catch (e: any) {
      toast.error(e.message || t('admin.parsing.deleteFailed'));
    }
  };

  const handleExport = () => {
    if (!activeProfile) return;
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parser-profile-${activeProfile.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = JSON.parse(text) as ParserProfileRules;
        if (parsed.schema_version !== 1) {
          throw new Error('schema_version must be 1');
        }
        setRawJson(text);
        setRulesObj(parsed);
        setJsonError(null);
        toast.success('Rules JSON imported into editor');
      } catch (err: any) {
        toast.error(`Invalid profile JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonError) {
      toast.error('Cannot save: JSON syntax error in rules');
      return;
    }
    setSaving(true);
    try {
      if (isCreatingNew) {
        const res = await fetch('/api/admin/parser-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            slug: newSlug,
            title: newTitle,
            description: newDescription,
            rulesJson: rawJson,
            isDefault: false,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create');
        }
        const created = (await res.json()) as ParserProfile;
        toast.success(t('admin.parsing.saveSuccess'));
        setIsCreatingNew(false);
        await fetchProfiles(created.id);
      } else {
        if (!activeProfile || activeProfile.isBuiltin) {
          toast.error(t('admin.parsing.builtinNotice'));
          return;
        }
        const res = await fetch(`/api/admin/parser-profiles/${activeProfile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            title,
            description,
            rulesJson: rawJson,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save');
        }
        const updated = (await res.json()) as ParserProfile;
        toast.success(t('admin.parsing.saveSuccess'));
        await fetchProfiles(updated.id);
      }
    } catch (err: any) {
      toast.error(err.message || t('admin.parsing.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const updateStructuredField = (updater: (prev: ParserProfileRules) => ParserProfileRules) => {
    const next = updater(rulesObj);
    setRulesObj(next);
    const str = JSON.stringify(next, null, 2);
    setRawJson(str);
    setJsonError(null);
  };

  // Live Sandbox Evaluation
  const sandboxParsed = useMemo(() => {
    try {
      return parseRundownWithProfile(sandboxText, rulesObj);
    } catch (e) {
      return null;
    }
  }, [sandboxText, rulesObj]);

  const songSetResult = useMemo(() => {
    if (!sandboxParsed?.songCandidates) {
      return { suggestions: {}, songOverflow: [], songSlotsUnfilled: [] };
    }
    return matchSongSets(sandboxParsed.songCandidates, configuredSlots, rulesObj.song_set_matching);
  }, [sandboxParsed, configuredSlots, rulesObj]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading parser profiles…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Profile Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold">{t('admin.parsing.title')}</CardTitle>
              <CardDescription>{t('admin.parsing.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <input id="parser-profile-import-file" type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('parser-profile-import-file')?.click()}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {t('admin.parsing.import')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1.5" />
                {t('admin.parsing.export')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewSlug(`custom-${Date.now().toString().slice(-4)}`);
                  setNewTitle('Custom Parser Profile');
                  setNewDescription('Custom liturgical parser profile');
                  setIsCreatingNew(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {t('admin.parsing.newProfile')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm font-semibold">{t('admin.parsing.profileSelect')}:</Label>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => {
                const isSelected = p.id === selectedProfileId && !isCreatingNew;
                return (
                  <Button
                    key={p.id}
                    type="button"
                    variant={isSelected ? 'secondary' : 'ghost'}
                    size="sm"
                    className="text-xs font-semibold h-8"
                    onClick={() => handleSelectProfile(p.id)}
                  >
                    {p.title}
                    {p.isDefault ? (
                      <Badge variant="default" className="ml-1.5 text-[10px] px-1 py-0 h-4 bg-emerald-600">
                        {t('admin.parsing.defaultBadge')}
                      </Badge>
                    ) : null}
                    {p.isBuiltin ? (
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                        {t('admin.parsing.builtinBadge')}
                      </Badge>
                    ) : null}
                  </Button>
                );
              })}
            </div>

            {activeProfile && !isCreatingNew ? (
              <div className="ml-auto flex items-center gap-2">
                {!activeProfile.isDefault ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleSetDefault}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t('admin.parsing.setDefault')}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={handleClone}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {t('admin.parsing.clone')}
                </Button>
                {!activeProfile.isBuiltin && !activeProfile.isDefault ? (
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {t('admin.parsing.delete')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {activeProfile?.isBuiltin && !isCreatingNew ? (
            <div className="mt-3 p-2.5 bg-muted/60 border rounded text-xs flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{t('admin.parsing.builtinNotice')}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Split-Pane: Rule Builder (Left) & Live Testing Sandbox (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Pane: Rule Editor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t('admin.parsing.ruleEditor')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSave} className="space-y-4">
              {isCreatingNew ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 border rounded">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{t('admin.parsing.profileName')}</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{t('admin.parsing.profileSlug')}</Label>
                    <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} required />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold">{t('admin.parsing.profileDesc')}</Label>
                    <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{t('admin.parsing.profileName')}</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={activeProfile?.isBuiltin}
                    required
                  />
                </div>
              )}

              {/* Sub-tabs for Structured vs Advanced Editor */}
              <div className="flex gap-1 border-b pb-2">
                {(['preprocess', 'hymns', 'fields', 'advanced'] as EditorTab[]).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    variant={activeTab === tab ? 'secondary' : 'ghost'}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'preprocess' && t('admin.parsing.tabPreprocess')}
                    {tab === 'hymns' && t('admin.parsing.tabHymns')}
                    {tab === 'fields' && t('admin.parsing.tabFields')}
                    {tab === 'advanced' && t('admin.parsing.tabAdvanced')}
                  </Button>
                ))}
              </div>

              {/* Tab 1: Preprocess & Sections */}
              {activeTab === 'preprocess' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Section Delimiter Pattern</Label>
                    <Input
                      value={rulesObj.section_delimiter_pattern || ''}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          section_delimiter_pattern: e.target.value,
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Matches section boundaries such as Divine Service, Bible Talk, or Break.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date Recognition Pattern</Label>
                    <Input
                      value={rulesObj.date_pattern || ''}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          date_pattern: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              {/* Tab 2: Hymns & Books */}
              {activeTab === 'hymns' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Default Song Book Code</Label>
                    <Input
                      value={rulesObj.default_book || 'SDAH'}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          default_book: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hymn Numbering Pattern</Label>
                    <Input
                      value={rulesObj.hymn_patterns?.[0]?.pattern || ''}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          hymn_patterns: [{ pattern: e.target.value, flags: ['i'] }],
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Use named capture groups <code>(?&lt;book&gt;...)</code> and <code>(?&lt;number&gt;\d+)</code>.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Tab 3: Liturgical Fields */}
              {activeTab === 'fields' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sermon Pattern</Label>
                    <Input
                      value={rulesObj.field_rules?.sermon?.pattern || ''}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          field_rules: {
                            ...prev.field_rules,
                            sermon: { pattern: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Special Song Pattern</Label>
                    <Input
                      value={rulesObj.field_rules?.special_song?.pattern || ''}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          field_rules: {
                            ...prev.field_rules,
                            special_song: { pattern: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Verse Reading Pattern</Label>
                    <Input
                      value={rulesObj.field_rules?.verse_reading?.pattern || ''}
                      disabled={activeProfile?.isBuiltin && !isCreatingNew}
                      onChange={(e) =>
                        updateStructuredField((prev) => ({
                          ...prev,
                          field_rules: {
                            ...prev.field_rules,
                            verse_reading: { pattern: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              {/* Tab 4: Advanced Raw JSON */}
              {activeTab === 'advanced' ? (
                <div className="space-y-2">
                  <Textarea
                    rows={12}
                    className="font-mono text-xs"
                    value={rawJson}
                    disabled={activeProfile?.isBuiltin && !isCreatingNew}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRawJson(val);
                      try {
                        const parsed = JSON.parse(val) as ParserProfileRules;
                        setRulesObj(parsed);
                        setJsonError(null);
                      } catch (err: any) {
                        setJsonError(err.message || 'JSON parse error');
                      }
                    }}
                  />
                  {jsonError ? (
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {jsonError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                {isCreatingNew ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreatingNew(false)}>
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || (activeProfile?.isBuiltin && !isCreatingNew) || !!jsonError}
                >
                  {saving ? t('admin.parsing.saving') : t('admin.parsing.save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Pane: Sticky Live Testing Sandbox */}
        <div className="sticky top-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{t('admin.parsing.liveSandbox')}</CardTitle>
                {sandboxParsed?.date ? (
                  <Badge variant="outline" className="text-xs">
                    Date: {sandboxParsed.date}
                  </Badge>
                ) : null}
              </div>
              <CardDescription>
                Paste or edit bulletin text below to preview token and song matching live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                className="font-mono text-xs"
                placeholder={t('admin.parsing.sandboxPlaceholder')}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
              />

              {/* Extracted Tokens Summary */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('admin.parsing.extractedTokens')}
                </Label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted/40 rounded border min-h-[50px] items-center">
                  {sandboxParsed?.items && sandboxParsed.items.length > 0 ? (
                    sandboxParsed.items.map((it, idx) => {
                      if (it.type === 'section') {
                        return (
                          <Badge key={idx} variant="default" className="text-xs bg-blue-600">
                            § {it.title}
                          </Badge>
                        );
                      }
                      if (it.type === 'role') {
                        const isSermon = it.role.toLowerCase() === 'sermon';
                        return (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className={`text-xs ${isSermon ? 'border-amber-500 bg-amber-500/10' : ''}`}
                          >
                            {it.role}: {it.name}
                          </Badge>
                        );
                      }
                      if (it.type === 'hymn') {
                        return (
                          <Badge key={idx} variant="outline" className="text-xs font-mono">
                            🎵 {it.bookCode || 'SDAH'} #{it.number}
                          </Badge>
                        );
                      }
                      return null;
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('admin.parsing.noTokens')}</span>
                  )}
                </div>
              </div>

              {/* Dynamic Song Set Suggestions */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('admin.parsing.songSuggestions')}
                </Label>
                <div className="space-y-1.5 p-2.5 bg-muted/40 rounded border min-h-[50px]">
                  {Object.keys(songSetResult.suggestions).length > 0 ? (
                    <div className="space-y-1">
                      {Object.entries(songSetResult.suggestions).map(([vn, sug]) => (
                        <div key={vn} className="text-xs flex items-center justify-between py-1 border-b last:border-0">
                          <span className="font-mono font-semibold">{vn}</span>
                          <div className="flex items-center gap-2">
                            <span>
                              {sug.songBookCode} #{sug.songNumber} {sug.title ? `(${sug.title})` : ''}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {sug.matchKind}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('admin.parsing.noSuggestions')}</span>
                  )}

                  {songSetResult.songOverflow.length > 0 ? (
                    <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-300">
                      <strong>Warning:</strong> {t('admin.parsing.overflowWarning')} (
                      {songSetResult.songOverflow.map((s) => `#${s.number}`).join(', ')})
                    </div>
                  ) : null}

                  {songSetResult.songSlotsUnfilled.length > 0 ? (
                    <div className="text-[11px] text-muted-foreground pt-1">
                      Unfilled slots: {songSetResult.songSlotsUnfilled.join(', ')} ({t('admin.parsing.unfilledWarning')})
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Unmapped Lines */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('admin.parsing.unmappedLines')} ({sandboxParsed?.unmappedLines?.length || 0})
                </Label>
                <div className="p-2 bg-muted/40 rounded border max-h-[120px] overflow-y-auto font-mono text-xs">
                  {sandboxParsed?.unmappedLines && sandboxParsed.unmappedLines.length > 0 ? (
                    <div className="space-y-1 text-amber-600 dark:text-amber-400">
                      {sandboxParsed.unmappedLines.map((line, i) => (
                        <div key={i} className="truncate">
                          ⚠️ {line}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">{t('admin.parsing.noUnmapped')}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default ParserProfilesPanel;
