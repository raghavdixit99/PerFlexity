/**
 * Message Parser for Citations
 * 
 * Utility functions to parse streaming messages and extract inline citations,
 * handle citation positioning, and format content for display.
 */

import { CitationData } from '../components/citations/types';
import { ChatMessage, ProcessedMessageContent } from '../types/conversation';

// Citation Pattern Matching
export interface CitationPattern {
  pattern: RegExp;
  extractCitationId: (match: string) => string | null;
  extractDisplayText: (match: string) => string;
  type: 'inline' | 'superscript' | 'reference';
}

// Common citation patterns used in streaming responses
export const CITATION_PATTERNS: CitationPattern[] = [
  // Standard format: [1], [2], etc.
  {
    pattern: /\[(\d+)\]/g,
    extractCitationId: (match) => {
      const id = match.match(/\[(\d+)\]/)?.[1];
      return id ? `citation_${id}` : null;
    },
    extractDisplayText: (match) => match,
    type: 'inline'
  },
  
  // Reference format: (Smith et al., 2023)
  {
    pattern: /\([A-Za-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)/g,
    extractCitationId: (match) => {
      // Create ID from the reference text
      return `ref_${match.replace(/[^\w]/g, '_').toLowerCase()}`;
    },
    extractDisplayText: (match) => match,
    type: 'reference'
  },
  
  // Superscript format: ^1, ^2, etc.
  {
    pattern: /\^(\d+)/g,
    extractCitationId: (match) => {
      const id = match.match(/\^(\d+)/)?.[1];
      return id ? `citation_${id}` : null;
    },
    extractDisplayText: (match) => match,
    type: 'superscript'
  },
  
  // Custom format: {{cite:id}}
  {
    pattern: /\{\{cite:([^}]+)\}\}/g,
    extractCitationId: (match) => {
      return match.match(/\{\{cite:([^}]+)\}\}/)?.[1] || null;
    },
    extractDisplayText: (match) => {
      const id = match.match(/\{\{cite:([^}]+)\}\}/)?.[1];
      return id ? `[${id}]` : match;
    },
    type: 'inline'
  }
];

// Citation Marker Interface
export interface CitationMarker {
  start: number;
  end: number;
  citationId: string;
  displayText: string;
  originalText: string;
  type: CitationPattern['type'];
  index?: number;
}

/**
 * Parse message content to extract citation markers
 */
export function parseCitationMarkers(content: string): CitationMarker[] {
  const markers: CitationMarker[] = [];
  
  for (const pattern of CITATION_PATTERNS) {
    let match: RegExpExecArray | null;
    
    // Reset regex state
    pattern.pattern.lastIndex = 0;
    
    while ((match = pattern.pattern.exec(content)) !== null) {
      const citationId = pattern.extractCitationId(match[0]);
      
      if (citationId) {
        markers.push({
          start: match.index,
          end: match.index + match[0].length,
          citationId,
          displayText: pattern.extractDisplayText(match[0]),
          originalText: match[0],
          type: pattern.type
        });
      }
    }
  }
  
  // Sort markers by position
  return markers.sort((a, b) => a.start - b.start);
}

/**
 * Match citation markers with actual citation data
 */
export function matchCitationsWithMarkers(
  markers: CitationMarker[],
  citations: CitationData[]
): Array<CitationMarker & { citation: CitationData | null }> {
  
  return markers.map(marker => {
    // Try to find matching citation by different strategies
    let citation = null;
    
    // Strategy 1: Direct ID match
    citation = citations.find(c => c.id === marker.citationId);
    
    // Strategy 2: Index-based matching for numbered citations
    if (!citation && marker.type === 'inline') {
      const indexMatch = marker.citationId.match(/citation_(\d+)/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10) - 1; // Convert to 0-based
        citation = citations[index] || null;
      }
    }
    
    // Strategy 3: Title/URL fuzzy matching for reference citations
    if (!citation && marker.type === 'reference') {
      // This could be enhanced with fuzzy matching logic
      citation = citations[0] || null; // Fallback
    }
    
    return {
      ...marker,
      citation,
      index: citation ? citations.indexOf(citation) + 1 : undefined
    };
  });
}

/**
 * Process message content with citations
 */
export function processMessageContent(message: ChatMessage): ProcessedMessageContent {
  const content = message.content || '';
  const citations = message.citations || [];
  
  // Parse citation markers from content
  const markers = parseCitationMarkers(content);
  
  // Match markers with citation data
  const matchedMarkers = matchCitationsWithMarkers(markers, citations);
  
  // Filter out markers without valid citations
  const validMarkers = matchedMarkers.filter(m => m.citation !== null);
  
  return {
    text: content,
    citations,
    citationMarkers: validMarkers.map(m => ({
      start: m.start,
      end: m.end,
      citationId: m.citationId,
      index: m.index || 0
    }))
  };
}

