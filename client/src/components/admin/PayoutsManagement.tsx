import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { User, Payout } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Edit, 
  Trash2, 
  Plus,
  Check,
  X,
  Clock,
  Calendar,
  Users
} from "lucide-react";

const MONTHS = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "Mars" },
  { value: 4, label: "April" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

interface PayoutsManagementProps {
  users: User[];
}

export default function PayoutsManagement({ users }: PayoutsManagementProps) {
  const { user: currentUser } = useAuth();
  const isReadOnly = currentUser?.isMiniAdmin && !currentUser?.isAdmin;
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  
  const [newPayout, setNewPayout] = useState({
    userId: 0,
    month: new Date().getMonth() + 1,
    year: currentYear,
    amount: "",
    currency: "NOK",
    status: "pending" as "pending" | "paid" | "sent" | "offset",
    rentalDays: "",
    notes: "",
  });

  // Fetch payouts based on selected user and year
  const { data: payouts, isLoading } = useQuery<Payout[]>({
    queryKey: selectedUser 
      ? [`/api/admin/payouts/user/${selectedUser}/year/${selectedYear}`]
      : [`/api/admin/payouts`],
    enabled: true,
  });

  // Create payout mutation
  const createPayoutMutation = useMutation({
    mutationFn: async (payout: typeof newPayout) => {
      const response = await apiRequest("POST", "/api/admin/payouts", payout);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Utbetaling registrert",
        description: "Utbetalingen ble registrert",
      });
      setIsCreateDialogOpen(false);
      // Reset form
      setNewPayout({
        userId: 0,
        month: new Date().getMonth() + 1,
        year: currentYear,
        amount: "",
        currency: "NOK",
        status: "pending",
        rentalDays: "",
        notes: "",
      });
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payouts`] });
      if (selectedUser) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/admin/payouts/user/${selectedUser}/year/${selectedYear}`] 
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke registrere utbetaling: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update payout mutation
  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof newPayout> }) => {
      const response = await apiRequest("PATCH", `/api/admin/payouts/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Utbetaling oppdatert",
        description: "Utbetalingen ble oppdatert",
      });
      setIsEditDialogOpen(false);
      setSelectedPayout(null);
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payouts`] });
      if (selectedUser) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/admin/payouts/user/${selectedUser}/year/${selectedYear}`] 
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke oppdatere utbetaling: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete payout mutation
  const deletePayoutMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/payouts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Utbetaling slettet",
        description: "Utbetalingen ble slettet",
      });
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [`/api/admin/payouts`] });
      if (selectedUser) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/admin/payouts/user/${selectedUser}/year/${selectedYear}`] 
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke slette utbetaling: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Betalt</Badge>;
      case "sent":
        return <Badge className="bg-blue-500"><Check className="h-3 w-3 mr-1" />Utbetaling sendt</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Venter</Badge>;
      case "offset":
        return <Badge className="bg-orange-500"><DollarSign className="h-3 w-3 mr-1" />Motregning</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : "Ukjent bruker";
  };

  // Calculate yearly overview for selected user
  const yearlyOverview = React.useMemo(() => {
    if (!selectedUser || !payouts) return null;
    
    const overview = MONTHS.map(month => {
      const payout = payouts.find(p => p.month === month.value);
      return {
        month: month.label,
        amount: payout?.amount || 0,
        status: payout?.status || null,
        id: payout?.id || null,
      };
    });
    
    // Beregn totaler korrekt ifølge forretningslogikk:
    // - Total utbetalt = sum av alle utbetalingsbeløp (før motregning)
    // - Motregnet = sum av motregningsbeløp (trekk fra total) - bruk absoluttverdi siden offset lagres som negative tall
    // - Sendt = Total utbetalt minus motregnet
    const totalUtbetalt = payouts.filter(p => p.status !== "offset").reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    const motregnet = payouts.filter(p => p.status === "offset").reduce((sum, p) => sum + Math.abs(parseFloat(p.amount || "0")), 0);
    const sendt = totalUtbetalt - motregnet;
    const paid = payouts.filter(p => p.status === "paid").reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    
    return { overview, totalUtbetalt, sendt, motregnet, paid };
  }, [selectedUser, payouts]);

  return (
    <div>
      {/* Filters Card with improved styling */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Velg bruker for å filtrere utbetalinger:
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Brukerfilter</Label>
              <Select value={selectedUser?.toString() || "all"} onValueChange={(value) => setSelectedUser(value === "all" ? null : parseInt(value))}>
                <SelectTrigger className="h-12 text-base border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 font-medium shadow-sm hover:border-blue-400 transition-colors">
                  <SelectValue placeholder="Vis alle brukere" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>Vis alle brukere</span>
                    </div>
                  </SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        {user.name} {user.isAdmin && "(Admin)"}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">År</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="h-12 text-base border-2 border-slate-300 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isReadOnly && (
              <div className="flex items-end">
                <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2 h-12 px-6 bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4" />
                  Registrer utbetaling
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Yearly Overview Card - Only show when a user is selected */}
      {selectedUser && yearlyOverview && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Årsoversikt {selectedYear} - {getUserName(selectedUser)}</CardTitle>
            <CardDescription>
              Total utbetalt: {yearlyOverview.totalUtbetalt.toFixed(2)} NOK | Sendt: {yearlyOverview.sendt.toFixed(2)} NOK | Motregnet: {yearlyOverview.motregnet.toFixed(2)} NOK
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {yearlyOverview.overview.map((month, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="font-medium text-sm">{month.month}</div>
                  <div className="text-2xl font-bold">
                    {month.amount ? `${parseFloat(month.amount.toString()).toFixed(0)},-` : "-"}
                  </div>
                  {month.status && (
                    <div className="mt-1">
                      {getStatusBadge(month.status)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Utbetalingsoversikt</CardTitle>
          <CardDescription>
            {selectedUser 
              ? `Filtrert: Viser kun utbetalinger for ${getUserName(selectedUser)} i ${selectedYear}`
              : `Viser ALLE utbetalinger for ALLE brukere i ${selectedYear}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              {isLoading ? "Laster..." : `${payouts?.length || 0} utbetalinger funnet`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Bruker</TableHead>
                <TableHead>Måned</TableHead>
                <TableHead>År</TableHead>
                <TableHead className="text-right">Beløp</TableHead>
                <TableHead className="text-center">Utleiedager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notater</TableHead>
                {!isReadOnly && <TableHead className="text-right">Handlinger</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts?.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-medium">{getUserName(payout.userId)}</TableCell>
                  <TableCell>{MONTHS.find(m => m.value === payout.month)?.label}</TableCell>
                  <TableCell>{payout.year}</TableCell>
                  <TableCell className={`text-right font-mono ${parseFloat(payout.amount || "0") < 0 ? "text-red-600" : ""}`}>
                    {parseFloat(payout.amount || "0").toFixed(2)} {payout.currency}
                  </TableCell>
                  <TableCell className="text-center">
                    {payout.rentalDays ? `${payout.rentalDays} dager` : "-"}
                  </TableCell>
                  <TableCell>{getStatusBadge(payout.status)}</TableCell>
                  <TableCell className="max-w-xs truncate" title={payout.notes || ""}>
                    {payout.notes || "-"}
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPayout(payout);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Er du sikker på at du vil slette denne utbetalingen?")) {
                              deletePayoutMutation.mutate(payout.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Payout Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrer utbetaling</DialogTitle>
            <DialogDescription>
              Registrer en ny utbetaling for en bruker
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">Bruker</Label>
              <Select 
                value={newPayout.userId.toString()} 
                onValueChange={(value) => setNewPayout({ ...newPayout, userId: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Velg bruker" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="month">Måned</Label>
                <Select 
                  value={newPayout.month.toString()} 
                  onValueChange={(value) => setNewPayout({ ...newPayout, month: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="year">År</Label>
                <Select 
                  value={newPayout.year.toString()} 
                  onValueChange={(value) => setNewPayout({ ...newPayout, year: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">
                Beløp (NOK) 
                {newPayout.status === "offset" && " (Restbeløp etter motregning)"}
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder={newPayout.status === "offset" ? "Restbeløp (f.eks. 3500)" : "0.00"}
                value={newPayout.amount}
                onChange={(e) => setNewPayout({ ...newPayout, amount: e.target.value })}
                step="0.01"
                min="0"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rentalDays">Antall utleiedager</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (newPayout.userId && newPayout.month && newPayout.year) {
                      try {
                        const response = await apiRequest("POST", "/api/admin/payouts/calculate-rental-days", {
                          userId: newPayout.userId,
                          month: newPayout.month,
                          year: newPayout.year
                        });
                        const result = await response.json();
                        setNewPayout({ ...newPayout, rentalDays: result.rentalDays.toString() });
                        toast({
                          title: "Utleiedager beregnet",
                          description: result.message,
                        });
                      } catch (error) {
                        toast({
                          title: "Feil",
                          description: "Kunne ikke beregne utleiedager fra API",
                          variant: "destructive",
                        });
                      }
                    } else {
                      toast({
                        title: "Mangler informasjon",
                        description: "Velg bruker, måned og år først",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={!newPayout.userId || !newPayout.month || !newPayout.year}
                >
                  Beregn fra API
                </Button>
              </div>
              <Input
                id="rentalDays"
                type="number"
                placeholder="0"
                value={newPayout.rentalDays}
                onChange={(e) => setNewPayout({ ...newPayout, rentalDays: e.target.value })}
                min="0"
                max="31"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={newPayout.status} 
                onValueChange={(value: "pending" | "paid" | "sent" | "offset") => 
                  setNewPayout({ ...newPayout, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Venter</SelectItem>
                  <SelectItem value="paid">Betalt</SelectItem>
                  <SelectItem value="sent">Utbetaling sendt</SelectItem>
                  <SelectItem value="offset">Motregning (restbeløp etter motregning)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notater</Label>
              <Textarea
                id="notes"
                placeholder="Valgfrie notater..."
                value={newPayout.notes}
                onChange={(e) => setNewPayout({ ...newPayout, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Avbryt
            </Button>
            <Button 
              onClick={() => {
                // Validate offset amounts are positive
                if (newPayout.status === "offset" && parseFloat(newPayout.amount || "0") < 0) {
                  toast({
                    title: "Feil",
                    description: "Motregning må være et positivt restbeløp, ikke et negativt beløp",
                    variant: "destructive",
                  });
                  return;
                }
                
                createPayoutMutation.mutate(newPayout);
              }}
              disabled={!newPayout.userId || !newPayout.amount}
            >
              Registrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payout Dialog */}
      {selectedPayout && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rediger utbetaling</DialogTitle>
              <DialogDescription>
                Oppdater informasjon om utbetalingen
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-amount">
                  Beløp (NOK)
                  {selectedPayout.status === "offset" && " (Restbeløp etter motregning)"}
                </Label>
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder={selectedPayout.status === "offset" ? "Restbeløp (f.eks. 3500)" : "0.00"}
                  defaultValue={selectedPayout.amount}
                  onChange={(e) => setSelectedPayout({ ...selectedPayout, amount: e.target.value })}
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-rentalDays">Antall utleiedager</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await apiRequest("POST", "/api/admin/payouts/calculate-rental-days", {
                          userId: selectedPayout.userId,
                          month: selectedPayout.month,
                          year: selectedPayout.year
                        });
                        const result = await response.json();
                        setSelectedPayout({ ...selectedPayout, rentalDays: result.rentalDays });
                        toast({
                          title: "Utleiedager beregnet",
                          description: result.message,
                        });
                      } catch (error) {
                        toast({
                          title: "Feil",
                          description: "Kunne ikke beregne utleiedager fra API",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Beregn fra API
                  </Button>
                </div>
                <Input
                  id="edit-rentalDays"
                  type="number"
                  placeholder="0"
                  defaultValue={selectedPayout.rentalDays || ""}
                  onChange={(e) => setSelectedPayout({ ...selectedPayout, rentalDays: parseInt(e.target.value) || null })}
                  min="0"
                  max="31"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select 
                  defaultValue={selectedPayout.status} 
                  onValueChange={(value: string) => 
                    setSelectedPayout({ ...selectedPayout, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Venter</SelectItem>
                    <SelectItem value="paid">Betalt</SelectItem>
                    <SelectItem value="sent">Utbetaling sendt</SelectItem>
                    <SelectItem value="offset">Motregning (restbeløp etter motregning)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notater</Label>
                <Textarea
                  id="edit-notes"
                  placeholder="Valgfrie notater..."
                  defaultValue={selectedPayout.notes || ""}
                  onChange={(e) => setSelectedPayout({ ...selectedPayout, notes: e.target.value })}
                />
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Avbryt
              </Button>
              <Button 
                onClick={() => {
                  // Validate offset amounts are positive
                  if (selectedPayout.status === "offset" && parseFloat(selectedPayout.amount || "0") < 0) {
                    toast({
                      title: "Feil",
                      description: "Motregning må være et positivt restbeløp, ikke et negativt beløp",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  updatePayoutMutation.mutate({
                    id: selectedPayout.id,
                    data: {
                      amount: selectedPayout.amount,
                      status: selectedPayout.status as "pending" | "paid" | "sent" | "offset",
                      rentalDays: selectedPayout.rentalDays?.toString(),
                      notes: selectedPayout.notes,
                    }
                  });
                }}
              >
                Oppdater
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}