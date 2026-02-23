import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressSegment {
  value: number;
  color: string;
  label: string;
}

interface UserProgressBarProps {
  userName: string;
  segments: ProgressSegment[];
  total: number;
  className?: string;
}

export function UserProgressBar({ userName, segments, total, className }: UserProgressBarProps) {
  const getPercentage = (value: number) => total > 0 ? (value / total) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{userName}</span>
        <span className="text-xs text-muted-foreground">{total} records</span>
      </div>
      
      {/* Stacked progress bar */}
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        {segments.reduce((acc, segment, index) => {
          const prevWidth = segments.slice(0, index).reduce((sum, s) => sum + getPercentage(s.value), 0);
          const width = getPercentage(segment.value);
          
          if (width > 0) {
            acc.push(
              <div
                key={segment.label}
                className="absolute h-full transition-all duration-500"
                style={{
                  left: `${prevWidth}%`,
                  width: `${width}%`,
                  backgroundColor: segment.color,
                }}
              />
            );
          }
          return acc;
        }, [] as JSX.Element[])}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-1.5">
            <div 
              className="h-2.5 w-2.5 rounded-full" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-muted-foreground">
              {segment.label}: {segment.value} ({getPercentage(segment.value).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}