import type { WorshipPreset, TimelineItem } from './types.ts';

export function computePresetDate(preset: WorshipPreset, baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

  let targetDay = 6; // default Sat
  if (preset === 'sabbath-morning') {
    targetDay = 6; // Saturday
  } else if (preset === 'vesper-friday') {
    targetDay = 5; // Friday
  } else if (preset === 'prayer-wednesday') {
    targetDay = 3; // Wednesday
  } else if (preset === 'special-service') {
    targetDay = 0; // Sunday
  } else if (preset === 'custom-non-preset') {
    return d.toISOString().split('T')[0];
  }

  let diff = (targetDay - day + 7) % 7;
  if (diff === 0 && preset !== 'sabbath-morning') {
    diff = 7;
  }
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function parseRawRundownText(text: string): TimelineItem[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  return lines.map((line, idx) => {
    const timeMatch = line.match(/^(\d{1,2}:\d{2})\s*[-–:]\s*(.*)$/);
    const duration = timeMatch ? timeMatch[1] : `09:${String(idx * 5).padStart(2, '0')}`;
    const content = timeMatch ? timeMatch[2].trim() : line;
    const lower = content.toLowerCase();

    if (lower.includes('lagu') || lower.includes('sdah') || lower.includes('pujian')) {
      const numMatch = content.match(/(\d+)/);
      const hymnNum = numMatch ? parseInt(numMatch[1], 10) : 123;
      return {
        id: `parsed-item-${idx + 1}`,
        type: 'song',
        title: content,
        subtitle: `SDAH ${hymnNum} (Key of D)`,
        duration,
        slidesCount: 3,
        songData: {
          hymnNumber: hymnNum,
          bookCode: 'SDAH',
          key: 'D',
          activeVerses: [1, 2, 4],
          backgroundUrl: '/assets/background-navy.jpg',
        },
      };
    } else if (lower.includes('warta') || lower.includes('pengumuman')) {
      return {
        id: `parsed-item-${idx + 1}`,
        type: 'announcement',
        title: content,
        subtitle: '4 Slide Warta & Pengumuman',
        duration,
        slidesCount: 4,
        announcementData: {
          looping: true,
          flyers: [
            { id: 'pf-1', title: 'Seminar Kesehatan', url: '/assets/flyer1.jpg', category: 'announcement' },
            { id: 'pf-2', title: 'Perkemahan Pemuda', url: '/assets/flyer2.jpg', category: 'announcement' },
            { id: 'pf-3', title: 'Jadwal Pendalaman Alkitab', url: '/assets/flyer3.jpg', category: 'announcement' },
            { id: 'pf-4', title: 'Perjamuan Kudus', url: '/assets/flyer4.jpg', category: 'announcement' },
          ],
        },
      };
    } else if (lower.includes('alkitab') || lower.includes('firman') || lower.includes('ayat')) {
      return {
        id: `parsed-item-${idx + 1}`,
        type: 'scripture',
        title: content,
        subtitle: 'TB2 (Terjemahan Baru 2)',
        duration,
        slidesCount: 2,
      };
    } else if (lower.includes('khotbah') || lower.includes('renungan') || lower.includes('sermon')) {
      return {
        id: `parsed-item-${idx + 1}`,
        type: 'sermon',
        title: content,
        subtitle: 'Pdt. Pembicara',
        duration,
        slidesCount: 1,
        sermonData: {
          speaker: 'Pdt. Pembicara',
          title: content,
          scriptureRef: 'Yohanes 3:16',
        },
      };
    } else {
      return {
        id: `parsed-item-${idx + 1}`,
        type: 'general',
        title: content,
        subtitle: 'Slide Acara',
        duration,
        slidesCount: 1,
        generalData: {
          notes: 'Dipimpin oleh Petugas',
        },
      };
    }
  });
}
