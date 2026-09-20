import React, { useState } from 'react';
import {
  X,
  Settings,
  Users,
  BookOpen,
  Sliders,
  Wrench,
  Shield,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Globe,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface OperatorAccount {
  id: string;
  username: string;
  role: 'admin' | 'operator';
  createdAt: string;
}

const SYNTHETIC_ACCOUNTS: OperatorAccount[] = [
  { id: 'u1', username: 'admin_gereja', role: 'admin', createdAt: '2026-01-01' },
  { id: 'u2', username: 'operator_multimedia', role: 'operator', createdAt: '2026-02-15' },
  { id: 'u3', username: 'liturgis_sabat', role: 'operator', createdAt: '2026-05-10' },
];

interface MockupSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MockupSettingsDrawer({
  isOpen,
  onClose,
}: MockupSettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'accounts' | 'worship' | 'system' | 'tools'>(
    'accounts'
  );

  // Accounts State
  const [accounts, setAccounts] = useState<OperatorAccount[]>(SYNTHETIC_ACCOUNTS);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operator'>('operator');

  // Worship & Bible Settings
  const [defaultTransition, setDefaultTransition] = useState<'fade' | 'push' | 'none'>('fade');
  const [installedTranslations, setInstalledTranslations] = useState([
    { code: 'TB2', name: 'Terjemahan Baru Edisi 2 (Indonesia)', active: true },
    { code: 'KJV', name: 'King James Version (English)', active: true },
    { code: 'BIS', name: 'Bahasa Indonesia Sehari-hari', active: false },
  ]);

  // System Settings
  const [retentionDays, setRetentionDays] = useState(30);
  const [uiLocale, setUiLocale] = useState<'id' | 'en'>('id');

  if (!isOpen) return null;

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      toast.error('Nama pengguna akun wajib diisi');
      return;
    }
    const created: OperatorAccount = {
      id: `u-${Date.now()}`,
      username: newUsername.trim(),
      role: newRole,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAccounts((prev) => [...prev, created]);
    setNewUsername('');
    toast.success(`Akun "${created.username}" (${created.role}) berhasil ditambahkan.`);
  };

  const handleDeleteAccount = (id: string) => {
    const target = accounts.find((a) => a.id === id);
    if (!target) return;

    if (target.role === 'admin') {
      const adminCount = accounts.filter((a) => a.role === 'admin').length;
      if (adminCount <= 1) {
        toast.error(
          'Tidak dapat menghapus akun admin terakhir. Setidaknya satu akun administrator harus dipertahankan.'
        );
        return;
      }
    }

    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success(`Akun "${target.username}" berhasil dihapus.`);
  };

  const handleSaveWorshipSettings = () => {
    toast.success('Pengaturan ibadah & transisi slide berhasil disimpan.');
  };

  const handleSaveSystemSettings = () => {
    toast.success('Pengaturan retensi PPTX & bahasa UI berhasil disimpan.');
  };

  return (
    <div
      data-testid="workspace-settings-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Pengaturan Sistem & Konfigurasi Gereja
              </h2>
              <p className="text-xs text-muted-foreground">
                Pengganti terpadu layar Admin legacy (/admin, /admin/sync) langsung dari dalam workspace.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="p-3 border-b border-border bg-background/50 flex items-center gap-1.5 flex-wrap">
          <Button
            type="button"
            variant={activeTab === 'accounts' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('accounts')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="settings-tab-accounts"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Akun & Akses</span>
          </Button>

          <Button
            type="button"
            variant={activeTab === 'worship' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('worship')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="settings-tab-worship"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Ibadah & Alkitab</span>
          </Button>

          <Button
            type="button"
            variant={activeTab === 'system' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('system')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="settings-tab-system"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Sistem & Retensi</span>
          </Button>

          <Button
            type="button"
            variant={activeTab === 'tools' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('tools')}
            className="h-8 text-xs font-semibold gap-1.5"
            data-testid="settings-tab-tools"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Alat & Paritas</span>
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: ACCOUNTS & ACCESS */}
          {activeTab === 'accounts' && (
            <div className="space-y-4" data-testid="settings-accounts-panel">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Manajemen Akun Operator & Admin
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Atur izin akses petugas multimedia dan administrator kebaktian jemaat.
                  </p>
                </div>
              </div>

              {/* Add Account Inline Form */}
              <form
                onSubmit={handleAddAccount}
                className="p-3 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <Input
                  type="text"
                  placeholder="Nama pengguna akun..."
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="h-8 text-xs px-2.5 flex-1"
                  required
                />
                <Select
                  value={newRole}
                  onValueChange={(val) => {
                    if (val) setNewRole(val as 'admin' | 'operator');
                  }}
                >
                  <SelectTrigger className="h-8 text-xs px-2.5 font-medium w-full sm:w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" className="h-8 text-xs font-semibold gap-1 shrink-0">
                  <Plus className="w-3 h-3" />
                  <span>Tambah Akun</span>
                </Button>
              </form>

              {/* Accounts Table */}
              <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground">
                      <th className="p-2.5">Nama Pengguna</th>
                      <th className="p-2.5">Peran</th>
                      <th className="p-2.5">Dibuat</th>
                      <th className="p-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-muted/20">
                        <td className="p-2.5 font-semibold text-foreground">
                          {acc.username}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              acc.role === 'admin'
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            {acc.role}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground font-mono text-[11px]">
                          {acc.createdAt}
                        </td>
                        <td className="p-2.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: WORSHIP & BIBLE */}
          {activeTab === 'worship' && (
            <div className="space-y-4" data-testid="settings-worship-panel">
              <div className="space-y-1.5 p-3.5 rounded-xl border border-border/80 bg-card">
                <h4 className="text-xs font-bold text-foreground">
                  Transisi Slide Default
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Gaya transisi antar slide pada tayangan projector dan presentasi PPTX.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  {(['fade', 'push', 'none'] as const).map((tr) => (
                    <Button
                      key={tr}
                      type="button"
                      variant={defaultTransition === tr ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDefaultTransition(tr)}
                      className="h-8 text-xs font-semibold capitalize"
                    >
                      {tr}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-card">
                <h4 className="text-xs font-bold text-foreground">
                  Versi Terjemahan Alkitab Terpasang
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Corpus Alkitab lokal yang tersedia untuk pencarian instan dan Ayat Cepat (⚡).
                </p>
                <div className="space-y-2 pt-1">
                  {installedTranslations.map((tr) => (
                    <div
                      key={tr.code}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-muted/20"
                    >
                      <div>
                        <span className="font-bold text-xs text-foreground font-mono mr-2">
                          [{tr.code}]
                        </span>
                        <span className="text-xs text-muted-foreground">{tr.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          tr.active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {tr.active ? 'Aktif' : 'Tersedia'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveWorshipSettings}
                  className="h-8 text-xs font-semibold"
                >
                  Simpan Pengaturan Ibadah
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM & RETENTION */}
          {activeTab === 'system' && (
            <div className="space-y-4" data-testid="settings-system-panel">
              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2">
                <h4 className="text-xs font-bold text-foreground">
                  Masa Retensi Cache Presentasi PPTX
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Lama hari file arsip PowerPoint tersimpan di disk lokal sebelum dibersihkan otomatis.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(parseInt(e.target.value, 10) || 30)}
                    className="h-8 w-24 text-xs px-2.5 font-mono"
                  />
                  <span className="text-xs text-muted-foreground">Hari</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2">
                <h4 className="text-xs font-bold text-foreground">
                  Bahasa Tampilan Antarmuka (UI Locale)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Pilih bahasa pengoperasian workspace dan katalog aplikasi.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant={uiLocale === 'id' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUiLocale('id')}
                    className="h-8 text-xs font-semibold"
                  >
                    Bahasa Indonesia (id)
                  </Button>
                  <Button
                    type="button"
                    variant={uiLocale === 'en' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUiLocale('en')}
                    className="h-8 text-xs font-semibold"
                  >
                    English (en)
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveSystemSettings}
                  className="h-8 text-xs font-semibold"
                >
                  Simpan Pengaturan Sistem
                </Button>
              </div>
            </div>
          )}

          {/* TAB 4: TOOLS & PARITY */}
          {activeTab === 'tools' && (
            <div className="space-y-4" data-testid="settings-tools-panel">
              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2.5">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-primary" />
                  <span>Alat Diagnostik Paritas Visual</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Periksa keselarasan geometri antara rendering Chromium HTML/CSS Canvas dengan Microsoft PowerPoint Desktop COM.
                </p>
                <div className="pt-1">
                  <a
                    href="/services/diagnostic-parity"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors"
                  >
                    <span>Buka Halaman Diagnostik Paritas Visual</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2">
                <h4 className="text-xs font-bold text-foreground">
                  Registry Doctor & Template Healer
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Validasi ulang integritas template artefak slide dan perbaiki referensi placeholder yang usang.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success('Registry Doctor: Seluruh template terverifikasi valid.')}
                  className="h-8 text-xs font-semibold"
                >
                  Jalankan Pemeriksaan Registry Doctor
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-muted/10 flex justify-end">
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
