export interface PredefinedFieldDef {
  id: string;
  variable_name: string;
  shown_text: string;
  field_type: 'text' | 'text_area' | 'image';
  input_length?: number | null;
  initial_lines?: number | null;
  extraction_regex?: string | null;
  seed_key?: string | null;
  is_system?: number;
  is_active?: number;
}

export interface FormGroupSlotDef {
  id: string;
  layout_id: string;
  grouping_id: string;
  sort_order: number;
  widget_kind: 'predefined_field' | 'song_set_entry' | 'announcement_slot';
  ref_key: string;
}

export interface FormGroupingDef {
  id: string;
  layout_id: string;
  label: string;
  description: string;
  sort_order: number;
  slots: FormGroupSlotDef[];
}

export interface FormLayoutData {
  layout: {
    id: string;
    title: string;
    description: string;
    is_active: number;
    version: number;
  };
  groupings: FormGroupingDef[];
  predefined_fields: PredefinedFieldDef[];
}

export function buildHistoricalGrouping(
  layoutData: FormLayoutData | null,
  fieldValues: Record<string, string>
): FormGroupingDef | null {
  if (!layoutData) return null;
  const assignedRefKeys = new Set<string>();
  for (const g of layoutData.groupings || []) {
    for (const s of g.slots || []) {
      assignedRefKeys.add(s.ref_key);
    }
  }

  // Find any key in fieldValues that has a value but is not assigned to any slot
  const unassignedEntries = Object.entries(fieldValues).filter(
    ([k, v]) => v !== undefined && v !== null && typeof v === 'string' && v.trim() !== '' && !assignedRefKeys.has(k)
  );

  if (unassignedEntries.length === 0) {
    return null;
  }

  return {
    id: 'grouping-preserved-historical',
    layout_id: layoutData.layout?.id || 'default-layout',
    label: 'Preserved Historical Fields',
    description: 'Values from previous service layout preserved for compatibility',
    sort_order: 9999,
    slots: unassignedEntries.map(([k], idx) => ({
      id: `slot-historical-${k}`,
      layout_id: layoutData.layout?.id || 'default-layout',
      grouping_id: 'grouping-preserved-historical',
      sort_order: idx + 1,
      widget_kind: 'predefined_field',
      ref_key: k,
    })),
  };
}
