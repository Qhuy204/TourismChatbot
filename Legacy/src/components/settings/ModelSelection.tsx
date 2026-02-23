import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Cpu, Volume2, RefreshCw, Search, BarChart3, Zap, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = 'http://localhost:3001';

// Gemini rate limits per model
const MODEL_RATE_LIMITS: Record<string, { rpm: number; tpm: number; rpd: number; category: string }> = {
  "gemini-2.5-flash": { rpm: 1000, tpm: 1000000, rpd: 10000, category: "Text-out models" },
  "gemini-2.5-pro": { rpm: 150, tpm: 2000000, rpd: 10000, category: "Text-out models" },
  "gemini-2.5-flash-lite": { rpm: 4000, tpm: 4000000, rpd: -1, category: "Text-out models" },
  "gemini-2.0-flash": { rpm: 2000, tpm: 4000000, rpd: -1, category: "Text-out models" },
  "gemini-2.0-flash-lite": { rpm: 4000, tpm: 4000000, rpd: -1, category: "Text-out models" },
  "gemini-2.0-flash-exp": { rpm: 10, tpm: 250000, rpd: 500, category: "Text-out models" },
  "gemini-3-flash": { rpm: 1000, tpm: 1000000, rpd: 10000, category: "Text-out models" },
  "gemini-3-pro": { rpm: 25, tpm: 1000000, rpd: 250, category: "Text-out models" },
  "gemini-3-pro-image": { rpm: 20, tpm: 100000, rpd: 250, category: "Multi-modal generative models" },
  "gemini-2.5-flash-preview-image": { rpm: 500, tpm: 500000, rpd: 2000, category: "Multi-modal generative models" },
  "gemini-2.5-flash-image": { rpm: 500, tpm: 500000, rpd: 2000, category: "Multi-modal generative models" },
  "gemini-2.5-flash-tts": { rpm: 10, tpm: 10000, rpd: 100, category: "Multi-modal generative models" },
  "gemini-2.5-pro-tts": { rpm: 10, tpm: 10000, rpd: 50, category: "Multi-modal generative models" },
  "computer-use-preview": { rpm: 150, tpm: 2000000, rpd: 10000, category: "Other models" },
  "deep-research-pro-preview": { rpm: 1, tpm: 500000, rpd: 1440, category: "Agents" },
  "gemini-robotics-er-1.5-preview": { rpm: 1000, tpm: 2000000, rpd: 14400, category: "Other models" },
  "gemma-3-1b": { rpm: 30, tpm: 15000, rpd: 14400, category: "Other models" },
  "gemma-3-4b": { rpm: 30, tpm: 15000, rpd: 14400, category: "Other models" },
  "gemma-3-12b": { rpm: 30, tpm: 15000, rpd: 14400, category: "Other models" },
  "gemma-3-27b": { rpm: 30, tpm: 15000, rpd: 14400, category: "Other models" },
  "imagen-4.0-fast-generate": { rpm: 10, tpm: -1, rpd: 70, category: "Multi-modal generative models" },
  "imagen-4.0-generate": { rpm: 10, tpm: -1, rpd: 70, category: "Multi-modal generative models" },
  "imagen-4.0-ultra-generate": { rpm: 5, tpm: -1, rpd: 30, category: "Multi-modal generative models" },
  "veo-3.0-fast-generate": { rpm: 2, tpm: -1, rpd: 10, category: "Multi-modal generative models" },
  "veo-3.0-generate": { rpm: 2, tpm: -1, rpd: 10, category: "Multi-modal generative models" },
  "embedding-001": { rpm: 3000, tpm: 1000000, rpd: -1, category: "Other models" },
  "gemini-embedding-1.0": { rpm: 3000, tpm: 1000000, rpd: -1, category: "Other models" },
  "gemini-2.5-flash-native-audio-dialog": { rpm: -1, tpm: 1000000, rpd: -1, category: "Live API" },
};

interface GeminiModel {
  name: string;
  display_name?: string;
  description?: string;
  input_token_limit?: number;
  output_token_limit?: number;
  category: string;
  rpm_limit: number;
  tpm_limit: number;
  rpd_limit: number;
  rpm_used: number;
  tpm_used: number;
  rpd_used: number;
}

