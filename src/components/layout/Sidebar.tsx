import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Database, 
  Tags, 
  FolderOpen,
  Shuffle,
  Download,
  LogOut,
  Upload,
  Globe,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'browser', label: 'Data Browser', icon: FolderOpen },
  { id: 'annotate', label: 'Annotate', icon: Tags },
  { id: 'random-check', label: 'QA Check (10%)', icon: Shuffle },
  { id: 'import', label: 'Import Data', icon: Upload },
  { id: 'crawl', label: 'Crawl Data', icon: Globe },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col shrink-0 sticky top-0">
      <div className="p-6 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          SVLM Dataset
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Data Annotation Platform</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        ))}
      </nav>

      <div className="p-4 border-t border-border bg-card shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 h-11 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
