/**
 * Citation Components Index
 * 
 * Barrel file that exports all citation-related components, hooks, types, and utilities
 * for easy importing throughout the application.
 */

// Component exports
export { CitationChip, NumberedCitationChip, MinimalCitationChip } from './CitationChip';
export { CitationList, CompactCitationList, CitationGrid } from './CitationList';
export { 
  InlineCitation, 
  SuperscriptCitation, 
  HighlightedCitation,
  FootnoteCitation,
  CitationMarker,
  CitationProvider,
  useInlineCitations
} from './InlineCitation';
export { 
  SourcePreview, 
  SourceHoverPreview, 
  SourcePopoverPreview, 
  SourceDialogPreview 
} from './SourcePreview';

// Hook exports
export {
  useCitations,
  useCitationHover,
  useCitationInteractions,
  useCitationKeyboard,
  useCitationAnalytics,
  useCitationManager
} from './useCitations';

// Type exports
export type {
  CitationData,
  CitationDisplayProps,
  CitationListProps,
  SourcePreviewProps,
  CitationParseResult,
  CitationContextValue,
  UseCitationsReturn,
  CitationHoverState,
  CitationClickEvent
} from './types';

// Utility exports
export {
  parseCitationsFromText,
  extractDomain,
  truncateText,
  formatCitationTitle,
  getFaviconUrl,
  getCitationColor,
  calculatePopoverPosition,
  debounce,
  mockCitations,
  mockTextWithCitations
} from './utils';

// Demo component export (for development)
export { CitationDemo } from './CitationDemo';
