import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLangGraphChat, ChatMessage, SuggestionItem } from '@/hooks/useLangGraphChat';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useEventTracking } from '@/hooks/useEventTracking';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/use-toast';
import { InlineFileUpload, UploadedFile } from '@/components/chatbot/FileUpload';
import { SessionSidebar } from '@/components/chatbot/SessionSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Bot,
    Send,
    Loader2,
    ThumbsUp,
    ThumbsDown,
    Sparkles,
    User,
    ArrowDown,
    X,
    FileImage,
    RefreshCw,
    PanelLeftOpen,
    PanelLeftClose,
    Cpu,
    Zap,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function ChatbotInterface() {
    // Session Management
    const sessionManager = useSessionManager();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Ensure there's always an active session
    useEffect(() => {
        const initSession = async () => {
            if (!sessionManager.activeSessionId && sessionManager.sessions.length === 0 && !sessionManager.isLoading) {
                await sessionManager.createSession();
            }
        };
        initSession();
    }, [sessionManager]);

    const {
        messages,
        isLoading,
        sendMessage,
        clearMessages,
        updateFeedback,
        suggestions,
        refreshSuggestions,
        error,
        switchSession,
        fetchInitialSuggestions,
        initialData,
        modelMode,
        setModelMode,
        preferences
    } = useLangGraphChat(sessionManager.activeSessionId || undefined);
    const { trackPageView, trackChatMessage } = useEventTracking();
    const { setEmotion } = useTheme();
    const { toast } = useToast();

    const [input, setInput] = useState('');
    const [attachment, setAttachment] = useState<UploadedFile | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync theme emotion with latest bot response
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.emotion && !lastMessage.isLoading) {
            setEmotion(lastMessage.emotion as any);
        }
    }, [messages, setEmotion]);

    // Track page view on mount
    useEffect(() => {
        trackPageView('chatbot');
    }, [trackPageView]);

    // Fetch initial suggestions only ONCE per session
    const fetchedSessionRef = useRef<string | null>(null);
    useEffect(() => {
        const sessionId = sessionManager.activeSessionId;
        if (
            sessionId &&
            messages.length === 0 &&
            !isLoading &&
            fetchedSessionRef.current !== sessionId
        ) {
            fetchedSessionRef.current = sessionId;
            fetchInitialSuggestions(preferences?.askedTopics);
        }
    }, [sessionManager.activeSessionId, messages.length, isLoading, fetchInitialSuggestions, preferences?.askedTopics]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Notify user on model switch
    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        const modelName = modelMode === 'gemini' ? 'Gemini 3.0 Flash' : 'Qwen3 VL 8B';
        console.log(`🔄 Model switched to: ${modelName}`);
        toast({
            title: "Đã chuyển đổi mô hình",
            description: `Hiện đang sử dụng: ${modelName}`,
            duration: 3000,
        });
    }, [modelMode, toast]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !attachment) || isLoading) return;

        const currentSid = sessionManager.activeSessionId;
        if (!currentSid) return;

        const message = input.trim();
        setInput('');
        setAttachment(null);
        trackChatMessage('user', message);

        await sendMessage(
            message,
            attachment ? [{
                url: attachment.url,
                type: attachment.mimeType,
                name: attachment.name,
            }] : undefined,
            sessionManager.memoryShareEnabled,
            (newTitle) => sessionManager.renameSession(currentSid, newTitle)
        );
    };

    const handleFileUpload = (file: UploadedFile) => {
        setAttachment(file);
    };

    const removeAttachment = () => {
        setAttachment(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const reader = new FileReader();
                reader.onload = () => {
                    const base64Url = reader.result as string;
                    setAttachment({
                        url: base64Url,
                        type: 'image',
                        name: `pasted-image-${Date.now()}.png`,
                        size: file.size,
                        mimeType: file.type,
                    });
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    }, []);

    const handleFeedback = (messageId: string, score: number) => {
        updateFeedback(messageId, score);
    };

    const handleSuggestionClick = (text: string) => {
        trackChatMessage('user', `(suggestion) ${text}`);
        sendMessage(
            text,
            undefined,
            sessionManager.memoryShareEnabled,
            (newTitle) => sessionManager.renameSession(sessionManager.activeSessionId!, newTitle)
        );
    };

    // Handle session switch
    const handleSessionChange = (sessionId: string) => {
        switchSession(sessionId);
        sessionManager.setActiveSession(sessionId);
    };

    // Update session metadata when messages change
    useEffect(() => {
        if (sessionManager.activeSessionId && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const preview = lastMessage?.content?.slice(0, 50) || '';
            sessionManager.updateSessionMeta(
                sessionManager.activeSessionId,
                messages.length,
                preview
            );
        }
    }, [messages, sessionManager]);

    return (
        <div className="h-full flex">
            {/* Session Sidebar */}
            <SessionSidebar
                onSessionChange={handleSessionChange}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {!sidebarOpen && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(true)}
                                className="h-9 w-9"
                            >
                                <PanelLeftOpen className="h-5 w-5" />
                            </Button>
                        )}
                        <div>
                            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <Sparkles className="h-6 w-6 text-primary" />
                                Trợ lý Du lịch AI
                            </h2>
                            <p className="text-muted-foreground">
                                Hỏi đáp về địa điểm du lịch Việt Nam
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border">
                            <Label htmlFor="model-mode" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                                {modelMode === 'gemini' ? (
                                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                ) : (
                                    <Cpu className="h-3.5 w-3.5 text-blue-500" />
                                )}
                                <span className={cn(modelMode === 'gemini' ? "text-foreground" : "text-muted-foreground")}>Gemini</span>
                            </Label>
                            <Switch
                                id="model-mode"
                                checked={modelMode === 'qwen'}
                                onCheckedChange={(checked) => setModelMode(checked ? 'qwen' : 'gemini')}
                                className="scale-75"
                            />
                            <Label htmlFor="model-mode" className={cn(
                                "text-xs font-medium cursor-pointer",
                                modelMode === 'qwen' ? "text-foreground" : "text-muted-foreground"
                            )}>
                                Qwen3
                            </Label>
                        </div>
                        {messages.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearMessages}
                                className="text-muted-foreground hover:text-primary"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Hội thoại mới
                            </Button>
                        )}
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Chat Container */}
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                        {/* Messages Area */}
                        <ScrollArea
                            className="flex-1 p-4 relative"
                            onScrollCapture={handleScroll}
                        >
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                        <Bot className="h-8 w-8 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">
                                        {initialData?.welcome_message || "Ê, cuối tuần này đi đâu chưa?"}
                                    </h3>
                                    <p className="text-muted-foreground max-w-md mb-6">
                                        Tôi có thể giúp bạn lên kế hoạch du lịch, tìm địa điểm, hoặc gợi ý ẩm thực!
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {/* Instant suggestions - AI upgrades in background */}
                                        {(suggestions.length > 0 ? suggestions : (() => {
                                            // Instant client-side fallback based on cookie topics - more natural
                                            const topics = preferences?.askedTopics || [];
                                            if (topics.length > 0) {
                                                const t = topics[0];
                                                return [
                                                    { text: `Du lịch ${t} mấy ngày hợp lý`, category: 'schedule' },
                                                    { text: `Đặc sản ${t} phải thử`, category: 'food' },
                                                    { text: `Đi ${t} mùa nào đẹp nhất`, category: 'weather' },
                                                    { text: `Chỗ ở ${t} nên chọn đâu`, category: 'stay' }
                                                ];
                                            }
                                            return [
                                                { text: 'Địa điểm hot cuối tuần này', category: 'trending' },
                                                { text: 'Gợi ý biển đẹp gần Sài Gòn', category: 'discovery' },
                                                { text: 'Lịch trình Đà Nẵng 3 ngày', category: 'itinerary' },
                                                { text: 'Phố ẩm thực đường phố Hà Nội', category: 'food' }
                                            ];
                                        })()).slice(0, 5).map((s) => {
                                            const text = typeof s === 'string' ? s : s.text;
                                            return (
                                                <Button
                                                    key={text}
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-full"
                                                    onClick={() => handleSuggestionClick(text)}
                                                >
                                                    {text}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((msg) => (
                                        <MessageBubble
                                            key={msg.id}
                                            message={msg}
                                            onFeedback={handleFeedback}
                                        />
                                    ))}
                                    <div ref={scrollRef} />
                                </div>
                            )}
                        </ScrollArea>

                        {/* Scroll to Bottom Button */}
                        {showScrollButton && (
                            <Button
                                size="icon"
                                variant="secondary"
                                className="absolute bottom-40 right-8 h-8 w-8 rounded-full shadow-md z-10"
                                onClick={scrollToBottom}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Suggestions Bar */}
                        {suggestions.length > 0 && messages.length > 0 && (
                            <div className="px-4 py-2 border-t border-border bg-muted/30">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">Gợi ý:</span>
                                    {suggestions.slice(0, 3).map((s, i) => (
                                        <Button
                                            key={i}
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs rounded-full bg-background hover:bg-primary/10"
                                            onClick={() => handleSuggestionClick(s.text)}
                                        >
                                            {s.text}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={async () => {
                                            setIsRefreshingSuggestions(true);
                                            await refreshSuggestions();
                                            setIsRefreshingSuggestions(false);
                                        }}
                                        disabled={isRefreshingSuggestions}
                                        title="Đổi gợi ý"
                                    >
                                        <RefreshCw className={`h-3 w-3 ${isRefreshingSuggestions ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-4 border-t border-border bg-background">
                            {/* Attachment Preview */}
                            {attachment && (
                                <div className="mb-2 p-2 bg-muted/50 rounded-lg flex items-center gap-2">
                                    {attachment.type === 'image' ? (
                                        <img
                                            src={attachment.url}
                                            alt="Preview"
                                            className="w-12 h-12 object-cover rounded"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                                            <FileImage className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(attachment.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={removeAttachment}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <InlineFileUpload
                                    onUpload={handleFileUpload}
                                    disabled={isLoading || !!attachment}
                                />
                                <Textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    placeholder={attachment ? "Mô tả file đính kèm..." : "Nhập câu hỏi của bạn..."}
                                    className="min-h-[44px] max-h-32 resize-none"
                                    disabled={isLoading}
                                    rows={1}
                                />
                                <Button
                                    type="submit"
                                    disabled={(!input.trim() && !attachment) || isLoading}
                                    className="shrink-0"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Message Bubble Component
function MessageBubble({
    message,
    onFeedback
}: {
    message: ChatMessage;
    onFeedback: (id: string, score: number) => void;
}) {
    const isUser = message.role === 'user';

    return (
        <div className={cn(
            "flex gap-3",
            isUser ? "flex-row-reverse" : "flex-row"
        )}>
            <Avatar className={cn(
                "h-8 w-8 shrink-0",
                isUser ? "bg-primary" : "bg-primary/10"
            )}>
                <AvatarFallback className={cn(
                    isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                )}>
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </AvatarFallback>
            </Avatar>

            <div className={cn(
                "flex flex-col max-w-[80%]",
                isUser ? "items-end" : "items-start"
            )}>
                {/* Attachments */}
                {isUser && message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2 justify-end">
                        {message.attachments.map((att, idx) => (
                            <div key={idx} className="relative">
                                {att.type.startsWith('image/') ? (
                                    <img
                                        src={att.url}
                                        alt={att.name}
                                        className="rounded-lg max-w-[200px] max-h-[150px] object-cover border-2 border-primary/30 shadow-sm"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/20 rounded-lg text-sm">
                                        <FileImage className="h-4 w-4" />
                                        <span className="truncate max-w-[150px]">{att.name}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className={cn(
                    "rounded-2xl px-4 py-3",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-white border border-gray-200 shadow-sm rounded-tl-sm"
                )}>
                    {message.isLoading ? (
                        <div className="flex items-center gap-2 py-1">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Đang suy nghĩ...</span>
                        </div>
                    ) : (
                        <div className={cn(
                            "text-sm prose prose-sm max-w-none",
                            !isUser && "text-gray-800",
                            "[&>p]:mb-2 [&>ul]:mb-2 [&>ul]:pl-4 [&>ul>li]:mb-1 [&>*:last-child]:mb-0"
                        )}>
                            {isUser ? (
                                message.content
                            ) : (
                                <ReactMarkdown
                                    components={{
                                        img: ({ src, alt }) => (
                                            <img
                                                src={src}
                                                alt={alt || 'Hình ảnh'}
                                                className="rounded-lg max-w-full h-auto my-2 border border-gray-200 shadow-sm"
                                                style={{ maxHeight: '300px', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ),
                                        a: ({ href, children }) => (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                {children}
                                            </a>
                                        ),
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            )}
                        </div>
                    )}
                </div>

                {/* Feedback & Metadata */}
                {!isUser && !message.isLoading && (
                    <div className="flex items-center gap-1 mt-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6",
                                message.feedbackScore === 1 && "text-primary bg-primary/10"
                            )}
                            onClick={() => onFeedback(message.id, 1)}
                        >
                            <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-6 w-6",
                                message.feedbackScore === -1 && "text-destructive bg-destructive/10"
                            )}
                            onClick={() => onFeedback(message.id, -1)}
                        >
                            <ThumbsDown className="h-3 w-3" />
                        </Button>
                        {message.emotion && (
                            <span className="text-xs text-muted-foreground ml-2">
                                {message.emotion}
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">
                            {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                )}

                {isUser && (
                    <span className="text-xs text-muted-foreground mt-1">
                        {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                )}
            </div>
        </div>
    );
}
