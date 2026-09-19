import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Plus,
  Check,
  Award,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RosterPerson, SYNTHETIC_ROSTER_SEED } from './types';
import { toast } from 'sonner';

export type { RosterPerson };
export { SYNTHETIC_ROSTER_SEED };

interface MockupDutyRosterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSpeaker?: string;
  onSelectSpeaker: (speakerName: string) => void;
}

export default function MockupDutyRosterDrawer({
  open,
  onOpenChange,
  currentSpeaker,
  onSelectSpeaker,
}: MockupDutyRosterDrawerProps) {
  const [roster, setRoster] = useState<RosterPerson[]>(SYNTHETIC_ROSTER_SEED);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('Pelayan');

  const handleSelect = (person: RosterPerson) => {
    onSelectSpeaker(person.name);
    toast.success(`Pelayan dipilih: ${person.name}`);
    onOpenChange(false);
  };

  const handleAddNewPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPersonName.trim();
    if (!trimmed) {
      toast.error('Nama pelayan tidak boleh kosong');
      return;
    }

    const newPerson: RosterPerson = {
      id: `r-${Date.now()}`,
      name: `${trimmed} (Sintetis)`,
      role: newPersonRole.trim() || 'Pelayan',
      assigned: false,
    };

    setRoster((prev) => [...prev, newPerson]);
    setNewPersonName('');
    toast.success(`Pelayan baru ditambahkan ke roster: ${newPerson.name}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-6 gap-4"
        data-testid="duty-roster-drawer"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Roster Petugas Ibadah (Duty Roster Integration)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto py-1">
          <div className="p-3 bg-muted/40 rounded-xl border border-border/70 space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Daftar Pelayan Terdaftar (Data Sintetis Publik)</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Memilih pelayan akan langsung menghubungkan nama ke field khotbah dan token{' '}
              <code className="bg-muted px-1 rounded text-primary">{'{sermon_speaker}'}</code>.
            </p>
          </div>

          {/* Roster Cards List */}
          <div className="space-y-2" data-testid="duty-roster-list">
            {roster.map((person, idx) => {
              const isSelected = currentSpeaker === person.name;

              return (
                <div
                  key={person.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-xs'
                      : 'bg-card/70 border-border/70 hover:border-border'
                  }`}
                  data-testid={`duty-roster-card-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-primary font-bold text-xs">
                      {person.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>{person.name}</span>
                        {isSelected && (
                          <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                            Terpilih
                          </Badge>
                        )}
                      </p>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Award className="w-3 h-3 text-muted-foreground/70" />
                        <span>{person.role}</span>
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className="h-7 text-xs gap-1"
                    onClick={() => handleSelect(person)}
                    data-testid={`select-roster-person-${idx}`}
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>{isSelected ? 'Terpilih' : 'Pilih'}</span>
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Inline Add New Synthetic Person */}
          <form
            onSubmit={handleAddNewPerson}
            className="p-3.5 rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-2.5"
            data-testid="add-roster-person-form"
          >
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Tambah Pelayan Baru ke Roster</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Nama pelayan (mis: Sdr. Timotius Silas)"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="add-roster-person-input"
                />
              </div>
              <div>
                <Input
                  placeholder="Peran (mis: Pengkhotbah)"
                  value={newPersonRole}
                  onChange={(e) => setNewPersonRole(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="add-roster-role-input"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="h-7 text-xs gap-1"
                data-testid="add-roster-person-button"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah ke Roster</span>
              </Button>
            </div>
          </form>
        </div>

        <DialogFooter className="pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="duty-roster-close-button"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
