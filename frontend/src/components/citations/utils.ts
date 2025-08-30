/**
 * Citation Utilities
 * 
 * This module provides utility functions for parsing citations from text,
 * formatting citations, and handling citation interactions.
 */

import { CitationData, CitationParseResult } from './types';

/**
 * Regular expressions for citation parsing
 */
const CITATION_PATTERNS = {
  // Matches [1], [2], etc.
  numbered: /\[(\d+)\]/g,
  // Matches [citation-id], [source-1], etc.
  named: /\[([a-zA-Z0-9\-_]+)\]/g,
  // Matches [[text]], [[source text]]
  bracketed: /\[\[([^\]]+)\]\]/g,
  // Matches {1}, {source-1}, etc.
  braced: /\{([a-zA-Z0-9\-_]+)\}/g,
};

/**
 * Parses citations from text content and returns the text with citation markers
 * and a list of found citations with their positions
 */
export function parseCitationsFromText(
  text: string, 
  availableCitations: CitationData[]
): CitationParseResult {
  const citations: CitationParseResult['citations'] = [];
  let processedText = text;
  
  // Create a map of citation IDs and indices for quick lookup
  const citationMap = new Map<string, CitationData>();
  const citationIndexMap = new Map<string, number>();
  
  availableCitations.forEach((citation, index) => {
    citationMap.set(citation.id, citation);
    citationIndexMap.set(citation.id, index + 1);
    // Also map by index for numbered citations
    citationIndexMap.set((index + 1).toString(), index + 1);
    citationMap.set((index + 1).toString(), citation);
  });

  // Process numbered citations [1], [2], etc.
  processedText = processedText.replace(CITATION_PATTERNS.numbered, (match, num, offset) => {
    const citation = citationMap.get(num);
    if (citation) {
      citations.push({
        id: citation.id,
        start: offset,
        end: offset + match.length,
        originalText: match,
      });
      return `<citation-marker data-id="${citation.id}" data-index="${num}">${match}</citation-marker>`;
    }
    return match;
  });

  // Process named citations [citation-id], [source-1], etc.
  processedText = processedText.replace(CITATION_PATTERNS.named, (match, id, offset) => {
    const citation = citationMap.get(id);
    if (citation) {
      const index = citationIndexMap.get(id) || citations.length + 1;
      citations.push({
        id: citation.id,
        start: offset,
        end: offset + match.length,
        originalText: match,
      });
      return `<citation-marker data-id="${citation.id}" data-index="${index}">${match}</citation-marker>`;
    }
    return match;
  });

  return {
    text: processedText,
    citations,
  };
}

/**
 * Extracts domain from URL for display purposes
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Truncates text to a specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Formats citation title for display
 */
export function formatCitationTitle(citation: CitationData): string {
  if (!citation.title || citation.title.trim() === '') {
    return extractDomain(citation.url);
  }
  return truncateText(citation.title, 50);
}

/**
 * Gets favicon URL for a given domain
 */
export function getFaviconUrl(url: string): string {
  try {
    const domain = extractDomain(url);
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  } catch {
    return '/favicon-default.svg';
  }
}

/**
 * Determines citation color based on relevance score
 */
export function getCitationColor(relevanceScore?: number): string {
  if (!relevanceScore) return 'default';
  
  if (relevanceScore >= 0.8) return 'green';
  if (relevanceScore >= 0.6) return 'blue';
  if (relevanceScore >= 0.4) return 'yellow';
  return 'red';
}

/**
 * Calculates optimal popover position to avoid viewport edges
 */
