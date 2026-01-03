import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Download, RotateCw, UploadCloud, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BackupSummary {
  eventsCount: number;
  icalFeedsCount: number;
  icalEventNotesCount: number;
  markedDaysCount: number;
}

interface Backup {
  id: number;
  filename: string;
  isAutomatic: boolean;
  size: number;
  summary: BackupSummary;
  createdAt: string;
}

export default function BackupManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [backupToRestore, setBackupToRestore] = useState<string | null>(null);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  
  // Fetch backups list
  const { data: backups, isLoading, error } = useQuery<Backup[]>({
    queryKey: ['/api/admin/backups'],
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/backups');
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Backup created",
        description: "A new backup has been created successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Backup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await apiRequest('POST', `/api/admin/backups/restore/${filename}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Backup restored",
        description: "The system has been restored from backup successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ical-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marked-days'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ical-event-notes'] });
      setIsRestoreDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Restore failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleRestoreClick = (filename: string) => {
    setBackupToRestore(filename);
    setIsRestoreDialogOpen(true);
  };
  
  const confirmRestore = () => {
    if (backupToRestore) {
      restoreBackupMutation.mutate(backupToRestore);
    }
  };
  
  const downloadCalendarExport = async () => {
    try {
      window.open('/api/calendar/export-ical', '_blank');
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export calendar",
        variant: "destructive",
      });
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  
  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'PPP pp');
    } catch (e) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Error Loading Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to load backup information. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Backup Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={downloadCalendarExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Calendar
          </Button>
          <Button 
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="flex items-center gap-2"
          >
            {createBackupMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Create Backup
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            View and restore system backups. The system automatically creates daily backups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups && backups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Content Summary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">{formatDate(backup.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={backup.isAutomatic ? "secondary" : "default"}>
                        {backup.isAutomatic ? "Automatic" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(backup.size)}</TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        <span className="mr-3">Events: {backup.summary.eventsCount}</span>
                        <span className="mr-3">Feeds: {backup.summary.icalFeedsCount}</span>
                        <span className="mr-3">Notes: {backup.summary.icalEventNotesCount}</span>
                        <span>Marked Days: {backup.summary.markedDaysCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreClick(backup.filename)}
                        disabled={restoreBackupMutation.isPending}
                      >
                        {restoreBackupMutation.isPending && backupToRestore === backup.filename ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4 mr-2" />
                        )}
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No backups found. Create your first backup to protect your data.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Backups are stored securely and can be restored at any time.
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will restore the system to a previous state. All current data will be replaced 
              with data from the selected backup. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}