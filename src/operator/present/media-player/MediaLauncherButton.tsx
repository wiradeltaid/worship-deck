import { memo } from 'react';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MediaLauncherButtonProps {
  itemCount: number;
  isPlaying: boolean;
  isDrawerOpen: boolean;
  onClick: () => void;
  className?: string;
}

export const MediaLauncherButton = memo(function MediaLauncherButton({
  itemCount,
  isPlaying,
  isDrawerOpen,
  onClick,
  className,
}: MediaLauncherButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      data-testid="media-launcher-button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'relative h-8 gap-1.5 px-2.5 text-xs font-medium transition-colors',
        isDrawerOpen && 'border-primary bg-primary/10 text-primary',
        className
      )}
      title="Buka Media Player & Playlist"
    >
      <Music
        className={cn(
          'h-3.5 w-3.5',
          isPlaying && 'text-emerald-400 animate-pulse'
        )}
      />
      <span>Media</span>
      {itemCount > 0 && (
        <span
          data-testid="media-launcher-count-badge"
          className="ml-0.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px] font-semibold text-foreground"
        >
          {itemCount}
        </span>
      )}
    </Button>
  );
});
