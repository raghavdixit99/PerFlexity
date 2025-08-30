/**
 * useCitations Hook
 * 
 * Custom React hook for managing citation state, interactions,
 * and parsing within chat messages and components.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CitationData, CitationHoverState, UseCitationsReturn } from './types';
import { parseCitationsFromText } from './utils';

/**
 * Main citations management hook
 */
export function useCitations(initialCitations: CitationData[] = []): UseCitationsReturn {
  const [citations, setCitations] = useState<CitationData[]>(initialCitations);
  const citationMapRef = useRef<Map<string, CitationData>>(new Map());

  // Update citation map when citations change
  useEffect(() => {
    citationMapRef.current.clear();
    citations.forEach(citation => {
      citationMapRef.current.set(citation.id, citation);
    });
  }, [citations]);

  const addCitation = useCallback((citation: CitationData) => {
    setCitations(prev => {
      const exists = prev.some(c => c.id === citation.id);
      if (exists) {
        // Update existing citation
        return prev.map(c => c.id === citation.id ? citation : c);
      }
      return [...prev, citation];
    });
  }, []);

  const removeCitation = useCallback((id: string) => {
    setCitations(prev => prev.filter(c => c.id !== id));
  }, []);

  const getCitation = useCallback((id: string) => {
    return citationMapRef.current.get(id);
  }, []);

  const clearCitations = useCallback(() => {
    setCitations([]);
  }, []);

  const parseCitations = useCallback((text: string, availableCitations: CitationData[]) => {
    return parseCitationsFromText(text, availableCitations);
  }, []);

  return {
    citations,
    addCitation,
    removeCitation,
    getCitation,
    clearCitations,
    parseCitations,
  };
}

/**
 * Hook for managing citation hover states and positioning
 */
export function useCitationHover() {
  const [hoverState, setHoverState] = useState<CitationHoverState>({
    isHovered: false,
    position: null,
    citation: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();

  const showHover = useCallback((citation: CitationData, element: HTMLElement) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const rect = element.getBoundingClientRect();
    setHoverState({
      isHovered: true,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top,
      },
      citation,
    });
  }, []);

  const hideHover = useCallback((delay = 100) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setHoverState({
        isHovered: false,
        position: null,
        citation: null,
      });
    }, delay);
  }, []);

  const clearHover = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoverState({
      isHovered: false,
      position: null,
      citation: null,
    });
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    hoverState,
    showHover,
    hideHover,
    clearHover,
  };
}

/**
 * Hook for managing citation interactions (click, hover, keyboard)
 */
export function useCitationInteractions() {
  const [activeCitation, setActiveCitation] = useState<CitationData | null>(null);
  const [selectedCitations, setSelectedCitations] = useState<Set<string>>(new Set());

  const handleCitationClick = useCallback((citation: CitationData) => {
    setActiveCitation(citation);
    
    // Optional: Track analytics
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'citation_click', {
        citation_id: citation.id,
        citation_url: citation.url,
      });
    }
  }, []);

  const handleCitationDoubleClick = useCallback((citation: CitationData) => {
    // Open source in new tab
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  }, []);

  const selectCitation = useCallback((citationId: string) => {
    setSelectedCitations(prev => {
      const newSet = new Set(prev);
      newSet.add(citationId);
      return newSet;
    });
  }, []);

  const deselectCitation = useCallback((citationId: string) => {
    setSelectedCitations(prev => {
      const newSet = new Set(prev);
      newSet.delete(citationId);
      return newSet;
    });
  }, []);

  const toggleCitationSelection = useCallback((citationId: string) => {
    setSelectedCitations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(citationId)) {
        newSet.delete(citationId);
      } else {
        newSet.add(citationId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCitations(new Set());
  }, []);

  const clearActiveCitation = useCallback(() => {
    setActiveCitation(null);
  }, []);

  return {
    activeCitation,
    selectedCitations,
    handleCitationClick,
    handleCitationDoubleClick,
    selectCitation,
    deselectCitation,
    toggleCitationSelection,
    clearSelection,
    clearActiveCitation,
  };
}

/**
 * Hook for keyboard navigation of citations
 */
export function useCitationKeyboard(citations: CitationData[]) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < citations.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : citations.length - 1
        );
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && citations[focusedIndex]) {
          window.open(citations[focusedIndex].url, '_blank', 'noopener,noreferrer');
        }
        break;
      case 'Escape':
        setFocusedIndex(-1);
        break;
    }
  }, [citations, focusedIndex]);

  const focusedCitation = focusedIndex >= 0 ? citations[focusedIndex] : null;

  return {
    focusedIndex,
    focusedCitation,
    setFocusedIndex,
    handleKeyDown,
  };
}

/**
 * Hook for citation analytics and tracking
 */
export function useCitationAnalytics() {
  const trackCitationView = useCallback((citation: CitationData) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'citation_view', {
        citation_id: citation.id,
        citation_url: citation.url,
        citation_domain: new URL(citation.url).hostname,
      });
    }
  }, []);

  const trackCitationClick = useCallback((citation: CitationData) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'citation_click', {
        citation_id: citation.id,
        citation_url: citation.url,
        citation_domain: new URL(citation.url).hostname,
      });
    }
  }, []);

  const trackCitationHover = useCallback((citation: CitationData, duration: number) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'citation_hover', {
        citation_id: citation.id,
        hover_duration: duration,
      });
    }
  }, []);

  return {
    trackCitationView,
    trackCitationClick,
    trackCitationHover,
  };
}

/**
 * Compound hook that combines all citation functionality
 */
export function useCitationManager(initialCitations: CitationData[] = []) {
  const citations = useCitations(initialCitations);
  const hover = useCitationHover();
  const interactions = useCitationInteractions();
  const keyboard = useCitationKeyboard(citations.citations);
  const analytics = useCitationAnalytics();

  return {
    ...citations,
    ...hover,
    ...interactions,
    ...keyboard,
    ...analytics,
  };
}
