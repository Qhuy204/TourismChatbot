import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Image,
  Volume2,
  MapPin,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  ArrowUpDown
} from 'lucide-react';
import { DatasetRecord, Scenario } from '@/types/dataset';
import { RecordDetailModal } from './RecordDetailModal';
import { toast } from 'sonner';

interface DataBrowserProps {
  records: DatasetRecord[];
  onRecordUpdate?: (record: DatasetRecord) => void;
  onRecordsUpdate?: (records: DatasetRecord[]) => void;
}

const ITEMS_PER_PAGE = 12;

type ViewMode = 'grid' | 'list';
type SortBy = 'id' | 'created' | 'updated' | 'status' | 'name';
type SortOrder = 'asc' | 'desc';

export function DataBrowser({ records, onRecordUpdate, onRecordsUpdate }: DataBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scenarioFilter, setScenarioFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<DatasetRecord | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records.filter(record => {
      const matchesSearch = 
        record.record_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.location.city.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesScenario = scenarioFilter === 'all' || 
        record.qa_items.some(qa => qa.scenario === scenarioFilter);

      return matchesSearch && matchesStatus && matchesScenario;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'id':
          comparison = a.record_id.localeCompare(b.record_id);
          break;
        case 'name':
          comparison = a.metadata.entity_name.localeCompare(b.metadata.entity_name);
          break;
        case 'created':
          comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
        case 'updated':
          comparison = (a.updatedAt || a.reviewedAt || '').localeCompare(b.updatedAt || b.reviewedAt || '');
          break;
        case 'status':
          comparison = (a.status || 'pending').localeCompare(b.status || 'pending');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [records, searchQuery, statusFilter, scenarioFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-accent text-accent-foreground';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      case 'reviewed': return 'bg-chart-3/10 text-chart-3';
      case 'warning': return 'bg-chart-4/10 text-chart-4';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRecords.map(r => r.record_id)));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'warning' | 'delete') => {
    if (selectedIds.size === 0) {
      toast.error('Chưa chọn record nào');
      return;
    }

    const updatedRecords = records.map(record => {
      if (!selectedIds.has(record.record_id)) return record;
      
      if (action === 'delete') return null;
      
      return {
        ...record,
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'warning',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as DatasetRecord;
    }).filter(Boolean) as DatasetRecord[];

    if (onRecordsUpdate) {
      onRecordsUpdate(updatedRecords);
    }

    toast.success(`Đã ${action === 'approve' ? 'phê duyệt' : action === 'reject' ? 'từ chối' : action === 'warning' ? 'đánh dấu cảnh báo' : 'xóa'} ${selectedIds.size} records`);
    setSelectedIds(new Set());
  };

  const getImageSrc = (record: DatasetRecord) => {
    // Prefer image_url over image_path for display
    if (record.assets.image_url) {
      return record.assets.image_url;
    }
    // If image_path is a URL, use it directly
    if (record.assets.image_path?.startsWith('http')) {
      return record.assets.image_path;
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Browser</h2>
          <p className="text-muted-foreground">Duyệt và quản lý dataset theo path và metadata</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
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
                <SelectItem value="warning">Warning</SelectItem>
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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-36">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">ID</SelectItem>
                <SelectItem value="name">Tên</SelectItem>
                <SelectItem value="created">Ngày tạo</SelectItem>
                <SelectItem value="updated">Ngày cập nhật</SelectItem>
                <SelectItem value="status">Trạng thái</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            >
              <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Hiển thị {paginatedRecords.length} / {filteredAndSortedRecords.length} records
            </span>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedIds.size} đã chọn</span>
                <Button size="sm" onClick={() => handleBulkAction('approve')}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Phê duyệt
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('warning')}>
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Cảnh báo
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction('reject')}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Từ chối
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Xóa
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Select All */}
      {paginatedRecords.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">Chọn tất cả trang này</span>
        </div>
      )}

      {/* Records Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedRecords.map((record) => {
            const imageSrc = getImageSrc(record);
            return (
              <Card 
                key={record.record_id} 
                className={`cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 ${selectedIds.has(record.record_id) ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedIds.has(record.record_id)}
                      onCheckedChange={() => toggleSelection(record.record_id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0" onClick={() => setSelectedRecord(record)}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0">
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
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0" onClick={() => setSelectedRecord(record)}>
                  {/* Image Preview */}
                  {imageSrc && (
                    <div className="aspect-video mb-3 rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={imageSrc} 
                        alt={record.metadata.entity_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
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
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedRecords.map((record) => {
            const imageSrc = getImageSrc(record);
            return (
              <Card 
                key={record.record_id} 
                className={`cursor-pointer hover:shadow-md transition-all ${selectedIds.has(record.record_id) ? 'ring-2 ring-primary' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedIds.has(record.record_id)}
                      onCheckedChange={() => toggleSelection(record.record_id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    {/* Thumbnail */}
                    <div 
                      className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center"
                      onClick={() => setSelectedRecord(record)}
                    >
                      {imageSrc ? (
                        <img 
                          src={imageSrc} 
                          alt={record.metadata.entity_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Image className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => setSelectedRecord(record)}>
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium truncate">{record.metadata.entity_name}</h4>
                        <Badge className={getStatusColor(record.status)}>
                          {record.status || 'pending'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{record.record_id}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {record.metadata.location.city}
                        </span>
                        <span>{record.qa_items.length} QA items</span>
                        {record.createdAt && (
                          <span>Tạo: {new Date(record.createdAt).toLocaleDateString('vi-VN')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {record.metadata.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
