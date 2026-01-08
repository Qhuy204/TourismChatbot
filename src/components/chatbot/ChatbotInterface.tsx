import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChatbot, ChatMessage } from '@/hooks/useChatbot';
import { useEventTracking } from '@/hooks/useEventTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Bot,
    Send,
    Loader2,
    Trash2,
    ThumbsUp,
    ThumbsDown,
    Sparkles,
    User,
    ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChatbotInterface() {
    const {
        messages,
        isLoading,
        sendMessage,
        clearChat,
        updateFeedback,
        // Session management
        sessions,
        currentSessionId,
        currentSessionTitle,
        loadSession,
        createNewSession,
    } = useChatbot();
    const { trackPageView, trackChatMessage } = useEventTracking();

    const [input, setInput] = useState('');
    const [showScrollButton, setShowScrollButton] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Track page view on mount
    useEffect(() => {
        trackPageView('chatbot');
    }, [trackPageView]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Handle scroll events to show/hide scroll button
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Show button if user is more than 100px from bottom
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
        if (!input.trim() || isLoading) return;

        const message = input.trim();
        setInput('');
        trackChatMessage('user', message);
        await sendMessage(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleFeedback = (messageId: string, score: number) => {
        updateFeedback(messageId, score);
    };

    return (
        <div className="h-full flex gap-4 p-6">
            {/* Session List Sidebar */}
            <Card className="w-64 shrink-0 flex flex-col">
                <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Lịch sử Chat</CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={createNewSession}
                            className="h-8 px-2"
                        >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Mới
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-2 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        {sessions.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                Chưa có cuộc hội thoại nào
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {sessions.map((session) => (
                                    <button
                                        key={session.id}
                                        onClick={() => loadSession(session.id)}
                                        className={cn(
                                            "w-full text-left p-2 rounded-lg text-sm transition-colors",
                                            currentSessionId === session.id
                                                ? "bg-primary/10 text-primary"
                                                : "hover:bg-muted"
                                        )}
                                    >
                                        <div className="font-medium truncate">{session.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(session.updated_at).toLocaleDateString('vi-VN')}
                                            {' • '}
                                            {session.message_count} tin nhắn
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            {currentSessionTitle}
                        </h2>
                        <p className="text-muted-foreground">
                            Hỏi đáp về địa điểm du lịch Việt Nam - Được cá nhân hóa theo sở thích của bạn
                        </p>
                    </div>
                    {messages.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearChat}
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Hội thoại mới
                        </Button>
                    )}
                </div>

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
                                    <h3 className="text-lg font-semibold mb-2">Xin chào! 👋</h3>
                                    <p className="text-muted-foreground max-w-md mb-6">
                                        Tôi là trợ lý du lịch AI. Hãy hỏi tôi về các địa điểm du lịch Việt Nam,
                                        gợi ý lịch trình, hoặc thông tin về các điểm tham quan!
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {[
                                            'Gợi ý địa điểm du lịch biển',
                                            'Đà Nẵng có gì hay?',
                                            'Địa điểm du lịch miền Trung'
                                        ].map((suggestion) => (
                                            <Button
                                                key={suggestion}
                                                variant="outline"
                                                size="sm"
                                                className="rounded-full"
                                                onClick={() => {
                                                    setInput(suggestion);
                                                    // Small delay to allow state update before sticking
                                                    setTimeout(() => handleSubmit(), 0);
                                                }}
                                            >
                                                {suggestion}
                                            </Button>
                                        ))}
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
                                    {/* Dummy div for auto-scrolling */}
                                    <div ref={scrollRef} />
                                </div>
                            )}
                        </ScrollArea>

                        {/* Scroll to Bottom Button */}
                        {showScrollButton && (
                            <Button
                                size="icon"
                                variant="secondary"
                                className="absolute bottom-20 right-8 h-8 w-8 rounded-full shadow-md z-10 opacity-90 hover:opacity-100 transition-opacity"
                                onClick={scrollToBottom}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Input Area */}
                        <div className="p-4 border-t border-border bg-background">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Nhập câu hỏi của bạn..."
                                    className="min-h-[44px] max-h-32 resize-none"
                                    disabled={isLoading}
                                    rows={1}
                                />
                                <Button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="shrink-0"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                                Nhấn Enter để gửi, Shift+Enter để xuống dòng
                            </p>
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
                                <ReactMarkdown>{message.content}</ReactMarkdown>
                            )}
                        </div>
                    )}
                </div>

                {/* Feedback buttons for assistant messages */}
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
                        <span className="text-xs text-muted-foreground ml-2">
                            {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                )}

                {/* Timestamp for user messages */}
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
