/**
 * Conflict Indicator Component Tests
 * 
 * Test suite for conflict detection UI components.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

import { ConflictIndicator, ConflictBadge } from '../ConflictIndicator';
import { AtomicClaim, ConflictType, EvidenceQuality } from '../../../types/cva';

const mockConflictedClaim: AtomicClaim = {
  id: 'claim_1',
  text: 'Test claim with conflict',
  supported_by: [
    {
      doc_id: 'doc_1',
      text: 'Evidence text 1',
      start_offset: 0,
      end_offset: 100,
      url: 'https://source1.com',
      title: 'Source 1',
      confidence: 0.9,
      quality: EvidenceQuality.HIGH
    },
    {
      doc_id: 'doc_2', 
      text: 'Conflicting evidence text 2',
      start_offset: 50,
      end_offset: 150,
      url: 'https://source2.com',
      title: 'Source 2',
      confidence: 0.8,
      quality: EvidenceQuality.MEDIUM
    }
  ],
  conflict: true,
  conflict_type: ConflictType.VALUE_DISAGREEMENT,
  conflict_description: 'Sources provide different numerical values',
  uncertain: false,
  confidence: 0.7
};

const mockNonConflictedClaim: AtomicClaim = {
  id: 'claim_2',
  text: 'Test claim without conflict',
  supported_by: [
    {
      doc_id: 'doc_3',
      text: 'Evidence text 3',
      start_offset: 0,
      end_offset: 100,
      url: 'https://source3.com',
      title: 'Source 3',
      confidence: 0.95,
      quality: EvidenceQuality.HIGH
    }
  ],
  conflict: false,
  conflict_type: ConflictType.NONE,
  uncertain: false,
  confidence: 0.95
};

describe('ConflictBadge', () => {
  it('renders conflict badge for conflicted claims', () => {
    render(<ConflictBadge claim={mockConflictedClaim} />);
    
    expect(screen.getByText('Conflict')).toBeInTheDocument();
  });

  it('does not render for non-conflicted claims', () => {
    render(<ConflictBadge claim={mockNonConflictedClaim} />);
    
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
  });

  it('renders with correct size variants', () => {
    const { rerender } = render(<ConflictBadge claim={mockConflictedClaim} size="sm" />);
    expect(screen.getByText('Conflict')).toHaveClass('text-xs');
    
    rerender(<ConflictBadge claim={mockConflictedClaim} size="lg" />);
    expect(screen.getByText('Conflict')).toHaveClass('text-sm');
  });
});

describe('ConflictIndicator', () => {
  it('renders basic conflict indicator', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} />);
    
    expect(screen.getByText('Conflict')).toBeInTheDocument();
  });

  it('does not render for non-conflicted claims', () => {
    render(<ConflictIndicator claim={mockNonConflictedClaim} />);
    
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
  });

  it('shows tooltip with conflict details on hover', async () => {
    render(<ConflictIndicator claim={mockConflictedClaim} />);
    
    const conflictBadge = screen.getByText('Conflict');
    fireEvent.mouseOver(conflictBadge);
    
    // Tooltip should show conflict type
    expect(await screen.findByText('Value Disagreement')).toBeInTheDocument();
  });

  it('shows detailed description when enabled', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    expect(screen.getByText('Show details')).toBeInTheDocument();
  });

  it('expands details when show details is clicked', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    const showDetailsButton = screen.getByText('Show details');
    fireEvent.click(showDetailsButton);
    
    expect(screen.getByText('Hide details')).toBeInTheDocument();
    expect(screen.getByText('Value Disagreement')).toBeInTheDocument();
  });

  it('displays conflict type correctly', () => {
    const timingConflictClaim = {
      ...mockConflictedClaim,
      conflict_type: ConflictType.TIMING_DISAGREEMENT,
      conflict_description: 'Sources differ on timing'
    };

    render(<ConflictIndicator claim={timingConflictClaim} showDescription={true} />);
    
    fireEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('Timing Disagreement')).toBeInTheDocument();
  });

  it('shows resolution suggestions when details are expanded', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    fireEvent.click(screen.getByText('Show details'));
    fireEvent.click(screen.getByText('Resolution suggestions'));
    
    expect(screen.getByText('Check publication dates - prefer more recent sources')).toBeInTheDocument();
  });

  it('displays source comparison for multiple sources', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    fireEvent.click(screen.getByText('Show details'));
    
    expect(screen.getByText('Source Comparison')).toBeInTheDocument();
    expect(screen.getByText('source1.com')).toBeInTheDocument();
    expect(screen.getByText('source2.com')).toBeInTheDocument();
  });

  it('handles different conflict severity levels', () => {
    const highSeverityClaim = {
      ...mockConflictedClaim,
      conflict_type: ConflictType.CATEGORICAL_DISAGREEMENT
    };

    render(<ConflictIndicator claim={highSeverityClaim} showDescription={true} />);
    
    fireEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('high severity')).toBeInTheDocument();
  });

  it('displays conflict description when provided', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    fireEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('Sources provide different numerical values')).toBeInTheDocument();
  });
});

describe('Conflict Types', () => {
  it('renders different conflict type icons', () => {
    const conflictTypes = [
      ConflictType.VALUE_DISAGREEMENT,
      ConflictType.TIMING_DISAGREEMENT,
      ConflictType.CATEGORICAL_DISAGREEMENT,
      ConflictType.METHODOLOGY_DISAGREEMENT
    ];

    conflictTypes.forEach(conflictType => {
      const claim = {
        ...mockConflictedClaim,
        conflict_type: conflictType
      };

      const { unmount } = render(<ConflictIndicator claim={claim} />);
      expect(screen.getByText('Conflict')).toBeInTheDocument();
      unmount();
    });
  });
});

describe('Accessibility', () => {
  it('has proper ARIA labels', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    const showDetailsButton = screen.getByText('Show details');
    expect(showDetailsButton).toBeInTheDocument();
    expect(showDetailsButton.tagName).toBe('BUTTON');
  });

  it('supports keyboard navigation', () => {
    render(<ConflictIndicator claim={mockConflictedClaim} showDescription={true} />);
    
    const showDetailsButton = screen.getByText('Show details');
    showDetailsButton.focus();
    
    expect(document.activeElement).toBe(showDetailsButton);
  });
});
