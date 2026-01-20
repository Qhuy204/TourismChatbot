/**
 * SessionSidebar - UI for managing chat sessions
 * 
 * Features:
 * - List all sessions with pinned first
 * - Create new session
 * - Rename, pin, delete actions
 * - Settings with memory share toggle
 */
import { useState } from 'react';
import { useSessionManager, ChatSession } from '@/hooks/useSessionManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Plus,
    Pin,
    PinOff,
    Trash2,
    Edit2,
    Check,
    X,
    MessageSquare,
    Settings,
    ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionSidebarProps {
    onSessionChange: (sessionId: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export function SessionSidebar({ onSessionChange, isOpen, onClose }: SessionSidebarProps) {
    const {
        sessions,
        activeSessionId,
        memoryShareEnabled,
        createSession,
        deleteSession,
        renameSession,
        togglePin,
        setActiveSession,
        toggleMemoryShare,
    } = useSessionManager();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    const handleCreateSession = () => {
        const newId = createSession();
        onSessionChange(newId);
    };

    const handleSelectSession = (session: ChatSession) => {
        setActiveSession(session.id);
        onSessionChange(session.id);
    };

    const handleStartRename = (session: ChatSession) => {
        setEditingId(session.id);
        setEditName(session.name);
    };

    const handleSaveRename = () => {
        if (editingId && editName.trim()) {
            renameSession(editingId, editName.trim());
        }
        setEditingId(null);
        setEditName('');
    };

    const handleCancelRename = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleDelete = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Xóa cuộc trò chuyện này?')) {
            deleteSession(sessionId);
            if (sessions.length > 1) {
                const nextSession = sessions.find(s => s.id !== sessionId);
                if (nextSession) onSessionChange(nextSession.id);
            }
        }
    };

    const handleTogglePin = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        togglePin(sessionId);
    };

    if (!isOpen) return null;

    return (
        <div className="w-72 h-full bg-background border-r flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-lg">Lịch sử chat</h2>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSettings(!showSettings)}
                        className="h-8 w-8"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="p-4 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="memory-share" className="text-sm font-medium">
                                Chia sẻ bộ nhớ
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Cho phép bot nhớ thói quen của bạn
                            </p>
                        </div>
                        <Switch
                            id="memory-share"
                            checked={memoryShareEnabled}
                            onCheckedChange={toggleMemoryShare}
                        />
                    </div>
                </div>
            )}

            {/* New Chat Button */}
            <div className="p-3 border-b">
                <Button
                    onClick={handleCreateSession}
                    className="w-full gap-2"
                    variant="outline"
                >
                    <Plus className="h-4 w-4" />
                    Cuộc trò chuyện mới
                </Button>
            </div>

            {/* Sessions List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            Chưa có cuộc trò chuyện nào
                        </p>
                    ) : (
                        sessions.map(session => (
                            <div
                                key={session.id}
                                onClick={() => handleSelectSession(session)}
                                className={cn(
                                    "group p-3 rounded-lg cursor-pointer transition-colors",
                                    "hover:bg-muted",
                                    activeSessionId === session.id && "bg-primary/10 border border-primary/20"
                                )}
                            >
                                {editingId === session.id ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveRename();
                                                if (e.key === 'Escape') handleCancelRename();
                                            }}
                                            className="h-7 text-sm"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveRename();
                                            }}
                                        >
                                            <Check className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCancelRename();
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm font-medium truncate">
                                                    {session.name}
                                                </span>
                                                {session.isPinned && (
                                                    <Pin className="h-3 w-3 text-primary shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartRename(session);
                                                    }}
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6"
                                                    onClick={(e) => handleTogglePin(session.id, e)}
                                                >
                                                    {session.isPinned ? (
                                                        <PinOff className="h-3 w-3" />
                                                    ) : (
                                                        <Pin className="h-3 w-3" />
                                                    )}
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 text-destructive"
                                                    onClick={(e) => handleDelete(session.id, e)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        {session.preview && (
                                            <p className="text-xs text-muted-foreground mt-1 truncate pl-6">
                                                {session.preview}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-muted-foreground/60 mt-1 pl-6">
                                            {session.messageCount} tin nhắn
                                        </p>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
