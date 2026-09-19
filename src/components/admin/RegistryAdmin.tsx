import { useState } from 'react';
import ArtifactEditor from '@/components/admin/ArtifactEditor';
import { SongSetEntriesPanel } from '@/components/admin/SongSetEntriesPanel';
import { AnnouncementSetsPanel } from '@/components/admin/AnnouncementSetsPanel';
import { BackgroundLibraryPanel } from '@/components/admin/BackgroundLibraryPanel';
import { SongBooksPanel } from '@/components/admin/SongBooksPanel';
import { ParserProfilesPanel } from '@/components/admin/ParserProfilesPanel';
import { FormLayoutAdminPanel } from '@/components/admin/FormLayoutAdminPanel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/operator';
import type { CopiedSlide } from '@/lib/registry/canvas-adapters';

type RegistryTab = 'spine' | 'songSets' | 'songBooks' | 'announcements' | 'backgrounds' | 'parsing' | 'formLayout';

export function RegistryAdmin() {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<RegistryTab>('spine');
  const [copiedSlidePayload, setCopiedSlidePayload] = useState<CopiedSlide | null>(null);

  const tabs: { id: RegistryTab; label: string }[] = [
    { id: 'spine', label: t('admin.registry.tab.spine') },
    { id: 'songSets', label: t('admin.registry.tab.songSets') },
    { id: 'songBooks', label: t('admin.registry.tab.songBooks') },
    { id: 'announcements', label: t('admin.registry.tab.announcements') },
    { id: 'backgrounds', label: t('admin.registry.tab.mediaGallery') },
    { id: 'parsing', label: t('admin.registry.tab.parsing') },
    { id: 'formLayout', label: 'Layout & Fields' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-1.5">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </Card>

      <div className={activeTab === 'spine' ? 'block' : 'hidden'}>
        <ArtifactEditor
          copiedSlidePayload={copiedSlidePayload}
          onCopySlidePayloadChange={setCopiedSlidePayload}
        />
      </div>

      {activeTab === 'songSets' ? (
        <div>
          <SongSetEntriesPanel />
        </div>
      ) : null}

      {activeTab === 'songBooks' ? (
        <div>
          <SongBooksPanel />
        </div>
      ) : null}

      {activeTab === 'announcements' ? (
        <div>
          <AnnouncementSetsPanel
            copiedSlidePayload={copiedSlidePayload}
            onCopySlidePayloadChange={setCopiedSlidePayload}
          />
        </div>
      ) : null}

      {activeTab === 'backgrounds' ? (
        <div>
          <BackgroundLibraryPanel />
        </div>
      ) : null}

      {activeTab === 'parsing' ? (
        <div>
          <ParserProfilesPanel />
        </div>
      ) : null}

      {activeTab === 'formLayout' ? (
        <div>
          <FormLayoutAdminPanel />
        </div>
      ) : null}
    </div>
  );
}

export default RegistryAdmin;