export function calculatePopoverPosition(
  triggerRect: DOMRect,
  popoverWidth: number = 300,
  popoverHeight: number = 200,
  preferredPlacement: 'top' | 'bottom' | 'left' | 'right' | 'auto' = 'auto'
): { placement: string; x: number; y: number } {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  const positions = {
    top: {
      x: triggerRect.left + triggerRect.width / 2 - popoverWidth / 2,
      y: triggerRect.top - popoverHeight - 8,
    },
    bottom: {
      x: triggerRect.left + triggerRect.width / 2 - popoverWidth / 2,
      y: triggerRect.bottom + 8,
    },
    left: {
      x: triggerRect.left - popoverWidth - 8,
      y: triggerRect.top + triggerRect.height / 2 - popoverHeight / 2,
    },
    right: {
      x: triggerRect.right + 8,
      y: triggerRect.top + triggerRect.height / 2 - popoverHeight / 2,
    },
  };

  // If auto, determine best position
  if (preferredPlacement === 'auto') {
    const spaceTop = triggerRect.top;
    const spaceBottom = viewport.height - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewport.width - triggerRect.right;

    if (spaceBottom >= popoverHeight + 8) {
      preferredPlacement = 'bottom';
    } else if (spaceTop >= popoverHeight + 8) {
      preferredPlacement = 'top';
    } else if (spaceRight >= popoverWidth + 8) {
      preferredPlacement = 'right';
    } else {
      preferredPlacement = 'left';
    }
  }

  const position = positions[preferredPlacement as keyof typeof positions];

  // Adjust position to stay within viewport
  const x = Math.max(8, Math.min(position.x, viewport.width - popoverWidth - 8));
  const y = Math.max(8, Math.min(position.y, viewport.height - popoverHeight - 8));

  return {
    placement: preferredPlacement,
    x,
    y,
  };
}

/**
 * Debounce function for hover events
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Mock citation data for development and testing
 */
export const mockCitations: CitationData[] = [
  {
    id: 'cite-1',
    title: 'Understanding TypeScript: A Comprehensive Guide',
    url: 'https://www.typescriptlang.org/docs/',
    snippet: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
    relevance_score: 0.9,
    position: { start: 0, end: 0 },
    metadata: {
      domain: 'typescriptlang.org',
      author: 'Microsoft',
      publish_date: '2023-01-15',
    },
  },
  {
    id: 'cite-2',
    title: 'React Best Practices for 2024',
    url: 'https://react.dev/learn',
    snippet: 'Learn the latest React patterns and best practices for building modern web applications.',
    relevance_score: 0.85,
    position: { start: 0, end: 0 },
    metadata: {
      domain: 'react.dev',
      author: 'React Team',
      publish_date: '2024-02-10',
    },
  },
  {
    id: 'cite-3',
    title: 'CSS Grid vs Flexbox: A Complete Guide',
    url: 'https://css-tricks.com/snippets/css/complete-guide-grid/',
    snippet: 'CSS Grid Layout is the most powerful layout system available in CSS. It is a 2-dimensional system, meaning it can handle both columns and rows.',
    relevance_score: 0.7,
    position: { start: 0, end: 0 },
    metadata: {
      domain: 'css-tricks.com',
      author: 'Chris House',
      publish_date: '2023-11-20',
    },
  },
  {
    id: 'cite-4',
    title: 'Node.js Performance Optimization',
    url: 'https://nodejs.org/en/docs/guides/performance-optimization',
    snippet: 'This guide provides an overview of how to optimize Node.js applications for performance.',
    relevance_score: 0.6,
    position: { start: 0, end: 0 },
    metadata: {
      domain: 'nodejs.org',
      author: 'Node.js Team',
      publish_date: '2023-09-05',
    },
  },
];

/**
 * Sample text with citations for testing
 */
export const mockTextWithCitations = `
Modern web development requires a deep understanding of several key technologies. TypeScript [1] provides excellent type safety for JavaScript applications, while React [2] offers a powerful component-based architecture for building user interfaces.

When it comes to styling, developers often debate between CSS Grid and Flexbox [3]. Both have their strengths, but understanding when to use each is crucial for effective layout design.

For backend development, Node.js [4] remains a popular choice, especially when performance optimization is considered from the start of the project.
`;
