/**
 * Source Display Component Tests
 * 
 * Test suite for source display components including
 * domain badges, timestamp formatting, and link behavior.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import { 
  SourceDisplay, 
  DomainBadge, 
  TimestampDisplay,
  SourceLink
} from '../SourceDisplay';
import { EvidenceSpan, EvidenceQuality } from '../../../types/cva';

const mockEvidenceSpan: EvidenceSpan = {
  doc_id: 'doc_1',
  text: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data.',
  start_offset: 0,
  end_offset: 100,
  url: 'https://example.com/machine-learning-intro',
  title: 'Introduction to Machine Learning',
  timestamp: '2024-01-15T10:30:00Z',
  confidence: 0.92,
  quality: EvidenceQuality.HIGH
};

const mockEvidenceWithoutUrl: EvidenceSpan = {
  doc_id: 'doc_2',
  text: 'Neural networks are computing systems.',
  start_offset: 0,
  end_offset: 50,
  confidence: 0.85,
  quality: EvidenceQuality.MEDIUM
};

describe('DomainBadge', () => {
  it('displays domain from URL correctly', () => {
    render(<DomainBadge url="https://example.com/some/path" />);
    
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('shows favicon when enabled', () => {
    render(<DomainBadge url="https://example.com" showFavicon={true} />);
    
    const favicon = screen.getByRole('img');
    expect(favicon).toHaveAttribute('src', expect.stringContaining('example.com'));
  });

  it('handles complex URLs correctly', () => {
    render(<DomainBadge url="https://subdomain.example.com/path/to/article?param=value" />);
    
    expect(screen.getByText('subdomain.example.com')).toBeInTheDocument();
  });

  it('applies custom variant classes', () => {
    render(<DomainBadge url="https://example.com" variant="secondary" />);
    
    const badge = screen.getByText('example.com');
    expect(badge).toBeInTheDocument();
  });
});

describe('TimestampDisplay', () => {
  it('displays relative time by default', () => {
    // Mock current date to be consistent
    const mockDate = new Date('2024-01-16T10:30:00Z');
    vi.setSystemTime(mockDate);
    
    render(<TimestampDisplay timestamp="2024-01-15T10:30:00Z" />);
    
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    
    vi.useRealTimers();
  });

  it('displays absolute time format', () => {
    render(<TimestampDisplay timestamp="2024-01-15T10:30:00Z" format="absolute" />);
    
    expect(screen.getByText('1/15/2024')).toBeInTheDocument();
  });

  it('shows unknown for missing timestamp', () => {
    render(<TimestampDisplay timestamp={undefined} />);
    
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows clock icon when enabled', () => {
    render(<TimestampDisplay timestamp="2024-01-15T10:30:00Z" showIcon={true} />);
    
    // Check for SVG element (clock icon)
    const svg = screen.getByText('Yesterday').previousSibling;
    expect(svg).toBeInTheDocument();
  });

  it('provides tooltip with full timestamp info', () => {
    render(<TimestampDisplay timestamp="2024-01-15T10:30:00Z" />);
    
    const timestampElement = screen.getByText(expect.stringMatching(/ago|Yesterday|Today/));
    expect(timestampElement).toHaveClass('cursor-help');
  });
});

describe('SourceLink', () => {
  it('renders as button when URL is provided', () => {
    const mockOnClick = vi.fn();
    render(
      <SourceLink evidence={mockEvidenceSpan} onClick={mockOnClick}>
        Click me
      </SourceLink>
    );
    
    const linkButton = screen.getByRole('button', { name: /click me/i });
    expect(linkButton).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const mockOnClick = vi.fn();
    render(
      <SourceLink evidence={mockEvidenceSpan} onClick={mockOnClick}>
        Click me
      </SourceLink>
    );
    
    const linkButton = screen.getByRole('button');
    fireEvent.click(linkButton);
    
    expect(mockOnClick).toHaveBeenCalledWith('https://example.com/machine-learning-intro');
  });

  it('renders as span when no URL is provided', () => {
    render(
      <SourceLink evidence={mockEvidenceWithoutUrl}>
        No link
      </SourceLink>
    );
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('No link')).toBeInTheDocument();
  });

  it('shows external link icon when enabled', () => {
    render(
      <SourceLink evidence={mockEvidenceSpan} showExternalIcon={true}>
        Link with icon
      </SourceLink>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});

describe('SourceDisplay', () => {
  it('renders compact display by default for evidence without title', () => {
    render(<SourceDisplay evidence={mockEvidenceWithoutUrl} />);
    
    // Should show domain badge and confidence in compact format
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders full display when title is present and showFull is true', () => {
    render(<SourceDisplay evidence={mockEvidenceSpan} showFull={true} />);
    
    expect(screen.getByText('Introduction to Machine Learning')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const minimalEvidence: EvidenceSpan = {
      doc_id: 'minimal',
      text: 'Minimal evidence',
      start_offset: 0,
      end_offset: 10,
      confidence: 0.5,
      quality: EvidenceQuality.LOW
    };

    render(<SourceDisplay evidence={minimalEvidence} />);
    
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('calls onSourceClick when source is clicked', () => {
    const mockOnSourceClick = vi.fn();
    render(
      <SourceDisplay 
        evidence={mockEvidenceSpan} 
        showFull={true}
        onSourceClick={mockOnSourceClick}
      />
    );
    
    const sourceLink = screen.getByText('Introduction to Machine Learning');
    fireEvent.click(sourceLink);
    
    expect(mockOnSourceClick).toHaveBeenCalledWith('https://example.com/machine-learning-intro');
  });

  it('displays quality indicators correctly', () => {
    render(<SourceDisplay evidence={mockEvidenceSpan} showFull={true} />);
    
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('truncates long evidence text in preview', () => {
    const longEvidence = {
      ...mockEvidenceSpan,
      text: 'This is a very long piece of evidence text that should be truncated when displayed in the preview mode to ensure the UI remains clean and readable for users browsing through multiple evidence sources.'
    };

    render(<SourceDisplay evidence={longEvidence} showFull={true} />);
    
    // Should show truncated text in preview
    const previewText = screen.getByText(/"This is a very long piece of evidence/);
    expect(previewText).toBeInTheDocument();
  });

  it('shows domain when showDomain is enabled', () => {
    render(
      <SourceDisplay 
        evidence={mockEvidenceSpan} 
        compact={true}
        showDomain={true}
      />
    );
    
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });
});

describe('Accessibility', () => {
  it('source links are keyboard accessible', () => {
    render(<SourceDisplay evidence={mockEvidenceSpan} showFull={true} />);
    
    const sourceLink = screen.getByRole('button');
    sourceLink.focus();
    
    expect(document.activeElement).toBe(sourceLink);
  });

  it('has proper ARIA labels for interactive elements', () => {
    const mockOnSourceClick = vi.fn();
    render(
      <SourceDisplay 
        evidence={mockEvidenceSpan} 
        showFull={true}
        onSourceClick={mockOnSourceClick}
      />
    );
    
    const sourceButton = screen.getByRole('button');
    expect(sourceButton).toBeInTheDocument();
  });

  it('timestamp elements have proper cursor styling for tooltips', () => {
    render(<SourceDisplay evidence={mockEvidenceSpan} showFull={true} />);
    
    // Look for timestamp element with cursor-help class
    const timestampElement = screen.getByText(expect.stringMatching(/ago|Yesterday|Today/));
    expect(timestampElement).toHaveClass('cursor-help');
  });
});

describe('Error Handling', () => {
  it('handles invalid URLs gracefully', () => {
    const invalidUrlEvidence = {
      ...mockEvidenceSpan,
      url: 'not-a-valid-url'
    };

    render(<DomainBadge url="not-a-valid-url" />);
    
    // Should fall back to showing the invalid URL as-is
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
  });

  it('handles invalid timestamps gracefully', () => {
    render(<TimestampDisplay timestamp="invalid-date" />);
    
    expect(screen.getByText('Invalid date')).toBeInTheDocument();
  });

  it('renders without crashing when evidence is minimal', () => {
    const minimalEvidence: EvidenceSpan = {
      doc_id: 'test',
      text: 'Test',
      start_offset: 0,
      end_offset: 4,
      confidence: 0,
      quality: EvidenceQuality.UNCERTAIN
    };

    render(<SourceDisplay evidence={minimalEvidence} />);
    
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
