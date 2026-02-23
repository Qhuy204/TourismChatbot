import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  variant = 'default' 
}: StatsCardProps) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary/10 border-primary/20',
    success: 'bg-accent border-accent-foreground/20',
    warning: 'bg-chart-4/10 border-chart-4/20',
    destructive: 'bg-destructive/10 border-destructive/20',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-accent-foreground',
    warning: 'text-chart-4',
    destructive: 'text-destructive',
  };

  return (
    <Card className={cn('transition-all hover:shadow-md', variantStyles[variant])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </div>
          <div className={cn('p-3 rounded-lg bg-background/50', iconStyles[variant])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
