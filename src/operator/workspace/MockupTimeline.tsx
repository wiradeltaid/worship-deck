import React from 'react';
import { GripVertical, Plus, Music, BookOpen, Megaphone, Presentation, FileText, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TimelineItem, TimelineItemType } from './types';
import { toast } from 'sonner';

interface MockupTimelineProps {
  items: TimelineItem[];
  selectedId: string;
  onSelectItem: (id: string) => void;
  onAddItem: (type: TimelineItemType) => void;
  onMoveItem?: (id: string, direction: 'up' | 'down') => void;
  onDeleteItem?: (id: string) => void;
}

export function getTypeBadge(type: TimelineItemType) {
  switch (type) {
    case 'song':
      return {
        label: 'Pujian',
        icon: <Music className="w-3.5 h-3.5" />,
        className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      };
    case 'scripture':
      return {
        label: 'Firman',
        icon: <BookOpen className="w-3.5 h-3.5" />,
        className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      };
    case 'announcement':
      return {
        label: 'Warta',
        icon: <Megaphone className="w-3.5 h-3.5" />,
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      };
    case 'sermon':
      return {
        label: 'Khotbah',
        icon: <Presentation className="w-3.5 h-3.5" />,
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    case 'custom_slide':
      return {
        label: 'Slide Bebas',
        icon: <FileText className="w-3.5 h-3.5" />,
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    case 'general':
    default:
      return {
        label: 'Slide',
        icon: <FileText className="w-3.5 h-3.5" />,
        className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
      };
  }
}

export default function MockupTimeline({
  items,
  selectedId,
  onSelectItem,
  onAddItem,
  onMoveItem,
  onDeleteItem,
}: MockupTimelineProps) {
  return (
    <div
      data-testid="mockup-timeline"
      className="flex flex-col h-full bg-card/60 backdrop-blur-md rounded-2xl border border-border/80 shadow-sm overflow-hidden"
    >
      {/* Timeline Header */}
      <div className="p-4 border-b border-border/70 flex items-center justify-between bg-card/80">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Rundown Timeline</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {items.length} item
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Urutan jadwal ibadah dan slide aktif
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            data-testid="add-timeline-item-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Item</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-xs"
              onClick={() => onAddItem('song')}
              data-testid="add-song-option"
            >
              <Music className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Lagu / Pujian Baru</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-xs"
              onClick={() => onAddItem('announcement')}
              data-testid="add-announcement-option"
            >
              <Megaphone className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <span>Set Warta Jemaat</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-xs"
              onClick={() => onAddItem('scripture')}
              data-testid="add-scripture-option"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Ayat Pembacaan Alkitab</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-xs"
              onClick={() => onAddItem('sermon')}
              data-testid="add-sermon-option"
            >
              <Presentation className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Slide Khotbah / Pembicara</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-xs"
              onClick={() => onAddItem('custom_slide')}
              data-testid="add-custom-slide-option"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Slide Bebas (Kanvas Kustom)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-xs"
              onClick={() => onAddItem('general')}
              data-testid="add-general-option"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>Custom / General Slide</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Timeline Item List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div
            className="p-8 text-center space-y-3 border border-dashed border-border/80 rounded-xl bg-muted/20 my-4"
            data-testid="timeline-empty-state"
          >
            <p className="text-xs text-muted-foreground font-semibold">
              Belum ada item di jadwal ibadah ini (Jadwal Kosong)
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => onAddItem('custom_slide')}
              className="h-8 text-xs gap-1.5"
              data-testid="add-first-item-button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Item Pertama</span>
            </Button>
          </div>
        ) : (
          items.map((item, index) => {
          const isSelected = item.id === selectedId;
          const badge = getTypeBadge(item.type);

          return (
            <div
              key={item.id}
              data-testid={`timeline-item-${item.id}`}
              onClick={() => onSelectItem(item.id)}
              className={`group relative flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                  : 'bg-card/40 border-border/60 hover:bg-card/90 hover:border-border'
              }`}
            >
              {/* Drag Handle & Sequence Number */}
              <div className="flex items-center gap-1.5 pt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                <GripVertical className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 cursor-grab" />
                <span className="text-xs font-mono font-bold w-4 text-center">
                  {index + 1}
                </span>
              </div>

              {/* Item Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  {item.duration && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      ⏱ {item.duration}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/80 ml-auto font-mono">
                    {item.slidesCount} slide
                  </span>
                </div>

                <h3 className="text-xs font-semibold text-foreground truncate">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>

              {/* Move / Reorder Actions */}
              <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onMoveItem && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveItem(item.id, 'up');
                      }}
                      className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 rounded"
                      title="Geser ke atas"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === items.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveItem(item.id, 'down');
                      }}
                      className="h-5 w-5 p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 rounded"
                      title="Geser ke bawah"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}
