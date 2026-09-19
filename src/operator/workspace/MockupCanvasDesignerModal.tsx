import React, { useState, useEffect } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Palette,
  Type,
  ImageIcon,
  Sparkles,
  Check,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimelineItem, CanvasCustomStyle } from './types';
import { toast } from 'sonner';

interface MockupCanvasDesignerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TimelineItem;
  onApply: (updated: Partial<TimelineItem>) => void;
  onOpenMediaGallery?: () => void;
}

export default function MockupCanvasDesignerModal({
  open,
  onOpenChange,
  item,
  onApply,
  onOpenMediaGallery,
}: MockupCanvasDesignerModalProps) {
  // Local working state for the designer
  const [alignX, setAlignX] = useState<'left' | 'center' | 'right'>(
    item.canvasStyle?.alignX || 'center'
  );
  const [alignY, setAlignY] = useState<'top' | 'middle' | 'bottom'>(
    item.canvasStyle?.alignY || 'middle'
  );
  const [fontFamily, setFontFamily] = useState<string>(
    item.canvasStyle?.fontFamily || 'Geist Sans'
  );
  const [fontSize, setFontSize] = useState<number>(
    item.canvasStyle?.fontSize || 28
  );
  const [textColor, setTextColor] = useState<string>(
    item.canvasStyle?.textColor || 'white'
  );
  const [backgroundUrl, setBackgroundUrl] = useState<string>(
    item.canvasStyle?.backgroundUrl ||
      item.songData?.backgroundUrl ||
      item.customSlideData?.backgroundUrl ||
      item.generalData?.backgroundUrl ||
      '/assets/background-navy.jpg'
  );

  // Sync state whenever the modal opens or active item changes
  useEffect(() => {
    if (open) {
      setAlignX(item.canvasStyle?.alignX || 'center');
      setAlignY(item.canvasStyle?.alignY || 'middle');
      setFontFamily(item.canvasStyle?.fontFamily || 'Geist Sans');
      setFontSize(item.canvasStyle?.fontSize || 28);
      setTextColor(item.canvasStyle?.textColor || 'white');
      setBackgroundUrl(
        item.canvasStyle?.backgroundUrl ||
          item.songData?.backgroundUrl ||
          item.customSlideData?.backgroundUrl ||
          item.generalData?.backgroundUrl ||
          '/assets/background-navy.jpg'
      );
    }
  }, [open, item]);

  const handleApply = () => {
    const updatedStyle: CanvasCustomStyle = {
      alignX,
      alignY,
      fontFamily,
      fontSize,
      textColor,
      backgroundUrl,
    };

    onApply({
      canvasStyle: updatedStyle,
      ...(item.type === 'song' && {
        songData: { ...item.songData, backgroundUrl },
      }),
      ...(item.type === 'custom_slide' && {
        customSlideData: {
          title: item.customSlideData?.title || item.title,
          content: item.customSlideData?.content || '',
          subtitle: item.customSlideData?.subtitle || item.subtitle,
          backgroundUrl,
          style: {
            alignment: alignX,
            fontSize,
            color: textColor,
          },
        },
      }),
    });

    toast.success('Tata letak kanvas berhasil diperbarui');
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Discard any local modifications cleanly
    onOpenChange(false);
  };

  // Helper classes for preview alignment
  const getAlignXClass = () => {
    switch (alignX) {
      case 'left':
        return 'text-left items-start';
      case 'right':
        return 'text-right items-end';
      case 'center':
      default:
        return 'text-center items-center';
    }
  };

  const getAlignYClass = () => {
    switch (alignY) {
      case 'top':
        return 'justify-start pt-8';
      case 'bottom':
        return 'justify-end pb-8';
      case 'middle':
      default:
        return 'justify-center';
    }
  };

  const getTextColorClass = () => {
    switch (textColor) {
      case 'amber':
        return 'text-amber-300 dark:text-amber-300';
      case 'cyan':
        return 'text-cyan-300 dark:text-cyan-300';
      case 'emerald':
        return 'text-emerald-300 dark:text-emerald-300';
      case 'white':
      default:
        return 'text-white dark:text-white';
    }
  };

  const getFontFamilyStyle = () => {
    if (fontFamily === 'Geist Mono') return { fontFamily: 'monospace' };
    if (fontFamily === 'Serif') return { fontFamily: 'serif' };
    return { fontFamily: 'sans-serif' };
  };

  // Sample body copy based on item type
  const previewBody =
    item.type === 'song'
      ? '"Hai pujilah Tuhan yang Maha Besar, kemuliaan-Nya kekal selamanya..."'
      : item.type === 'scripture'
      ? '"Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal..."'
      : item.type === 'custom_slide'
      ? item.customSlideData?.content || 'Teks slide bebas kustom multi-baris untuk responsif warta atau kutipan.'
      : item.type === 'sermon'
      ? item.sermonData?.speaker || 'Pdt. Dr. Johnathan Doe (Sintetis)'
      : item.subtitle || 'Keterangan umum tata ibadah jemaat';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6 gap-4"
        data-testid="canvas-designer-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <span>Ubah Tata Letak Kanvas (In-Place Designer)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto py-2">
          {/* Left / Center: Interactive Live 16:9 Canvas Stage */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-2">
            <div
              data-testid="designer-live-canvas"
              className={`relative aspect-video w-full rounded-xl overflow-hidden shadow-xl border border-border/80 bg-black flex flex-col p-6 select-none transition-all ${getAlignXClass()} ${getAlignYClass()}`}
              style={getFontFamilyStyle()}
            >
              {/* Simulated Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 opacity-90" />
              {backgroundUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-screen"
                  style={{ backgroundImage: `url(${backgroundUrl})` }}
                />
              )}

              {/* Slide Bounding Box Content */}
              <div
                className={`relative z-10 max-w-md w-full space-y-2 p-3 rounded-lg border border-primary/40 bg-black/40 backdrop-blur-xs transition-all ${getTextColorClass()}`}
              >
                <div className="border-b border-white/20 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {item.type}
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    {fontSize}px • {alignX}
                  </span>
                </div>

                <h2
                  className="font-extrabold tracking-tight"
                  style={{ fontSize: `${Math.max(16, fontSize * 0.8)}px` }}
                >
                  {item.title}
                </h2>

                <p
                  className="italic leading-relaxed"
                  style={{ fontSize: `${Math.max(12, fontSize * 0.6)}px` }}
                >
                  {previewBody}
                </p>

                {item.subtitle && (
                  <span className="inline-block text-[11px] font-medium opacity-80 pt-1">
                    {item.subtitle}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Pratinjau visual 16:9 interaktif • Perubahan dapat dibatalkan sewaktu-waktu
            </p>
          </div>

          {/* Right: Formatting & Customization Controls */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            {/* Horizontal Alignment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Penjajaran Teks (Horizontal)</Label>
              <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
                <Button
                  type="button"
                  variant={alignX === 'left' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => setAlignX('left')}
                  data-testid="designer-align-left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Kiri</span>
                </Button>
                <Button
                  type="button"
                  variant={alignX === 'center' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => setAlignX('center')}
                  data-testid="designer-align-center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                  <span>Tengah</span>
                </Button>
                <Button
                  type="button"
                  variant={alignX === 'right' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => setAlignX('right')}
                  data-testid="designer-align-right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                  <span>Kanan</span>
                </Button>
              </div>
            </div>

            {/* Vertical Position */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Posisi Vertikal</Label>
              <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
                <Button
                  type="button"
                  variant={alignY === 'top' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => setAlignY('top')}
                  data-testid="designer-valign-top"
                >
                  <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
                  <span>Atas</span>
                </Button>
                <Button
                  type="button"
                  variant={alignY === 'middle' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => setAlignY('middle')}
                  data-testid="designer-valign-middle"
                >
                  <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                  <span>Tengah</span>
                </Button>
                <Button
                  type="button"
                  variant={alignY === 'bottom' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => setAlignY('bottom')}
                  data-testid="designer-valign-bottom"
                >
                  <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
                  <span>Bawah</span>
                </Button>
              </div>
            </div>

            {/* Typography Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Font Family</Label>
                <Select
                  value={fontFamily}
                  onValueChange={(val) => {
                    if (val) setFontFamily(val);
                  }}
                >
                  <SelectTrigger
                    className="w-full h-8 text-xs"
                    data-testid="designer-font-family-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Geist Sans">Geist Sans</SelectItem>
                    <SelectItem value="Geist Mono">Geist Mono</SelectItem>
                    <SelectItem value="Serif">Serif Modern</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Ukuran Font</Label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {fontSize}px
                  </span>
                </div>
                <Input
                  type="number"
                  min={18}
                  max={48}
                  value={fontSize}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 28;
                    setFontSize(Math.min(48, Math.max(18, val)));
                  }}
                  className="h-8 text-xs font-mono"
                  data-testid="designer-font-size-input"
                />
              </div>
            </div>

            {/* Text Color Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Warna Tipografi</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'white', label: 'Putih', color: 'bg-white' },
                  { id: 'amber', label: 'Kuning', color: 'bg-amber-400' },
                  { id: 'cyan', label: 'Sian', color: 'bg-cyan-400' },
                  { id: 'emerald', label: 'Hijau', color: 'bg-emerald-400' },
                ].map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 px-2 justify-center gap-1.5 text-xs font-semibold ${
                      textColor === c.id
                        ? 'border-primary ring-2 ring-primary/40'
                        : 'border-border'
                    }`}
                    onClick={() => setTextColor(c.id)}
                    data-testid={`designer-color-${c.id}`}
                  >
                    <span className={`w-3 h-3 rounded-full ${c.color} inline-block shadow-2xs`} />
                    <span>{c.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Background Image / Preset Picker */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Gambar Latar Belakang</Label>
                {onOpenMediaGallery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary gap-1 p-0 hover:underline"
                    onClick={onOpenMediaGallery}
                    data-testid="designer-open-media-gallery"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Buka Galeri Media</span>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'navy', url: '/assets/background-navy.jpg', label: 'Deep Navy' },
                  { id: 'sanctuary', url: '/assets/background-sanctuary.jpg', label: 'Sanctuary' },
                  { id: 'nature', url: '/assets/background-nature.jpg', label: 'Nature' },
                  { id: 'cross', url: '/assets/background-cross.jpg', label: 'Cross Salib' },
                ].map((bg) => (
                  <Button
                    key={bg.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 px-2 text-xs truncate justify-start gap-1.5 ${
                      backgroundUrl === bg.url
                        ? 'border-primary ring-1 ring-primary bg-primary/10'
                        : 'border-border'
                    }`}
                    onClick={() => setBackgroundUrl(bg.url)}
                    data-testid={`designer-bg-${bg.id}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                    <span className="truncate">{bg.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            data-testid="canvas-designer-cancel-button"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            data-testid="canvas-designer-apply-button"
          >
            <Check className="w-4 h-4 mr-1" />
            <span>Terapkan Perubahan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