/**
 * Render message content with interactive citations
 * Returns JSX elements with proper citation components
 */
export function renderContentWithCitations(
  content: string,
  citations: CitationData[],
  onCitationClick?: (citation: CitationData) => void,
  onCitationHover?: (citation: CitationData) => void
): React.ReactNode[] {
  if (!citations.length) {
    return [content];
  }
  
  const markers = parseCitationMarkers(content);
  const matchedMarkers = matchCitationsWithMarkers(markers, citations);
  
  if (!matchedMarkers.length) {
    return [content];
  }
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  matchedMarkers.forEach((marker, idx) => {
    // Add text before citation
    if (marker.start > lastIndex) {
      elements.push(content.slice(lastIndex, marker.start));
    }
    
    // Add citation component
    if (marker.citation) {
      const CitationComponent = React.createElement('InlineCitation', {
        key: `citation-${idx}`,
        citation: marker.citation,
        index: marker.index,
        onClick: onCitationClick,
        onHover: onCitationHover,
        text: marker.displayText
      });
      
      elements.push(CitationComponent);
    } else {
      // Fallback to original text if citation not found
      elements.push(marker.originalText);
    }
    
    lastIndex = marker.end;
  });
  
  // Add remaining text
  if (lastIndex < content.length) {
    elements.push(content.slice(lastIndex));
  }
  
  return elements;
}

/**
 * Format streaming content with partial citations
 * Handles the case where citations are still being received
 */
export function formatStreamingContent(
  currentContent: string,
  streamBuffer: string = '',
  citations: CitationData[] = []
): {
  displayContent: string;
  hasPendingCitations: boolean;
  pendingMarkers: CitationMarker[];
} {
  const fullContent = currentContent + streamBuffer;
  const markers = parseCitationMarkers(fullContent);
  const matchedMarkers = matchCitationsWithMarkers(markers, citations);
  
  // Check for markers without matching citations (pending)
  const pendingMarkers = matchedMarkers.filter(m => m.citation === null);
  
  return {
    displayContent: fullContent,
    hasPendingCitations: pendingMarkers.length > 0,
    pendingMarkers
  };
}

/**
 * Extract plain text content without citation markers
 * Useful for search, indexing, or accessibility
 */
export function extractPlainText(content: string): string {
  let plainText = content;
  
  // Remove all citation patterns
  for (const pattern of CITATION_PATTERNS) {
    plainText = plainText.replace(pattern.pattern, '');
  }
  
  // Clean up extra whitespace
  return plainText.replace(/\s+/g, ' ').trim();
}

/**
 * Validate citation positioning in content
 * Ensures citations are properly positioned within the text
 */
export function validateCitationPositioning(
  content: string,
  citations: CitationData[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if citation positions are within content bounds
  citations.forEach((citation, index) => {
    if (citation.position) {
      const { start, end } = citation.position;
      
      if (start < 0 || end < 0) {
        errors.push(`Citation ${index + 1}: Invalid negative position`);
      }
      
      if (start >= content.length || end > content.length) {
        errors.push(`Citation ${index + 1}: Position exceeds content length`);
      }
      
      if (start >= end) {
        errors.push(`Citation ${index + 1}: Start position >= end position`);
      }
    } else {
      warnings.push(`Citation ${index + 1}: No position information`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate citation summary for message
 */
export function generateCitationSummary(citations: CitationData[]): {
  totalCitations: number;
  uniqueDomains: string[];
  averageRelevance: number;
  highestRelevance: number;
} {
  if (!citations.length) {
    return {
      totalCitations: 0,
      uniqueDomains: [],
      averageRelevance: 0,
      highestRelevance: 0
    };
  }
  
  const domains = new Set<string>();
  let totalRelevance = 0;
  let maxRelevance = 0;
  
  citations.forEach(citation => {
    try {
      const url = new URL(citation.url);
      domains.add(url.hostname);
    } catch {
      // Invalid URL, skip domain extraction
    }
    
    const relevance = citation.relevance_score || 0;
    totalRelevance += relevance;
    maxRelevance = Math.max(maxRelevance, relevance);
  });
  
  return {
    totalCitations: citations.length,
    uniqueDomains: Array.from(domains),
    averageRelevance: totalRelevance / citations.length,
    highestRelevance: maxRelevance
  };
}

// Re-export React for the renderContentWithCitations function
import React from 'react';
