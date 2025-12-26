import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import { DatasetRecord } from "@/types/dataset";
import { RecordDetailModal } from "./RecordDetailModal";
import { toast } from "sonner";

interface DataBrowserProps {
  records: DatasetRecord[];
  onRecordUpdate?: (record: DatasetRecord) => void;
  onRecordsUpdate?: (records: DatasetRecord[]) => void;
  onNavigateToAnnotate?: (recordId: string) => void;
}

const ITEMS_PER_PAGE = 100;

type SortBy = "id" | "created" | "status" | "name";
type SortOrder = "asc" | "desc";

export function DataBrowser({ records, onRecordUpdate, onRecordsUpdate, onNavigateToAnnotate }: DataBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<DatasetRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records.filter((record) => {
      const matchesSearch =
        record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.landmark_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.metadata.location.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || record.status === statusFilter;
      const matchesType = typeFilter === "all" || record.qa_pairs?.some((qa) => qa.type === typeFilter);

      return matchesSearch && matchesStatus && matchesType;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "id":
          comparison = a.id.localeCompare(b.id);
          break;
        case "name":
          comparison = a.metadata.landmark_name.localeCompare(b.metadata.landmark_name);
          break;
        case "created":
          comparison = (a.timestamp || "").localeCompare(b.timestamp || "");
          break;
        case "status":
          comparison = (a.status || "pending").localeCompare(b.status || "pending");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [records, searchQuery, statusFilter, typeFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "bg-accent text-accent-foreground";
      case "rejected":
        return "bg-destructive/10 text-destructive";
      case "needs_review":
        return "bg-chart-4/10 text-chart-4";
      default:
        return "bg-muted text-muted-foreground";
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
      setSelectedIds(new Set(paginatedRecords.map((r) => r.id)));
    }
  };

  const selectAllDataset = () => {
    setSelectedIds(new Set(filteredAndSortedRecords.map((r) => r.id)));
  };

  const handleBulkAction = (action: "approve" | "reject" | "needs_review" | "delete") => {
    if (selectedIds.size === 0) {
      toast.error("Chưa chọn record nào");
      return;
    }

    const updatedRecords = records
      .map((record) => {
        if (!selectedIds.has(record.id)) return record;

        if (action === "delete") return null;

        return {
          ...record,
          status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs_review",
          reviewedAt: new Date().toISOString(),
        } as DatasetRecord;
      })
      .filter(Boolean) as DatasetRecord[];

    if (onRecordsUpdate) {
      onRecordsUpdate(updatedRecords);
    }

    toast.success(
      `Đã ${action === "approve" ? "phê duyệt" : action === "reject" ? "từ chối" : action === "needs_review" ? "đánh dấu cần xem xét" : "xóa"} ${selectedIds.size} records`,
    );
    setSelectedIds(new Set());
  };

  // Navigate to adjacent record
  const handleNavigateRecord = useCallback(
    (direction: "prev" | "next") => {
      if (!selectedRecord) return;

      const currentIndex = filteredAndSortedRecords.findIndex((r) => r.id === selectedRecord.id);
      if (currentIndex === -1) return;

      const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < filteredAndSortedRecords.length) {
        setSelectedRecord(filteredAndSortedRecords[newIndex]);
      }
    },
    [selectedRecord, filteredAndSortedRecords],
  );

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Browser</h2>
          <p className="text-muted-foreground">Duyệt và quản lý dataset</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="shrink-0">
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
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="QA Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả types</SelectItem>
                <SelectItem value="ask_image">ask_image</SelectItem>
                <SelectItem value="ask_audio">ask_audio</SelectItem>
                <SelectItem value="ask_both">ask_both</SelectItem>
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
                <SelectItem value="status">Trạng thái</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}>
              <ArrowUpDown className={`h-4 w-4 ${sortOrder === "desc" ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Hiển thị {paginatedRecords.length} / {filteredAndSortedRecords.length} records
              </span>
              <Button size="sm" variant="outline" onClick={selectAllDataset}>
                Chọn tất cả ({filteredAndSortedRecords.length})
              </Button>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedIds.size} đã chọn</span>
                <Button size="sm" onClick={() => handleBulkAction("approve")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Phê duyệt
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction("needs_review")}>
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Cần xem xét
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction("reject")}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Từ chối
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction("delete")}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Xóa
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dataframe Table */}
      <Card className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="min-w-[200px]">ID</TableHead>
                <TableHead className="min-w-[200px]">Landmark Name</TableHead>
                <TableHead className="min-w-[120px]">City</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[80px]">QA</TableHead>
                <TableHead className="min-w-[80px]">Image</TableHead>
                <TableHead className="min-w-[80px]">Audio</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((record, index) => {
                const rowNumber = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                const hasImage = !!record.paths?.image;
                const hasAudio = !!record.paths?.audio_evidence;

                return (
                  <TableRow key={record.id} className={selectedIds.has(record.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(record.id)}
                        onCheckedChange={() => toggleSelection(record.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{rowNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{record.id}</TableCell>
                    <TableCell className="font-medium">{record.metadata.landmark_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{record.metadata.location.city}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(record.status)}>{record.status || "pending"}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{record.qa_pairs?.length || 0}</TableCell>
                    <TableCell className="text-center">
                      {hasImage ? (
                        <span className="text-accent-foreground">✓</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasAudio ? (
                        <span className="text-accent-foreground">✓</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (onNavigateToAnnotate) {
                          onNavigateToAnnotate(record.id);
                        } else {
                          setSelectedRecord(record);
                        }
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm text-muted-foreground">
          Trang {currentPage} / {totalPages || 1}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Sau
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail Modal */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onUpdate={onRecordUpdate}
        onNavigate={handleNavigateRecord}
        currentIndex={
          selectedRecord ? filteredAndSortedRecords.findIndex((r) => r.id === selectedRecord.id) : -1
        }
        totalRecords={filteredAndSortedRecords.length}
      />
    </div>
  );
}
