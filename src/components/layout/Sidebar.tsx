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
  Settings,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onOpenSettings?: () => void;
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

export function Sidebar({ currentView, onViewChange, onOpenSettings }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "bg-card border-r border-border h-screen flex flex-col shrink-0 sticky top-0 transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className={cn("p-4 border-b border-border shrink-0 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                SVLM Dataset
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Data Annotation Platform</p>
            </div>
          )}
          {isCollapsed && (
            <Database className="h-6 w-6 text-primary" />
          )}
        </div>

        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border bg-background shadow-sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={currentView === item.id ? 'default' : 'ghost'}
                  className={cn(
                    'w-full h-10',
                    isCollapsed ? "justify-center px-2" : "justify-start gap-3 px-3",
                    currentView === item.id && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => onViewChange(item.id)}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </nav>

        {/* User section */}
        <div className="p-2 border-t border-border bg-card shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors",
                  isCollapsed && "justify-center"
                )}
                onClick={onOpenSettings}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p className="font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full h-10 text-muted-foreground hover:text-foreground",
                  isCollapsed ? "justify-center px-2" : "justify-start gap-3 px-3"
                )}
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>Sign Out</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
