import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Database, 
  Tags, 
  CheckCircle, 
  Download, 
  Settings,
  FolderOpen,
  Shuffle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'browser', label: 'Data Browser', icon: FolderOpen },
  { id: 'annotate', label: 'Annotate', icon: Tags },
  { id: 'random-check', label: 'QA Check (10%)', icon: Shuffle },
  { id: 'crawl', label: 'Crawl Data', icon: Download },
  { id: 'export', label: 'Export', icon: Database },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          SVLM Dataset
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Data Annotation Platform</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={currentView === item.id ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start gap-3 h-11',
              currentView === item.id && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onViewChange(item.id)}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start gap-3 h-11">
          <Settings className="h-5 w-5" />
          Settings
        </Button>
      </div>
    </aside>
  );
}
