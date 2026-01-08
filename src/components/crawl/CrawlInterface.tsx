import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    Play, Square, Download, Calendar, Globe, Terminal, Clock,
    CheckCircle2, Loader2, Database, Building2, UtensilsCrossed, ShoppingBag, Ticket, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { useCrawlSettings } from '@/hooks/useCrawlSettings';
import { checkApiHealth, startCrawl, stopCrawl, crawlWebSocket } from '@/lib/crawlService';

// Category definitions matching backend - using Lucide icons
const CATEGORIES = [
    { id: 'hotels', label: 'Khách sạn', Icon: Building2, maxPages: 955 },
    { id: 'restaurants', label: 'Nhà hàng', Icon: UtensilsCrossed, maxPages: 172 },
    { id: 'shops', label: 'Cửa hàng', Icon: ShoppingBag, maxPages: 46 },
    { id: 'entertainment', label: 'Giải trí', Icon: Ticket, maxPages: 25 },
    { id: 'destinations', label: 'Điểm đến', Icon: MapPin, maxPages: 65 },
];

const SCHEDULE_OPTIONS = [
    { value: 0, label: 'Tắt' },
    { value: 5, label: '5 phút' },
    { value: 10, label: '10 phút' },
    { value: 15, label: '15 phút' },
    { value: 30, label: '30 phút' },
    { value: 60, label: '1 giờ' },
    { value: 90, label: '1 giờ 30' },
    { value: 120, label: '2 giờ' },
];

interface CrawlLog {
    timestamp: string;
    level: string;
    category: string;
    message: string;
}

const API_BASE_URL = 'http://localhost:3001';

interface CrawlInterfaceProps {
    onAddRecords?: (records: any[]) => void;
}

