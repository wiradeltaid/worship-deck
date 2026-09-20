import React, { useState } from 'react';
import {
  X,
  Search,
  Copy,
  FolderOpen,
  Trash2,
  Calendar,
  Filter,
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
import {
  ScheduledServiceRecord,
  SYNTHETIC_SCHEDULED_SERVICES,
  PRESET_OPTIONS,
} from './types';
import { toast } from 'sonner';

interface MockupScheduleHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  services?: ScheduledServiceRecord[];
  onUpdateServices?: (services: ScheduledServiceRecord[]) => void;
  onOpenService: (service: ScheduledServiceRecord) => void;
}

export default function MockupScheduleHistoryDrawer({
  isOpen,
  onClose,
  services: externalServices,
  onUpdateServices,
  onOpenService,
}: MockupScheduleHistoryDrawerProps) {
  const [internalServices, setInternalServices] = useState<ScheduledServiceRecord[]>(
    SYNTHETIC_SCHEDULED_SERVICES
  );
  const services = externalServices || internalServices;
  const updateServices = onUpdateServices || setInternalServices;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPresetFilter, setSelectedPresetFilter] = useState<string>('all');
  const [serviceToDelete, setServiceToDelete] = useState<ScheduledServiceRecord | null>(
    null
  );

  if (!isOpen) return null;

  const filteredServices = services.filter((srv) => {
    const matchesQuery =
      srv.serviceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.serviceDate.includes(searchQuery) ||
      srv.presetLabel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPreset =
      selectedPresetFilter === 'all' || srv.presetId === selectedPresetFilter;

    return matchesQuery && matchesPreset;
  });

  const handleDuplicateService = (service: ScheduledServiceRecord) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    const dateStr = nextDate.toISOString().split('T')[0];

    const duplicated: ScheduledServiceRecord = {
      id: `srv-${Date.now()}`,
      presetId: service.presetId,
      presetLabel: service.presetLabel,
      serviceDate: dateStr,
      serviceTitle: `${service.serviceTitle} (Salinan Baru)`,
      status: 'draft',
      itemsCount: service.itemsCount,
      scheduleRevision: 1,
      updatedAt: `${dateStr} 09:00 WIB`,
      items: service.items ? JSON.parse(JSON.stringify(service.items)) : undefined,
    };

    updateServices([duplicated, ...services]);
    toast.success(
      `Jadwal berhasil digandakan untuk tanggal ${dateStr} dengan ID baru.`
    );
  };

  const handleDeleteService = (service: ScheduledServiceRecord) => {
    updateServices(services.filter((s) => s.id !== service.id));
    setServiceToDelete(null);
    toast.success(`Jadwal tanggal ${service.serviceDate} berhasil dihapus.`);
  };

  return (
    <div
      data-testid="schedule-history-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                📂 Riwayat & Daftar Jadwal Ibadah
              </h2>
              <p className="text-xs text-muted-foreground">
                Akses arsip jadwal kebaktian jemaat, buka kembali jadwal lampau, atau gandakan ke tanggal baru.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            data-testid="close-schedule-history-drawer-button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-background/50">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              type="text"
              placeholder="Cari tanggal, judul khotbah, atau preset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs"
              data-testid="history-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Select
              value={selectedPresetFilter}
              onValueChange={(val) => {
                if (val) setSelectedPresetFilter(val);
              }}
            >
              <SelectTrigger
                className="h-8 text-xs px-2"
                data-testid="history-preset-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Preset</SelectItem>
                {PRESET_OPTIONS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Confirmation Modal for Deletion */}
        {serviceToDelete && (
          <div className="m-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive flex flex-col gap-2.5 animate-in fade-in">
            <h4 className="text-xs font-bold flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              <span>Konfirmasi Hapus Jadwal Ibadah</span>
            </h4>
            <p className="text-xs text-foreground/90">
              Apakah Anda yakin ingin menghapus jadwal{' '}
              <strong className="font-bold">
                "{serviceToDelete.serviceTitle}" ({serviceToDelete.serviceDate})
              </strong>
              ? Data timeline dan slide akan dihapus secara soft-delete.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setServiceToDelete(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs font-semibold"
                onClick={() => handleDeleteService(serviceToDelete)}
              >
                Ya, Hapus Jadwal
              </Button>
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Tidak ada jadwal kebaktian yang cocok dengan pencarian.
            </div>
          ) : (
            filteredServices.map((srv) => (
              <div
                key={srv.id}
                className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs space-y-2.5"
                data-testid={`service-history-item-${srv.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-foreground">
                        {srv.serviceDate}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-muted border border-border">
                        {srv.presetLabel}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/60">
                        rev.{srv.scheduleRevision}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                          srv.status === 'ready'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {srv.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-xs text-foreground">
                      {srv.serviceTitle}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>{srv.itemsCount} item timeline</span>
                      <span>•</span>
                      <span>Diperbarui: {srv.updatedAt}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs font-semibold gap-1"
                      onClick={() => {
                        onOpenService(srv);
                        onClose();
                      }}
                      data-testid="history-open-service-button"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Buka Jadwal</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-semibold gap-1"
                      onClick={() => handleDuplicateService(srv)}
                      data-testid="history-duplicate-service-button"
                      title="Gandakan Jadwal"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Gandakan</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setServiceToDelete(srv)}
                      data-testid="history-delete-service-button"
                      title="Hapus Jadwal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total: <strong className="text-foreground">{services.length}</strong> jadwal tersimpan
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
