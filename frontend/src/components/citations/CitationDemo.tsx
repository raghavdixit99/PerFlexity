/**
 * CitationDemo Component
 * 
 * Demonstration component showing all citation components in action.
 * Useful for development, testing, and documentation purposes.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@//components/ui/card';
import { Button } from '@//components/ui/button';
// Update the import path to the correct location if needed
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@//components/ui/tabs';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { CitationChip, NumberedCitationChip, MinimalCitationChip } from './CitationChip';
import { CitationList, CompactCitationList, CitationGrid } from './CitationList';
import { InlineCitation, SuperscriptCitation, HighlightedCitation } from './InlineCitation';
import { SourcePreview, SourceHoverPreview, SourcePopoverPreview } from './SourcePreview';
import { useCitationManager } from './useCitations';
import { mockCitations, mockTextWithCitations } from './utils';
import { CitationData } from './types';

/**
 * Demo message component with parsed citations
 */
function MessageWithCitations({
  content,
  citations,
}: {
  content: string;
  citations: CitationData[];
}) {
  const { handleCitationClick, handleCitationHover } = useCitationManager(citations);

  // Simple citation parsing for demo
  const parseContent = (text: string) => {
    return text.replace(/\[(\d+)\]/g, (match, num) => {
      const index = parseInt(num) - 1;
      const citation = citations[index];
      if (!citation) return match;

      return `<citation data-id="${citation.id}" data-index="${num}">${match}</citation>`;
    });
  };

  const parsedContent = parseContent(content);

  return (
    <div className="prose prose-sm max-w-none">
      <div
        dangerouslySetInnerHTML={{ __html: parsedContent }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const citationEl = target.closest('[data-id]') as HTMLElement;
          if (citationEl) {
            const id = citationEl.getAttribute('data-id');
            const citation = citations.find(c => c.id === id);
            if (citation) {
              handleCitationClick(citation);
            }
          }
        }}
      />
      <style jsx>{`
        [data-id] {
          color: rgb(59 130 246);
          cursor: pointer;
          text-decoration: underline;
          text-decoration-style: dotted;
          text-underline-offset: 2px;
        }
        [data-id]:hover {
          color: rgb(37 99 235);
          background-color: rgb(59 130 246 / 0.1);
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

/**
 * Citation chip variants demo
 */
function ChipVariantsDemo({ citations }: { citations: CitationData[] }) {
  const { handleCitationClick } = useCitationManager();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Standard Citation Chips</h3>
        <div className="flex flex-wrap gap-2">
          {citations.slice(0, 3).map((citation, index) => (
            <CitationChip
              key={citation.id}
              citation={citation}
              index={index + 1}
              onClick={handleCitationClick}
              size="sm"
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Numbered Citation Chips</h3>
        <div className="flex flex-wrap gap-2">
          {citations.slice(0, 4).map((citation, index) => (
            <NumberedCitationChip
              key={citation.id}
              citation={citation}
              index={index + 1}
              onClick={handleCitationClick}
              size="md"
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Minimal Citation Chips</h3>
        <div className="flex flex-wrap gap-1">
          {citations.map((citation, index) => (
            <MinimalCitationChip
              key={citation.id}
              citation={citation}
              index={index + 1}
              onClick={handleCitationClick}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Different Sizes</h3>
        <div className="flex items-center gap-3">
          <CitationChip
            citation={citations[0]}
            index={1}
            size="sm"
            onClick={handleCitationClick}
          />
          <CitationChip
            citation={citations[0]}
            index={1}
            size="md"
            onClick={handleCitationClick}
          />
          <CitationChip
            citation={citations[0]}
            index={1}
            size="lg"
            onClick={handleCitationClick}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline citation variants demo
 */
function InlineVariantsDemo({ citations }: { citations: CitationData[] }) {
  const { handleCitationClick } = useCitationManager();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Inline Citations in Text</h3>
        <p className="text-sm leading-relaxed">
          Modern web development requires understanding TypeScript{' '}
          <InlineCitation
            citation={citations[0]}
            index={1}
            onClick={handleCitationClick}
          />
          , React patterns{' '}
          <InlineCitation
            citation={citations[1]}
            index={2}
            onClick={handleCitationClick}
          />
          , and CSS layout techniques{' '}
          <InlineCitation
            citation={citations[2]}
            index={3}
            onClick={handleCitationClick}
          />
          .
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Superscript Citations</h3>
        <p className="text-sm leading-relaxed">
          This approach has been validated in multiple studies
          <SuperscriptCitation
            citation={citations[0]}
            index={1}
            onClick={handleCitationClick}
          />
          <SuperscriptCitation
            citation={citations[1]}
            index={2}
            onClick={handleCitationClick}
          />
          and is considered best practice.
        </p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Highlighted Citations</h3>
        <p className="text-sm leading-relaxed">
          Some text with{' '}
          <HighlightedCitation
            citation={citations[0]}
            index={1}
            onClick={handleCitationClick}
          >
            highlighted citation content
          </HighlightedCitation>
          {' '}that stands out from regular text.
        </p>
      </div>
    </div>
  );
}

/**
 * Source preview variants demo
 */
function PreviewVariantsDemo({ citations }: { citations: CitationData[] }) {
  const [showPopover, setShowPopover] = useState(false);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Hover Preview</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Hover over the citation to see the preview:
        </p>
        <SourceHoverPreview citation={citations[0]}>
          <Button variant="outline" size="sm">
            Hover for Preview
          </Button>
        </SourceHoverPreview>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Click Popover</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Click the citation to open a popover:
        </p>
        <SourcePopoverPreview
          citation={citations[1]}
          isOpen={showPopover}
          onClose={() => setShowPopover(false)}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPopover(true)}
          >
            Click for Preview
          </Button>
        </SourcePopoverPreview>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Automatic Preview</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Automatically chooses hover or click based on device:
        </p>
        <SourcePreview citation={citations[2]}>
          <Button variant="outline" size="sm">
            Smart Preview
          </Button>
        </SourcePreview>
      </div>
    </div>
  );
}

/**
 * Main demo component
 */
export function CitationDemo() {
  const [selectedCitation, setSelectedCitation] = useState<CitationData | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Citation Components Demo</h1>
        <p className="text-muted-foreground">
          Interactive demonstration of all citation components and their variants
        </p>
      </div>

      <Tabs defaultValue="message" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="message">Message Example</TabsTrigger>
          <TabsTrigger value="chips">Citation Chips</TabsTrigger>
          <TabsTrigger value="inline">Inline Citations</TabsTrigger>
          <TabsTrigger value="previews">Source Previews</TabsTrigger>
          <TabsTrigger value="lists">Citation Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="message" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chat Message with Citations</CardTitle>
              <CardDescription>
                Example of how citations appear in actual chat messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MessageWithCitations
                content={mockTextWithCitations}
                citations={mockCitations}
              />
              <Separator />
              <CitationList
                citations={mockCitations}
                onCitationClick={setSelectedCitation}
                title="Sources"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chips">
          <Card>
            <CardHeader>
              <CardTitle>Citation Chip Variants</CardTitle>
              <CardDescription>
                Different styles and sizes of citation chips
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChipVariantsDemo citations={mockCitations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inline">
          <Card>
            <CardHeader>
              <CardTitle>Inline Citation Variants</CardTitle>
              <CardDescription>
                Citations embedded within text content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InlineVariantsDemo citations={mockCitations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="previews">
          <Card>
            <CardHeader>
              <CardTitle>Source Preview Variants</CardTitle>
              <CardDescription>
                Different ways to preview citation sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewVariantsDemo citations={mockCitations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lists" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Standard Citation List</CardTitle>
              </CardHeader>
              <CardContent>
                <CitationList
                  citations={mockCitations}
                  onCitationClick={setSelectedCitation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compact Citation List</CardTitle>
              </CardHeader>
              <CardContent>
                <CompactCitationList
                  citations={mockCitations}
                  onCitationClick={setSelectedCitation}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Citation Grid</CardTitle>
            </CardHeader>
            <CardContent>
              <CitationGrid
                citations={mockCitations}
                onCitationClick={setSelectedCitation}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Selected Citation Display */}
      {selectedCitation && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm">Selected Citation</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4"
              onClick={() => setSelectedCitation(null)}
            >
              ×
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-semibold">{selectedCitation.title}</div>
              <div className="text-sm text-muted-foreground">{selectedCitation.url}</div>
              <div className="text-sm">{selectedCitation.snippet}</div>
              {selectedCitation.relevance_score && (
                <Badge variant="secondary">
                  {Math.round(selectedCitation.relevance_score * 100)}% relevant
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CitationDemo;
