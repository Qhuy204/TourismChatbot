import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Image,
  Volume2,
  MapPin,
  Tag
} from 'lucide-react';
import { DatasetRecord, Scenario } from '@/types/dataset';
import { RecordDetailModal } from './RecordDetailModal';

interface DataBrowserProps {
  records: DatasetRecord[];
  onRecordUpdate?: (record: DatasetRecord) => void;
}

const ITEMS_PER_PAGE = 12;

export function DataBrowser({ records, onRecordUpdate }: DataBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scenarioFilter, setScenarioFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<DatasetRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchesSearch = 
        record.record_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.location.city.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesScenario = scenarioFilter === 'all' || 
        record.qa_items.some(qa => qa.scenario === scenarioFilter);

      return matchesSearch && matchesStatus && matchesScenario;
    });
  }, [records, searchQuery, statusFilter, scenarioFilter]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-accent text-accent-foreground';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      case 'reviewed': return 'bg-chart-3/10 text-chart-3';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Data Browser</h2>
        <p className="text-muted-foreground">Duyệt và quản lý dataset theo path và metadata</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm theo ID, tên, địa điểm..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scenarioFilter} onValueChange={(v) => { setScenarioFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả scenarios</SelectItem>
                <SelectItem value="text_ask_image">Text → Image</SelectItem>
                <SelectItem value="audio_ask_image">Audio → Image</SelectItem>
                <SelectItem value="text_ask_audio">Text → Audio</SelectItem>
                <SelectItem value="audio_ask_audio">Audio → Audio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Hiển thị {paginatedRecords.length} / {filteredRecords.length} records
          </div>
        </CardContent>
      </Card>

      {/* Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginatedRecords.map((record) => (
          <Card 
            key={record.record_id} 
            className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
            onClick={() => setSelectedRecord(record)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium line-clamp-1">
                    {record.metadata.entity_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {record.record_id}
                  </p>
                </div>
                <Badge className={getStatusColor(record.status)}>
                  {record.status || 'pending'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{record.metadata.location.city}, {record.metadata.location.district}</span>
                </div>

                <div className="flex gap-2">
                  {record.assets.image_path && (
                    <div className="flex items-center gap-1 text-xs bg-chart-1/10 text-chart-1 px-2 py-1 rounded">
                      <Image className="h-3 w-3" />
                      Image
                    </div>
                  )}
                  {record.assets.audio_evidence && (
                    <div className="flex items-center gap-1 text-xs bg-chart-3/10 text-chart-3 px-2 py-1 rounded">
                      <Volume2 className="h-3 w-3" />
                      Audio
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {record.metadata.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  {record.qa_items.length} QA items
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Trang {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onUpdate={onRecordUpdate}
      />
    </div>
  );
}
