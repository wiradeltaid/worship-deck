import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/operator';
import { Cloud, Folder, Check, RefreshCw } from 'lucide-react';

export interface OneDriveSyncPromptModalProps {
  open: boolean;
  onClose: () => void;
  targetFolderPath?: string;
  onConfirmSync: (alwaysSync: boolean) => Promise<void> | void;
  onChangeFolder?: () => void;
}

export default function OneDriveSyncPromptModal({
  open,
  onClose,
  targetFolderPath = '',
  onConfirmSync,
  onChangeFolder,
}: OneDriveSyncPromptModalProps) {
  const { t } = useT();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onConfirmSync(dontAskAgain);
      onClose();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !syncing && onClose()}>
      <DialogContent className="max-w-md p-6" role="dialog" aria-modal="true" aria-label={t('onedrive.prompt.title')}>
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              {t('onedrive.prompt.title')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {t('onedrive.prompt.body')}
          </DialogDescription>
        </DialogHeader>

        {/* Target Folder Summary */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="truncate">
              <span className="text-muted-foreground mr-1">{t('onedrive.targetFolder')}:</span>
              <span className="font-mono font-medium text-foreground truncate">
                {targetFolderPath || t('onedrive.noFolderSelected')}
              </span>
            </div>
          </div>
          {onChangeFolder && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onChangeFolder}
              className="text-[11px] h-7 px-2 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 shrink-0"
            >
              {t('onedrive.changeFolder')}
            </Button>
          )}
        </div>

        {/* Don't ask again checkbox */}
        <div className="flex items-start gap-2.5 pt-1">
          <Checkbox
            id="dont-ask-again-onedrive"
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(Boolean(checked))}
            className="mt-0.5"
          />
          <Label
            htmlFor="dont-ask-again-onedrive"
            className="text-xs text-muted-foreground font-normal cursor-pointer leading-tight"
          >
            {t('onedrive.prompt.dontAskAgain')}
          </Label>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={syncing}
            className="w-full sm:w-auto"
          >
            {t('onedrive.prompt.skip')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSyncClick}
            disabled={syncing}
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
          >
            {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {syncing ? t('onedrive.prompt.syncing') : t('onedrive.prompt.syncNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
