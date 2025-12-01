'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  SidebarPreferences,
  SectionId,
  loadPreferences,
  savePreferences,
  toggleCollapsed,
  moveSectionUp,
  moveSectionDown,
  getDefaultPreferences,
} from './preferences';

export function useSidebarPreferences() {
  // Initialize with defaults, then load from localStorage after mount
  const [prefs, setPrefs] = useState<SidebarPreferences>(getDefaultPreferences);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    // Use requestAnimationFrame to defer state updates and avoid lint warnings
    const frameId = requestAnimationFrame(() => {
      const loaded = loadPreferences();
      setPrefs(loaded);
      setHasHydrated(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const toggle = useCallback((sectionId: SectionId) => {
    setPrefs((prev) => {
      const updated = toggleCollapsed(prev, sectionId);
      savePreferences(updated);
      return updated;
    });
  }, []);

  const moveUp = useCallback((sectionId: SectionId) => {
    setPrefs((prev) => {
      const updated = moveSectionUp(prev, sectionId);
      savePreferences(updated);
      return updated;
    });
  }, []);

  const moveDown = useCallback((sectionId: SectionId) => {
    setPrefs((prev) => {
      const updated = moveSectionDown(prev, sectionId);
      savePreferences(updated);
      return updated;
    });
  }, []);

  const isCollapsed = useCallback(
    (sectionId: SectionId) => prefs.collapsed.has(sectionId),
    [prefs.collapsed]
  );

  const reorder = useCallback((fromId: SectionId, toId: SectionId, position: 'above' | 'below') => {
    setPrefs((prev) => {
      const newOrder = [...prev.order];
      const fromIndex = newOrder.indexOf(fromId);
      let toIndex = newOrder.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return prev;
      if (fromIndex === toIndex) return prev;

      // Remove the item from its current position
      newOrder.splice(fromIndex, 1);

      // Find the new target index (it may have shifted after removal)
      toIndex = newOrder.indexOf(toId);

      // Insert at the correct position
      if (position === 'below') {
        newOrder.splice(toIndex + 1, 0, fromId);
      } else {
        newOrder.splice(toIndex, 0, fromId);
      }

      const updated = { ...prev, order: newOrder };
      savePreferences(updated);
      return updated;
    });
  }, []);

  return {
    prefs,
    hasHydrated,
    isCollapsed,
    toggle,
    moveUp,
    moveDown,
    reorder,
    order: prefs.order,
  };
}

export type { SectionId, SidebarPreferences };
