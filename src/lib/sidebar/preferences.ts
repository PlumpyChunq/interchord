'use client';

const STORAGE_KEY = 'interchord-sidebar-prefs';

export type SectionId =
  | 'member_of'
  | 'founder_of'
  | 'collaboration'
  | 'producer'
  | 'touring_member'
  | 'side_project'
  | 'albums'
  | 'shows';

export interface SidebarPreferences {
  /** Which sections are collapsed */
  collapsed: Set<SectionId>;
  /** Order of sections (section IDs in display order) */
  order: SectionId[];
}

const DEFAULT_ORDER: SectionId[] = [
  'member_of',
  'founder_of',
  'collaboration',
  'producer',
  'touring_member',
  'side_project',
  'albums',
  'shows',
];

export function getDefaultPreferences(): SidebarPreferences {
  return {
    collapsed: new Set(),
    order: [...DEFAULT_ORDER],
  };
}

export function loadPreferences(): SidebarPreferences {
  if (typeof window === 'undefined') {
    return getDefaultPreferences();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultPreferences();
    }

    const parsed = JSON.parse(stored);
    return {
      collapsed: new Set(parsed.collapsed || []),
      order: parsed.order || [...DEFAULT_ORDER],
    };
  } catch {
    return getDefaultPreferences();
  }
}

export function savePreferences(prefs: SidebarPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    const toStore = {
      collapsed: Array.from(prefs.collapsed),
      order: prefs.order,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

export function toggleCollapsed(
  prefs: SidebarPreferences,
  sectionId: SectionId
): SidebarPreferences {
  const newCollapsed = new Set(prefs.collapsed);
  if (newCollapsed.has(sectionId)) {
    newCollapsed.delete(sectionId);
  } else {
    newCollapsed.add(sectionId);
  }
  return { ...prefs, collapsed: newCollapsed };
}

export function reorderSections(
  prefs: SidebarPreferences,
  fromIndex: number,
  toIndex: number
): SidebarPreferences {
  const newOrder = [...prefs.order];
  const [removed] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, removed);
  return { ...prefs, order: newOrder };
}

export function moveSectionUp(
  prefs: SidebarPreferences,
  sectionId: SectionId
): SidebarPreferences {
  const index = prefs.order.indexOf(sectionId);
  if (index <= 0) return prefs;
  return reorderSections(prefs, index, index - 1);
}

export function moveSectionDown(
  prefs: SidebarPreferences,
  sectionId: SectionId
): SidebarPreferences {
  const index = prefs.order.indexOf(sectionId);
  if (index < 0 || index >= prefs.order.length - 1) return prefs;
  return reorderSections(prefs, index, index + 1);
}
