import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DeletedRecord {
  id: string;
  record_id: string;
  deleted_at: string;
  deleted_by: string;
  status: string;
  data: any;
}

interface DeletedRecordsPanelProps {
  onRestoreComplete?: () => void;
  onRefreshVersions?: () => void;
}

export function DeletedRecordsPanel({ onRestoreComplete, onRefreshVersions }: DeletedRecordsPanelProps) {
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  const fetchDeletedRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dataset_records')
        .select('id, record_id, deleted_at, deleted_by, status, data')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching deleted records:', error);
        return;
      }

      setDeletedRecords((data || []) as DeletedRecord[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeletedRecords();
  }, [fetchDeletedRecords]);

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
    if (selectedIds.size === deletedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedRecords.map(r => r.id)));
    }
  };

  const handleRestore = async () => {
    if (selectedIds.size === 0) return;

    setIsRestoring(true);
    try {
      const { error } = await supabase
        .from('dataset_records')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
        })
        .in('id', Array.from(selectedIds));

      if (error) {
        console.error('Error restoring records:', error);
        toast.error('Không thể khôi phục records');
        return;
      }

      toast.success(`Đã khôi phục ${selectedIds.size} records`);
      setSelectedIds(new Set());
      await fetchDeletedRecords();
      onRestoreComplete?.();
      onRefreshVersions?.();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Lỗi khi khôi phục');
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsPermanentDeleting(true);
    try {
      const { error } = await supabase
        .from('dataset_records')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) {
        console.error('Error permanently deleting records:', error);
        toast.error('Không thể xóa vĩnh viễn');
        return;
      }

      toast.success(`Đã xóa vĩnh viễn ${selectedIds.size} records`);
      setSelectedIds(new Set());
      await fetchDeletedRecords();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Lỗi khi xóa');
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Thùng rác
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Thùng rác ({deletedRecords.length} records)
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchDeletedRecords}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {deletedRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Không có records nào trong thùng rác
          </div>
        ) : (
          <>
            {/* Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">{selectedIds.size} đã chọn</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestore}
                  disabled={isRestoring}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Khôi phục
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPermanentDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Xóa vĩnh viễn
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Xóa vĩnh viễn
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn có chắc muốn xóa vĩnh viễn {selectedIds.size} records?
                        Hành động này KHÔNG THỂ hoàn tác!
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handlePermanentDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Xóa vĩnh viễn
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Table */}
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === deletedRecords.length && deletedRecords.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Xóa lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedRecords.map((record) => (
                    <TableRow key={record.id} className={selectedIds.has(record.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={() => toggleSelection(record.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{record.record_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{record.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.deleted_at ? format(new Date(record.deleted_at), 'dd/MM/yyyy HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
