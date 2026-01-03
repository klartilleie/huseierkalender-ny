import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { MarkedDay } from "@shared/schema";
import { Calendar, Edit, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import MarkDayModal from "./MarkDayModal";

interface MarkedDayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  markedDay: MarkedDay;
}

export default function MarkedDayDetailsModal({ isOpen, onClose, markedDay }: MarkedDayDetailsModalProps) {
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete marked day mutation
  const deleteMarkedDayMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/marked-days/${markedDay.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marked-days"] });
      toast({
        title: "Marked day deleted",
        description: "The marked day has been successfully removed.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete marked day",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMarkedDayMutation.mutate();
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  // Convert marker type to display name
  const getMarkerTypeDisplay = (type: string) => {
    const types: Record<string, string> = {
      busy: "Busy",
      vacation: "Vacation",
      holiday: "Holiday",
      other: "Other"
    };
    return types[type] || type;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: markedDay.color || "#8b5cf6" }}
              />
              {getMarkerTypeDisplay(markedDay.markerType)}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-slate-500 mr-2" />
              <span className="text-slate-800">{format(new Date(markedDay.date), "MMMM d, yyyy")}</span>
            </div>
            
            {markedDay.notes && (
              <div className="pt-2 border-t border-slate-200">
                <h3 className="text-sm font-medium text-slate-700 mb-1">Notes:</h3>
                <p className="text-slate-800 whitespace-pre-line">{markedDay.notes}</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={handleEdit}
              className="gap-1"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="gap-1"
              disabled={deleteMarkedDayMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {deleteMarkedDayMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this marked day. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit marked day modal */}
      {isEditModalOpen && (
        <MarkDayModal 
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            onClose();
          }}
          existingMarkedDay={{
            id: markedDay.id,
            date: new Date(markedDay.date),
            markerType: markedDay.markerType,
            color: markedDay.color || "#8b5cf6",
            notes: markedDay.notes || undefined,
          }}
        />
      )}
    </>
  );
}