export function CrawlInterface({ onAddRecords }: CrawlInterfaceProps) {
    const { settings, updateSettings, startScheduler, stopScheduler, toggleFeature, nextRunTime } = useCrawlSettings();

    const [apiConnected, setApiConnected] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [activeTab, setActiveTab] = useState('crawl');
    const [crawlDetails, setCrawlDetails] = useState(false);
    const [logs, setLogs] = useState<CrawlLog[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const [crawlStatus, setCrawlStatus] = useState({
        is_running: false,
        current_category: null as string | null,
        current_page: 0,
        total_pages: 0,
        items_crawled: 0,
        message: 'Ready'
    });

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Check API health
    useEffect(() => {
        const check = async () => {
            const ok = await checkApiHealth();
            setApiConnected(ok);
        };
        check();
        const interval = setInterval(check, 5000);
        return () => clearInterval(interval);
    }, []);

    // WebSocket + polling
    useEffect(() => {
        crawlWebSocket.connect();
        crawlWebSocket.onConnected(() => setWsConnected(true));
        crawlWebSocket.onDisconnected(() => setWsConnected(false));
        crawlWebSocket.onStatus((s) => setCrawlStatus(prev => ({ ...prev, ...s })));

        // Poll logs
        const poll = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.logs) setLogs(data.logs);
                    setCrawlStatus(prev => ({ ...prev, ...data }));
                }
            } catch { }
        }, 1000);

        return () => {
            clearInterval(poll);
            crawlWebSocket.disconnect();
        };
    }, []);

    const handleStartCrawl = useCallback(async () => {
        const selected = settings.selectedFeatures.filter(f => CATEGORIES.some(c => c.id === f));
        if (selected.length === 0) return toast.error('Chọn ít nhất một nguồn');
        if (!apiConnected) return toast.error('Server không khả dụng');

        try {
            setLogs([]);
            await startCrawl(selected, undefined, crawlDetails);
            toast.success('Bắt đầu crawl');
        } catch (e: any) {
            toast.error(e.message);
        }
    }, [settings.selectedFeatures, apiConnected, crawlDetails]);

    const handleStopCrawl = useCallback(async () => {
        try {
            await stopCrawl();
            toast.info('Đã dừng');
        } catch (e: any) {
            toast.error(e.message);
        }
    }, []);

    const handleToggleScheduler = useCallback(() => {
        if (settings.schedulerEnabled) {
            stopScheduler();
        } else {
            if (settings.scheduleInterval === 0) return toast.error('Chọn chu kỳ');
            startScheduler();
        }
    }, [settings.schedulerEnabled, settings.scheduleInterval, startScheduler, stopScheduler]);

    const handleDownload = () => {
        window.open(`${API_BASE_URL}/download`, '_blank');
    };

    const formatTime = (ts: string) => {
        try {
            return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch { return ts; }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Crawl Data</h2>
                    <p className="text-muted-foreground">Crawl dữ liệu từ vietnamtourism.gov.vn</p>
                </div>
                <div className="flex gap-2">
                    <Badge className={apiConnected ? 'bg-primary' : 'bg-destructive'}>
                        API {apiConnected ? 'Online' : 'Offline'}
                    </Badge>
                    <Badge className={wsConnected ? 'bg-primary' : 'bg-muted'}>
                        {wsConnected ? 'Live' : 'Offline'}
                    </Badge>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="crawl" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Crawl
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        Logs ({logs.length})
                    </TabsTrigger>
                </TabsList>

                {/* Crawl Tab */}
                <TabsContent value="crawl" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Sources */}
                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Database className="h-5 w-5 text-primary" />
                                        Nguồn dữ liệu
                                    </CardTitle>
                                    <Badge variant="outline">{settings.selectedFeatures.length}/{CATEGORIES.length}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {CATEGORIES.map((cat) => {
                                        const selected = settings.selectedFeatures.includes(cat.id);
                                        return (
                                            <div
                                                key={cat.id}
                                                onClick={() => !crawlStatus.is_running && toggleFeature(cat.id)}
                                                className={`
                          flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all
                          ${selected
                                                        ? 'border-primary bg-accent'
                                                        : 'border-border hover:border-primary/50'
                                                    }
                          ${crawlStatus.is_running ? 'opacity-60 cursor-not-allowed' : ''}
                        `}
                                            >
                                                <Checkbox checked={selected} disabled={crawlStatus.is_running} className="pointer-events-none" />
                                                <cat.Icon className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <div className="font-medium text-sm">{cat.label}</div>
                                                    <div className="text-xs text-muted-foreground">{cat.maxPages} pages</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Auto-update */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Auto-update
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Quét mỗi</Label>
                                    <Select
                                        value={String(settings.scheduleInterval)}
                                        onValueChange={(v) => updateSettings({ scheduleInterval: Number(v) })}
                                        disabled={settings.schedulerEnabled}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SCHEDULE_OPTIONS.map(o => (
                                                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    className="w-full"
                                    variant={settings.schedulerEnabled ? 'destructive' : 'default'}
                                    onClick={handleToggleScheduler}
                                    disabled={!apiConnected}
                                >
                                    <Calendar className="h-4 w-4 mr-2" />
                                    {settings.schedulerEnabled ? 'Tắt' : 'Bật'}
                                </Button>
                                {settings.schedulerEnabled && nextRunTime && (
                                    <div className="text-xs text-muted-foreground text-center pt-2">
                                        Lần tiếp: {nextRunTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Controls */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="fullData"
                                        checked={crawlDetails}
                                        onCheckedChange={(v) => setCrawlDetails(!!v)}
                                        disabled={crawlStatus.is_running}
                                    />
                                    <Label htmlFor="fullData" className="cursor-pointer">Full Data + Ảnh</Label>
                                </div>

                                {!crawlStatus.is_running ? (
                                    <Button
                                        onClick={handleStartCrawl}
                                        disabled={!apiConnected || settings.selectedFeatures.length === 0}
                                    >
                                        <Play className="h-4 w-4 mr-2" /> Bắt đầu Crawl
                                    </Button>
                                ) : (
                                    <Button variant="destructive" onClick={handleStopCrawl}>
                                        <Square className="h-4 w-4 mr-2" /> Dừng
                                    </Button>
                                )}

                                <Button variant="outline" onClick={handleDownload} disabled={crawlStatus.items_crawled === 0}>
                                    <Download className="h-4 w-4 mr-2" /> Tải về ({crawlStatus.items_crawled} items)
                                </Button>
                            </div>

                            <Separator />

                            {/* Progress */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {crawlStatus.is_running ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {crawlStatus.message}
                                            </span>
                                        ) : crawlStatus.items_crawled > 0 ? (
                                            <span className="flex items-center gap-2 text-primary">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Done! {crawlStatus.items_crawled} items
                                            </span>
                                        ) : 'Sẵn sàng'}
                                    </span>
                                    <span className="font-medium">
                                        {crawlStatus.is_running && crawlStatus.total_pages > 0
                                            ? `${crawlStatus.current_page}/${crawlStatus.total_pages} pages`
                                            : `${crawlStatus.items_crawled} items`
                                        }
                                    </span>
                                </div>
                                <Progress
                                    value={crawlStatus.is_running && crawlStatus.total_pages > 0
                                        ? (crawlStatus.current_page / crawlStatus.total_pages) * 100
                                        : (!crawlStatus.is_running && crawlStatus.items_crawled > 0 ? 100 : 0)
                                    }
                                    className="h-2"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Logs Tab */}
                <TabsContent value="logs" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Terminal className="h-5 w-5 text-primary" />
                                    Crawl Logs
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setLogs([])}>Clear</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                {logs.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Terminal className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>Chưa có logs</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {logs.map((log, i) => (
                                            <div key={i} className="flex items-center gap-4 py-2 px-3 rounded hover:bg-muted/50">
                                                <span className="text-xs text-muted-foreground w-20 shrink-0">{formatTime(log.timestamp)}</span>
                                                <Badge variant="secondary" className="shrink-0">{log.category}</Badge>
                                                <span className={`text-sm ${log.level === 'success' ? 'text-primary' :
                                                    log.level === 'error' ? 'text-destructive' :
                                                        'text-foreground'
                                                    }`}>
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))}
                                        <div ref={logsEndRef} />
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
