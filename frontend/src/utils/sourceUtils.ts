/**
 * Source deduplication and processing utilities for optimal frontend performance
 */

export interface Source {
  url: string;
  title: string;
  excerpt: string;
  relevance_score: number;
  rank?: number;
}

/**
 * Deduplicate sources by URL, keeping the one with highest relevance score
 * Optimized for zero latency impact on first token
 */
export const deduplicateSources = (sources: Source[]): Source[] => {
  if (!sources || sources.length === 0) return [];
  
  const sourceMap = new Map<string, Source>();
  
  // Process sources and keep highest relevance score for each URL
  sources.forEach((source, index) => {
    const existing = sourceMap.get(source.url);
    
    // Keep the source with higher relevance score, or first occurrence if scores are equal
    if (!existing || source.relevance_score > existing.relevance_score) {
      sourceMap.set(source.url, {
        ...source,
        rank: existing ? existing.rank : index + 1 // Preserve original rank
      });
    }
  });
  
  // Convert back to array and sort by relevance score (highest first)
  return Array.from(sourceMap.values())
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 6); // Limit to top 6 unique sources
};

/**
 * Additional source quality improvements
 */
export const enhanceSources = (sources: Source[]): Source[] => {
  return sources.map(source => ({
    ...source,
    // Clean title by removing common suffixes
    title: cleanSourceTitle(source.title),
    // Ensure excerpt doesn't end mid-word
    excerpt: cleanExcerpt(source.excerpt)
  }));
};

/**
 * Clean source titles by removing redundant domain info
 */
const cleanSourceTitle = (title: string): string => {
  // Remove common patterns like " - Wikipedia", " | IBM", etc.
  return title
    .replace(/ - Wikipedia$/, '')
    .replace(/ \| [A-Z][a-z]+$/, '')
    .replace(/ - [A-Z][a-z]+ [A-Z][a-z]+$/, '')
    .trim();
};

/**
 * Clean excerpts to avoid cutting words mid-sentence
 */
const cleanExcerpt = (excerpt: string): string => {
  if (!excerpt) return '';
  
  // If excerpt ends with "...", find last complete sentence
  if (excerpt.endsWith('...')) {
    const lastSentence = excerpt.lastIndexOf('.');
    if (lastSentence > excerpt.length - 50) { // If sentence end is near the truncation
      return excerpt.substring(0, lastSentence + 1);
    }
  }
  
  return excerpt;
};

/**
 * Process sources received from SSE stream
 * Call this when receiving sources event from backend
 */
export const processSources = (rawSources: Source[]): Source[] => {
  const deduplicated = deduplicateSources(rawSources);
  const enhanced = enhanceSources(deduplicated);
  
  console.log(`✨ Source processing: ${rawSources.length} → ${enhanced.length} unique sources`);
  
  return enhanced;
};