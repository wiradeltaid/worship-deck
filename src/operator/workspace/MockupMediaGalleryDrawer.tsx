import React, { useState, useEffect } from 'react';
import {
  ImageIcon,
  Search,
  Upload,
  Check,
  Filter,
  Layers,
  Sparkles,
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
import { MediaAsset, SYNTHETIC_MEDIA_CATALOG } from './types';
import { toast } from 'sonner';

export type { MediaAsset };
export { SYNTHETIC_MEDIA_CATALOG };

interface MockupMediaGalleryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAsset: (assetUrl: string) => void;
  activeUrl?: string;
}

export default function MockupMediaGalleryDrawer({
  open,
  onOpenChange,
  onSelectAsset,
  activeUrl,
}: MockupMediaGalleryDrawerProps) {
  const [catalog, setCatalog] = useState<MediaAsset[]>(SYNTHETIC_MEDIA_CATALOG);
  const [category, setCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUrl, setSelectedUrl] = useState<string>(
    activeUrl || '/assets/background-navy.jpg'
  );

  // Synchronize selection with activeUrl whenever drawer opens or active item changes
  useEffect(() => {
    if (open && activeUrl) {
      setSelectedUrl(activeUrl);
    }
  }, [open, activeUrl]);

  const filteredAssets = catalog.filter((asset) => {
    const matchesCategory =
      category === 'all' || asset.category === category;
    const matchesSearch =
      asset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAssign = () => {
    onSelectAsset(selectedUrl);
    toast.success('Latar belakang berhasil diterapkan dari Galeri Media');
    onOpenChange(false);
  };

  const handleSimulateUpload = () => {
    const newId = `m-${Date.now()}`;
    const newAsset: MediaAsset = {
      id: newId,
      title: `Gambar Unggahan Baru ${catalog.length + 1}`,
      url: `/assets/custom-upload-${newId}.jpg`,
      category: 'background',
      dimensions: '1920x1080 (16:9)',
    };

    setCatalog((prev) => [newAsset, ...prev]);
    setSelectedUrl(newAsset.url);
    toast.success('Gambar baru berhasil diunggah ke Galeri Media');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-6 gap-4"
        data-testid="media-gallery-drawer"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <span>Galeri Media & Aset Visual (In-Place Asset Manager)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto py-1">
          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Cari aset media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8"
                data-testid="media-search-input"
              />
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
              {[
                { id: 'all', label: 'Semua', testId: 'media-category-all' },
                { id: 'background', label: 'Latar Ibadah', testId: 'media-category-background' },
                { id: 'cross', label: 'Salib', testId: 'media-category-cross' },
                { id: 'nature', label: 'Alam', testId: 'media-category-nature' },
                { id: 'texture', label: 'Tekstur', testId: 'media-category-texture' },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant={category === tab.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setCategory(tab.id)}
                  data-testid={tab.testId}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Asset Grid */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            data-testid="media-gallery-grid"
          >
            {filteredAssets.length === 0 ? (
              <div
                className="col-span-full py-12 text-center space-y-2 border border-dashed border-border/80 rounded-xl bg-muted/20"
                data-testid="media-empty-state"
              >
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                <p className="text-xs text-muted-foreground font-semibold">
                  Tidak ada aset media yang cocok dengan pencarian
                </p>
              </div>
            ) : (
              filteredAssets.map((asset) => {
                const isSelected = selectedUrl === asset.url;

                return (
                  <div
                    key={asset.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedUrl(asset.url)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedUrl(asset.url);
                      }
                    }}
                    className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all flex flex-col focus:outline-hidden focus:ring-2 focus:ring-primary ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/50 shadow-md'
                        : 'border-border/80 hover:border-border hover:shadow-xs'
                    }`}
                    data-testid={`media-asset-card-${asset.id}`}
                  >
                    {/* Image Preview Box */}
                    <div className="aspect-video w-full bg-slate-900 relative flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                      <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-white/30" />
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      <Badge
                        variant="secondary"
                        className="absolute bottom-2 left-2 z-20 text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider bg-black/60 text-white border-0"
                      >
                        {asset.category}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    <div className="p-2.5 bg-card flex flex-col justify-between flex-1">
                      <p className="text-xs font-bold text-foreground truncate">
                        {asset.title}
                      </p>
                      <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {asset.dimensions}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Simulation Upload Bar */}
          <div className="p-3 rounded-xl border border-dashed border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="text-xs font-semibold text-foreground">
                Unggah Berkas Gambar Baru
              </p>
              <p className="text-[11px] text-muted-foreground">
                Simulasi penambahan aset gambar latar resolusi tinggi ke galeri lokal
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 shrink-0"
              onClick={handleSimulateUpload}
              data-testid="media-gallery-upload-button"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah Gambar Baru</span>
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="media-gallery-cancel-button"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAssign}
            data-testid="media-gallery-assign-button"
          >
            <Check className="w-4 h-4 mr-1" />
            <span>Pilih & Pasang Latar</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