export function ModelSelection() {
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [apiConnected, setApiConnected] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);

    try {
      // Try to get from API
      const geminiKey = localStorage.getItem('GEMINI_API_KEY');
      const url = geminiKey
        ? `${API_BASE_URL}/models/gemini?api_key=${encodeURIComponent(geminiKey)}`
        : `${API_BASE_URL}/models/gemini`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApiConnected(true);

        if (data.models && data.models.length > 0) {
          // Map API response fields to frontend expected fields
          const mappedModels = data.models.map((m: any) => ({
            name: m.name,
            category: m.category || 'Other',
            rpm_limit: m.rpm ?? m.rpm_limit ?? 0,
            tpm_limit: m.tpm ?? m.tpm_limit ?? 0,
            rpd_limit: m.rpd ?? m.rpd_limit ?? 0,
            rpm_used: m.rpm_used ?? 0,
            tpm_used: m.tpm_used ?? 0,
            rpd_used: m.rpd_used ?? 0
          }));
          setModels(mappedModels);
        } else {
          // Fallback to static list
          setModels(Object.entries(MODEL_RATE_LIMITS).map(([name, limits]) => ({
            name,
            category: limits.category,
            rpm_limit: limits.rpm,
            tpm_limit: limits.tpm,
            rpd_limit: limits.rpd,
            rpm_used: 0,
            tpm_used: 0,
            rpd_used: 0
          })));
        }
      } else {
        throw new Error('API error');
      }
    } catch {
      setApiConnected(false);
      // Use static list
      setModels(Object.entries(MODEL_RATE_LIMITS).map(([name, limits]) => ({
        name,
        category: limits.category,
        rpm_limit: limits.rpm,
        tpm_limit: limits.tpm,
        rpd_limit: limits.rpd,
        rpm_used: 0,
        tpm_used: 0,
        rpd_used: 0
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const categories = ['all', ...new Set(models.map(m => m.category))];

  const filteredModels = models.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatNumber = (n: number) => {
    if (n === -1) return 'Unlimited';
    if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  const getUsagePercent = (used: number, limit: number) => {
    if (limit === -1 || limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gemini Models with Rate Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Gemini Models
                <Badge variant="secondary">{filteredModels.length} models</Badge>
              </CardTitle>
              <CardDescription>
                Rate limits per model (RPM: Requests/Minute, TPM: Tokens/Minute, RPD: Requests/Day)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={apiConnected ? 'outline' : 'secondary'} className={apiConnected ? 'text-green-600 border-green-600' : ''}>
                {apiConnected ? 'Server Online' : 'Server Offline'}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchModels}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Models Table */}
          <ScrollArea className="h-[500px] rounded border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[250px]">Model</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3" />
                      RPM
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      TPM
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      RPD
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model) => {
                  const rpmPercent = getUsagePercent(model.rpm_used, model.rpm_limit);
                  const tpmPercent = getUsagePercent(model.tpm_used, model.tpm_limit);
                  const rpdPercent = getUsagePercent(model.rpd_used, model.rpd_limit);

                  return (
                    <TableRow key={model.name}>
                      <TableCell>
                        <div>
                          <p className="font-medium font-mono text-sm">{model.name}</p>
                          {model.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[230px]">
                              {model.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {model.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className={`text-sm font-medium ${getUsageColor(rpmPercent)}`}>
                            {model.rpm_used} / {formatNumber(model.rpm_limit)}
                          </div>
                          <Progress value={rpmPercent} className="h-1 mt-1" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className={`text-sm font-medium ${getUsageColor(tpmPercent)}`}>
                            {model.tpm_limit === -1 ? 'N/A' : `${formatNumber(model.tpm_used)} / ${formatNumber(model.tpm_limit)}`}
                          </div>
                          {model.tpm_limit !== -1 && (
                            <Progress value={tpmPercent} className="h-1 mt-1" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className={`text-sm font-medium ${getUsageColor(rpdPercent)}`}>
                            {model.rpd_limit === -1 ? 'Unlimited' : `${model.rpd_used} / ${formatNumber(model.rpd_limit)}`}
                          </div>
                          {model.rpd_limit !== -1 && (
                            <Progress value={rpdPercent} className="h-1 mt-1" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* TTS Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Text-to-Speech Models
          </CardTitle>
          <CardDescription>
            Gemini TTS và các model audio generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['gemini-2.5-flash-tts', 'gemini-2.5-pro-tts', 'gemini-2.5-flash-native-audio-dialog'].map(name => {
              const limits = MODEL_RATE_LIMITS[name];
              if (!limits) return null;
              return (
                <div key={name} className="p-4 rounded-lg border">
                  <p className="font-medium font-mono text-sm">{name}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>RPM: {formatNumber(limits.rpm)}</span>
                    <span>TPM: {formatNumber(limits.tpm)}</span>
                    <span>RPD: {formatNumber(limits.rpd)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
