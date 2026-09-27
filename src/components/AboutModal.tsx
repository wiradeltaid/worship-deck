import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/operator';
import { ShieldCheck, ExternalLink, Mail, Info } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CANONICAL_COPYRIGHT = 'Copyright (c) 2026 Wira Delta Indonesia';
export const CANONICAL_LICENSE = 'Free software under the MIT License. Source: LICENSE';
export const CANONICAL_CHURCH_DISCLAIMER =
  'This installation is operated by the local church administration, not by the publisher. What is stored, and who answers for it: PRIVACY.md';
export const CANONICAL_HYMN_EXCLUSION =
  'Hymn texts are not covered by the MIT license and are not ours to license. See ATTRIBUTIONS.md';
export const CANONICAL_STUDIO_URL = 'https://wiradelta.id/worship-deck';
export const CANONICAL_SUPPORT_EMAIL = 'support@wiradelta.com';

export default function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const { t } = useT();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="items-center text-center pb-2 border-b border-border/60">
          <div className="w-14 h-14 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-center overflow-hidden mb-2">
            <img
              src="/branding/worship-deck-icon-square.svg"
              alt="WorshipDeck"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl font-bold tracking-tight">
              WorshipDeck
            </DialogTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              v{appVersion}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('chrome.about.tagline')}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Publisher & License Section */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" />
              <span>{t('chrome.about.publisher')} & {t('chrome.about.license')}</span>
            </div>
            <p className="text-foreground/90 font-medium">
              {CANONICAL_COPYRIGHT}
            </p>
            <p className="text-muted-foreground">
              {CANONICAL_LICENSE}
            </p>
          </div>

          {/* Local-First & Zero Telemetry Badge */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <ShieldCheck className="size-3.5" />
              <span>{t('chrome.about.zeroTelemetry')}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              WorshipDeck operates strictly local-first with zero telemetry and zero background outbound calls. All church service data, lyrics, and configurations remain on your local network and storage.
            </p>
          </div>

          {/* Church Operator Liability Separation */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1">
            <div className="font-semibold text-foreground">
              {t('chrome.about.churchLiability')}
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {CANONICAL_CHURCH_DISCLAIMER}
            </p>
          </div>

          {/* Hymn Text License Exclusion */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1">
            <div className="font-semibold text-foreground">
              {t('chrome.about.hymnNotice')}
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {CANONICAL_HYMN_EXCLUSION}
            </p>
          </div>

          {/* Publisher Contact & Studio Links */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
            <div className="font-semibold text-foreground">
              {t('chrome.about.support')}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 text-xs">
              <a
                href={CANONICAL_STUDIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <span>Wira Delta Indonesia</span>
                <ExternalLink className="size-3" />
              </a>
              <span className="hidden sm:inline text-muted-foreground">•</span>
              <a
                href={`mailto:${CANONICAL_SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-mono"
              >
                <Mail className="size-3" />
                <span>{CANONICAL_SUPPORT_EMAIL}</span>
              </a>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border/60">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('chrome.about.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
