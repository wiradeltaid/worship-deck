import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Tv,
  Eye,
  EyeOff,
  Search,
  BookOpen,
  Sparkles,
  Zap,
  Monitor,
  Check,
  Palette,
  FileCode,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TimelineItem } from './types';
import MockupCanvasDesignerModal from './MockupCanvasDesignerModal';
import { toast } from 'sonner';

interface MockupCanvasPreviewProps {
  item: TimelineItem;
  quickScriptureOpen: boolean;
  onSetQuickScriptureOpen: (open: boolean) => void;
  onUpdateItem?: (updated: Partial<TimelineItem>) => void;
}

export default function MockupCanvasPreview({
  item,
  quickScriptureOpen,
  onSetQuickScriptureOpen,
  onUpdateItem,
}: MockupCanvasPreviewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isBlackScreen, setIsBlackScreen] = useState(false);
  const [isClearText, setIsClearText] = useState(false);
  const [presenterSplitMode, setPresenterSplitMode] = useState<'operator' | 'projector'>('operator');
  const [canvasDesignerOpen, setCanvasDesignerOpen] = useState(false);

  // Quick Scripture Modal State
  const [scriptureQuery, setScriptureQuery] = useState('Yohanes 3:16');
  const [selectedTranslation, setSelectedTranslation] = useState('TB2');
  const [activeOverlayVerse, setActiveOverlayVerse] = useState<string | null>(null);

  // Reset slide index when active item changes
  useEffect(() => {
    setCurrentSlideIndex(0);
  }, [item.id]);

  const activeBackgroundUrl =
    item.canvasStyle?.backgroundUrl ||
    item.songData?.backgroundUrl ||
    item.customSlideData?.backgroundUrl ||
    item.generalData?.backgroundUrl;

  const alignXClass =
    item.canvasStyle?.alignX === 'left'
      ? 'text-left items-start'
      : item.canvasStyle?.alignX === 'right'
      ? 'text-right items-end'
      : 'text-center items-center';

  const alignYClass =
    item.canvasStyle?.alignY === 'top'
      ? 'justify-start pt-8'
      : item.canvasStyle?.alignY === 'bottom'
      ? 'justify-end pb-8'
      : 'justify-center';

  const customTextColorClass =
    item.canvasStyle?.textColor === 'amber'
      ? 'text-amber-300 dark:text-amber-300'
      : item.canvasStyle?.textColor === 'cyan'
      ? 'text-cyan-300 dark:text-cyan-300'
      : item.canvasStyle?.textColor === 'emerald'
      ? 'text-emerald-300 dark:text-emerald-300'
      : '';

  const customFontFamilyStyle =
    item.canvasStyle?.fontFamily === 'Geist Mono'
      ? { fontFamily: 'monospace' }
      : item.canvasStyle?.fontFamily === 'Serif'
      ? { fontFamily: 'serif' }
      : undefined;

  const totalSlides = item.slidesCount || 1;
  const safeSlideIndex = Math.min(currentSlideIndex, totalSlides - 1);

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => Math.min(totalSlides - 1, prev + 1));
  };

  const handleApplyQuickVerse = () => {
    if (!scriptureQuery.trim()) {
      toast.error('Masukkan ayat alkitab terlebih dahulu');
      return;
    }
    const verseText =
      scriptureQuery.toLowerCase().includes('yohanes 3:16')
        ? 'Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.'
        : `Firman Tuhan dari ${scriptureQuery} (${selectedTranslation}): "Tuhan adalah gembalaku, takkan kekurangan aku..."`;

    setActiveOverlayVerse(`${scriptureQuery} (${selectedTranslation})\n\n"${verseText}"`);
    toast.success(`⚡ Ayat ${scriptureQuery} sedang ditayangkan sebagai temporary overlay!`);
    onSetQuickScriptureOpen(false);
  };

  const handleClearOverlay = () => {
    setActiveOverlayVerse(null);
    toast.info('Overlay ayat kilat dinonaktifkan.');
  };

  return (
    <div
      data-testid="mockup-canvas-preview"
      className="flex flex-col h-full bg-card/60 backdrop-blur-md rounded-2xl border border-border/80 shadow-sm overflow-hidden"
    >
      {/* Header Bar */}
      <div className="p-4 border-b border-border/70 flex items-center justify-between bg-card/80 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold tracking-tight text-foreground">
            Live Canvas Preview
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setCanvasDesignerOpen(true)}
            data-testid="canvas-preview-edit-layout-button"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Edit Kanvas</span>
          </Button>

          {/* Presenter Split Toggle: Operator Confidence vs Projector Clean Output */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="toggle-operator-view"
              onClick={() => setPresenterSplitMode('operator')}
              className={`h-auto px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                presenterSplitMode === 'operator'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Operator Display
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="toggle-projector-view"
              onClick={() => setPresenterSplitMode('projector')}
              className={`h-auto px-2 py-0.5 text-[11px] font-semibold rounded transition-all ${
                presenterSplitMode === 'projector'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Projector Clean
            </Button>
          </div>
        </div>
      </div>

      {/* Main Preview Body */}
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">
        {/* 16:9 Canvas Screen */}
        <div
          data-testid="canvas-stage-container"
          className={`relative aspect-video w-full rounded-xl overflow-hidden shadow-md border border-border/80 bg-black flex flex-col p-6 text-white select-none transition-all ${alignXClass} ${alignYClass}`}
          style={customFontFamilyStyle}
        >
          {/* Black Screen Overlay */}
          {isBlackScreen && (
            <div
              data-testid="black-screen-overlay"
              className="absolute inset-0 bg-black z-30 flex items-center justify-center"
            >
              <span className="text-xs font-mono tracking-widest text-zinc-600 uppercase font-bold">
                [ BLACK SCREEN ACTIVE ]
              </span>
            </div>
          )}

          {/* Quick Scripture Overlay Simulation */}
          {activeOverlayVerse && !isBlackScreen && (
            <div
              data-testid="scripture-overlay-card"
              className="absolute inset-0 bg-black/90 z-25 p-6 flex flex-col justify-center items-center text-center backdrop-blur-xs"
            >
              <div className="max-w-md space-y-2">
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-black rounded uppercase tracking-wider">
                  ⚡ Ayat Kilat Overlay
                </span>
                <p className="text-xs md:text-sm font-serif italic text-amber-200 dark:text-amber-200 whitespace-pre-line leading-relaxed">
                  {activeOverlayVerse}
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleClearOverlay}
                  className="mt-2 text-[10px] text-zinc-400 hover:text-white underline p-0 h-auto"
                >
                  Tutup Overlay
                </Button>
              </div>
            </div>
          )}

          {/* Background Gradient / Image */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 opacity-90" />
          {activeBackgroundUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-screen"
              style={{ backgroundImage: `url(${activeBackgroundUrl})` }}
              data-testid="canvas-preview-background-layer"
            />
          )}

          {/* Simulated Content Based on Item Type */}
          {!isClearText && !isBlackScreen && (
            <div
              className={`relative z-10 max-w-lg space-y-2 ${alignXClass} ${customTextColorClass}`}
            >
              {item.type === 'song' && (
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-cyan-400 dark:text-cyan-400 uppercase tracking-wider font-semibold">
                    {item.subtitle || 'SDAH 123'} • Bait {safeSlideIndex + 1}
                  </span>
                  <h3
                    className="font-extrabold text-white"
                    style={{
                      fontSize: item.canvasStyle?.fontSize
                        ? `${item.canvasStyle.fontSize}px`
                        : '1rem',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-300 italic pt-1 font-serif">
                    "Hai pujilah Tuhan yang Maha Besar, kemuliaan-Nya kekal selamanya..."
                  </p>
                </div>
              )}

              {item.type === 'announcement' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-purple-400 dark:text-purple-400 uppercase tracking-wider font-semibold">
                    Warta Jemaat • Slide {safeSlideIndex + 1} of {totalSlides}
                  </span>
                  <div className="p-3 bg-white/10 rounded-lg backdrop-blur-xs border border-white/20">
                    <h3 className={`text-sm font-bold ${customTextColorClass || 'text-white'}`}>
                      {item.announcementData?.flyers?.[safeSlideIndex]?.title || item.title}
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Sabtu, Pukul 09:00 WIB • Gereja Masehi Advent Hari Ketujuh
                    </p>
                  </div>
                </div>
              )}

              {item.type === 'sermon' && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-amber-400 dark:text-amber-400 uppercase tracking-wider font-semibold">
                    Khotbah Sabat
                  </span>
                  <h2
                    className={`font-extrabold ${customTextColorClass || 'text-white'}`}
                    style={{
                      fontSize: item.canvasStyle?.fontSize
                        ? `${item.canvasStyle.fontSize}px`
                        : '1rem',
                    }}
                  >
                    {item.title}
                  </h2>
                  <p className="text-xs text-amber-200/90 dark:text-amber-200/90 font-medium">
                    {item.sermonData?.speaker || 'Pdt. Dr. Johnathan Doe (Sintetis)'}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-serif italic">
                    {item.sermonData?.scriptureRef || 'Yohanes 3:16-17'}
                  </p>
                </div>
              )}

              {item.type === 'scripture' && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-indigo-400 dark:text-indigo-400 uppercase tracking-wider font-semibold">
                    Pembacaan Alkitab
                  </span>
                  <p className="text-xs md:text-sm font-serif italic text-zinc-200 leading-relaxed">
                    "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal..."
                  </p>
                  <span className="text-xs font-bold text-indigo-300 dark:text-indigo-300">
                    Yohanes 3:16 (TB2)
                  </span>
                </div>
              )}

              {item.type === 'custom_slide' && (
                <div className="space-y-1" data-testid="custom-slide-preview">
                  <span className="text-[10px] font-mono text-emerald-400 dark:text-emerald-400 uppercase tracking-wider font-semibold">
                    Slide Bebas Kustom
                  </span>
                  <h3
                    className="font-extrabold text-white"
                    style={{
                      fontSize: item.canvasStyle?.fontSize
                        ? `${item.canvasStyle.fontSize}px`
                        : '1rem',
                    }}
                  >
                    {item.customSlideData?.title || item.title}
                  </h3>
                  <p className="text-xs text-zinc-200 whitespace-pre-line leading-relaxed italic font-serif">
                    {item.customSlideData?.content || 'Konten slide bebas kustom multi-baris.'}
                  </p>
                  {item.customSlideData?.subtitle && (
                    <span className="text-[11px] font-medium text-emerald-300 dark:text-emerald-300 block pt-1">
                      {item.customSlideData.subtitle}
                    </span>
                  )}
                </div>
              )}

              {item.type === 'general' && (
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-white">{item.title}</h3>
                  {item.subtitle && (
                    <p className="text-xs text-zinc-300">{item.subtitle}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Operator Chrome Indicators (Hidden in Projector View) */}
          {presenterSplitMode === 'operator' && (
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1 text-[10px] font-mono bg-black/70 px-2 py-0.5 rounded text-zinc-400 border border-white/10">
              <span>CONFIDENCE DISPLAY</span>
            </div>
          )}
        </div>

        {/* Slide Navigation Bar */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-card/40 rounded-xl border border-border/60">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrevSlide}
            disabled={safeSlideIndex === 0}
            className="h-7 px-2 text-xs"
            data-testid="prev-slide-button"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            <span>Prev</span>
          </Button>

          <span
            className="text-xs font-mono font-bold text-muted-foreground"
            data-testid="slide-counter-badge"
          >
            Slide {safeSlideIndex + 1} dari {totalSlides}
          </span>

          <Button
            size="sm"
            variant="outline"
            onClick={handleNextSlide}
            disabled={safeSlideIndex >= totalSlides - 1}
            className="h-7 px-2 text-xs"
            data-testid="next-slide-button"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {/* Filmstrip Thumbnail Previews */}
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground">
            Filmstrip Thumbnail Previews
          </Label>
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1"
            data-testid="filmstrip-container"
          >
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <Button
                key={idx}
                type="button"
                variant="outline"
                data-testid={`filmstrip-slide-${idx}`}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`relative shrink-0 w-24 aspect-video rounded-md border text-[10px] font-mono font-bold flex items-center justify-center transition-all p-0 h-auto ${
                  idx === safeSlideIndex
                    ? 'border-primary ring-1 ring-primary bg-primary/10 text-primary'
                    : 'border-border/80 bg-background/60 text-muted-foreground hover:border-foreground'
                }`}
              >
                #{idx + 1}
              </Button>
            ))}
          </div>
        </div>

        {/* Live Presentation Control Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/60">
          <Button
            size="sm"
            variant={isBlackScreen ? 'destructive' : 'outline'}
            onClick={() => setIsBlackScreen(!isBlackScreen)}
            className="h-8 text-xs font-semibold gap-1"
            data-testid="black-screen-toggle"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Black (B)</span>
          </Button>

          <Button
            size="sm"
            variant={isClearText ? 'secondary' : 'outline'}
            onClick={() => setIsClearText(!isClearText)}
            className="h-8 text-xs font-semibold gap-1"
            data-testid="clear-text-toggle"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Clear (C)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetQuickScriptureOpen(true)}
            className="h-8 text-xs font-semibold gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            data-testid="quick-scripture-trigger"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Ayat Kilat</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              toast.success('Simulasi Fullscreen Projector Preview diaktifkan');
            }}
            className="h-8 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
            data-testid="fullscreen-projector-toggle"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fullscreen</span>
          </Button>
        </div>
      </div>

      {/* Quick Scripture Modal Drawer */}
      <Dialog open={quickScriptureOpen} onOpenChange={onSetQuickScriptureOpen}>
        <DialogContent className="sm:max-w-md" data-testid="quick-scripture-modal">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4" />
              <span>⚡ Quick Scripture Lookup & Overlay (UC-13)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Cari ayat Alkitab dan tayangkan instan sebagai temporary overlay di layar proyektor tanpa mengubah rundown jadwal tetap.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cari Referensi Ayat</Label>
              <div className="relative">
                <Input
                  value={scriptureQuery}
                  onChange={(e) => setScriptureQuery(e.target.value)}
                  placeholder="Contoh: Yohanes 3:16, Mazmur 23:1"
                  className="h-8 text-xs pl-8"
                  data-testid="scripture-search-input"
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Versi Alkitab</Label>
              <Select
                value={selectedTranslation}
                onValueChange={(val) => {
                  if (val) setSelectedTranslation(val);
                }}
              >
                <SelectTrigger
                  className="w-full h-8 text-xs"
                  data-testid="scripture-translation-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TB2">TB2 — Terjemahan Baru Edisi 2</SelectItem>
                  <SelectItem value="KJV">KJV — King James Version</SelectItem>
                  <SelectItem value="BIS">BIS — Bahasa Indonesia Sehari-hari</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetQuickScriptureOpen(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleApplyQuickVerse}
              className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="apply-quick-verse-button"
            >
              Tayangkan Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-Place Canvas Designer Modal */}
      <MockupCanvasDesignerModal
        open={canvasDesignerOpen}
        onOpenChange={setCanvasDesignerOpen}
        item={item}
        onApply={(updated) => onUpdateItem?.(updated)}
      />
    </div>
  );
}
