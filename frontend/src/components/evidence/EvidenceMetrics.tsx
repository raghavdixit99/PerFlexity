/**
 * Evidence Metrics Component
 * 
 * Displays CVA processing metrics and statistics in both
 * compact and detailed formats.
 */

import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  BarChart3,
  Target,
  TrendingUp
} from 'lucide-react';

// UI Components
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Types
import { CVAMetrics as CVAMetricsType } from '../../types/cva';

interface EvidenceMetricsProps {
  metrics?: CVAMetricsType;
  compact?: boolean;
  showProcessingTime?: boolean;
  className?: string;
}

/**
 * Compact Metrics Display (for headers and small spaces)
 */
function CompactMetrics({ 
  metrics, 
  showProcessingTime = true,
  className 
}: {
  metrics?: CVAMetricsType;
  showProcessingTime?: boolean;
  className?: string;
}) {
  if (!metrics) return null;

  const verifiedPercentage = metrics.total_claims > 0 
    ? Math.round((metrics.verified_claims / metrics.total_claims) * 100)
    : 0;

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <Badge variant="outline">
        {metrics.total_claims} claims
      </Badge>
      
      <Badge variant={verifiedPercentage >= 80 ? "default" : verifiedPercentage >= 60 ? "secondary" : "destructive"}>
        {verifiedPercentage}% verified
      </Badge>
      
      {metrics.conflicted_claims > 0 && (
        <Badge variant="destructive">
          {metrics.conflicted_claims} conflicts
        </Badge>
      )}
      
      {metrics.uncertain_claims > 0 && (
        <Badge variant="outline" className="text-yellow-600">
          {metrics.uncertain_claims} uncertain
        </Badge>
      )}
      
      {showProcessingTime && (
        <span className="text-muted-foreground">
          <Clock className="w-3 h-3 inline mr-1" />
          {Math.round(metrics.processing_time_ms)}ms
        </span>
      )}
    </div>
  );
}

/**
 * Detailed Metrics Display (for full panels)
 */
function DetailedMetrics({ 
  metrics,
  className 
}: {
  metrics?: CVAMetricsType;
  className?: string;
}) {
  if (!metrics) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No metrics available</p>
      </div>
    );
  }

  const verifiedPercentage = metrics.total_claims > 0 
    ? (metrics.verified_claims / metrics.total_claims) * 100
    : 0;
    
  const conflictPercentage = metrics.total_claims > 0
    ? (metrics.conflicted_claims / metrics.total_claims) * 100
    : 0;
    
  const uncertainPercentage = metrics.total_claims > 0
    ? (metrics.uncertain_claims / metrics.total_claims) * 100
    : 0;

  // Performance rating based on processing time
  const getPerformanceRating = (ms: number) => {
    if (ms <= 200) return { rating: 'Excellent', color: 'text-green-600' };
    if (ms <= 400) return { rating: 'Good', color: 'text-blue-600' };
    if (ms <= 800) return { rating: 'Fair', color: 'text-yellow-600' };
    return { rating: 'Slow', color: 'text-red-600' };
  };

  const performance = getPerformanceRating(metrics.processing_time_ms);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <div className="text-lg font-semibold">{metrics.verified_claims}</div>
              <div className="text-xs text-muted-foreground">Verified</div>
            </div>
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <div className="text-lg font-semibold">{metrics.conflicted_claims}</div>
              <div className="text-xs text-muted-foreground">Conflicts</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Verification Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Verification Rate</span>
          <span className="font-medium">{Math.round(verifiedPercentage)}%</span>
        </div>
        <Progress value={verifiedPercentage} className="h-2" />
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Claim Analysis</h4>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Verified Claims</span>
            </div>
            <Badge variant="default">{metrics.verified_claims}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Conflicted Claims</span>
            </div>
            <Badge variant="destructive">{metrics.conflicted_claims}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-yellow-600" />
              <span>Uncertain Claims</span>
            </div>
            <Badge variant="outline" className="text-yellow-600">
              {metrics.uncertain_claims}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Performance Metrics */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Performance
        </h4>
        
        <div className="flex items-center justify-between text-sm">
          <span>Processing Time</span>
          <div className="flex items-center gap-2">
            <span className={performance.color}>{performance.rating}</span>
            <Badge variant="outline">
              {Math.round(metrics.processing_time_ms)}ms
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span>Claims per Second</span>
          <Badge variant="outline">
            {metrics.processing_time_ms > 0 
              ? Math.round((metrics.total_claims / metrics.processing_time_ms) * 1000)
              : 0
            }
          </Badge>
        </div>
      </div>

      {/* Quality Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span>Overall Quality Score</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={verifiedPercentage >= 80 ? "default" : "secondary"}>
                  {Math.round(verifiedPercentage - (conflictPercentage * 0.5) - (uncertainPercentage * 0.3))}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p>Based on verification rate, conflicts, and uncertainty</p>
                  <p>Formula: Verified% - (Conflicts * 0.5) - (Uncertain * 0.3)</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

/**
 * Performance Indicator Component
 */
function PerformanceIndicator({ 
  processingTimeMs,
  size = 'sm',
  className 
}: {
  processingTimeMs: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const getIndicatorColor = (ms: number) => {
    if (ms <= 200) return 'bg-green-500';
    if (ms <= 400) return 'bg-blue-500';
    if (ms <= 800) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const indicatorSize = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 ${className}`}>
            <div className={`rounded-full ${indicatorSize} ${getIndicatorColor(processingTimeMs)}`} />
            <span className="text-xs text-muted-foreground">
              {Math.round(processingTimeMs)}ms
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>CVA Processing Time: {Math.round(processingTimeMs)}ms</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Main Evidence Metrics Component
 */
export function EvidenceMetrics({
  metrics,
  compact = false,
  showProcessingTime = true,
  className
}: EvidenceMetricsProps) {
  if (compact) {
    return (
      <CompactMetrics 
        metrics={metrics}
        showProcessingTime={showProcessingTime}
        className={className}
      />
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Evidence Analysis Metrics
          {metrics && (
            <PerformanceIndicator processingTimeMs={metrics.processing_time_ms} />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DetailedMetrics metrics={metrics} />
      </CardContent>
    </Card>
  );
}

// Export sub-components
export { CompactMetrics, DetailedMetrics, PerformanceIndicator };

export default EvidenceMetrics;
