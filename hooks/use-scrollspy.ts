"use client";

import { useState, useEffect, useRef } from "react";

export function useScrollspy(sectionIds: string[], offset = 80) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const visibleSections = new Map<string, boolean>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibleSections.set(entry.target.id, entry.isIntersecting);
        });

        // Find the first visible section (top-down order)
        for (const id of sectionIds) {
          if (visibleSections.get(id)) {
            setActiveId(id);
            return;
          }
        }
      },
      {
        rootMargin: `-${offset}px 0px -60% 0px`,
        threshold: 0,
      }
    );

    // Observe all sections
    const elements: Element[] = [];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) {
        observerRef.current.observe(el);
        elements.push(el);
      }
    }

    // Set initial active to first section
    if (!activeId && sectionIds.length > 0) {
      setActiveId(sectionIds[0]);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sectionIds, offset]);

  return activeId;
}
