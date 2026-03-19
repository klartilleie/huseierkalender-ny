import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User, Payout } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import BookingPayoutCalculator from "./BookingPayoutCalculator";
import UserPropertiesManager from "./UserPropertiesManager";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Plus,
  Check,
  Clock,
  Users,
  Calculator,
  List,
  Building,
  ChevronDown,
  ChevronUp
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

const formatCurrency = (n: number) => n.toLocaleString('nb-NO') + ' kr';

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
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
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

  const { data: overview, isLoading } = useQuery<{
    userId: number;
    year: number;
    months: Array<{
      month: number;
      monthName: string;
      bookingPayouts: Array<{
        id: number;
        guestName: string | null;
        checkIn: string | null;
        checkOut: string | null;
        nights: number;
        calculatedAmount: string;
        adminAmount: string | null;
        isOverridden: boolean;
        pricePerNight: string;
        discountPercent: string;
      }>;
      totalBookingAmount: number;
      manualPayouts: Array<{
        id: number;
        amount: string;
        status: string;
        notes: string | null;
        rentalDays: number | null;
      }>;
      totalManualPaid: number;
      totalManualOffset: number;
      totalManualPending: number;
      totalIncome: number;
      manualPayout: any;
      manualAmount: number;
      manualStatus: string | null;
      manualNotes: string | null;
      netAmount: number;
      finalStatus: string;
    }>;
  }>({
    queryKey: [`/api/admin/payouts/overview/${selectedUser}/${selectedYear}`],
    enabled: !!selectedUser,
  });

  const createPayoutMutation = useMutation({
    mutationFn: async (payout: typeof newPayout) => {
      const response = await apiRequest("POST", "/api/admin/payouts", payout);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Utbetaling registrert", description: "Utbetalingen ble registrert" });
      setIsCreateDialogOpen(false);
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
      if (selectedUser) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/payouts/overview/${selectedUser}/${selectedYear}`] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Feil", description: `Kunne ikke registrere utbetaling: ${error.message}`, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Betalt</Badge>;
      case "sent":
        return <Badge className="bg-blue-500"><Check className="h-3 w-3 mr-1" />Sendt</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Venter</Badge>;
      case "offset":
        return <Badge className="bg-orange-500"><DollarSign className="h-3 w-3 mr-1" />Motregning</Badge>;
      case "none":
        return <Badge variant="outline">Ingen data</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : "Ukjent bruker";
  };

  const totals = React.useMemo(() => {
    if (!overview?.months) return null;
    const earned = overview.months.reduce((s, m) => s + m.totalIncome, 0);
    const adjustments = overview.months.reduce((s, m) => s + m.totalManualOffset, 0);
    const net = earned - adjustments;
    return { earned, adjustments, net };
  }, [overview]);

  return (
    <div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Utbetalingsoversikt
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Booking-kalkulator
          </TabsTrigger>
          {!isReadOnly && (
            <TabsTrigger value="properties" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Eiendommer
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="calculator">
          <BookingPayoutCalculator users={users} />
        </TabsContent>
        
        {!isReadOnly && (
          <TabsContent value="properties">
            <UserPropertiesManager users={users} />
          </TabsContent>
        )}
        
        <TabsContent value="overview">
          <Card className="mb-6 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Velg bruker og år
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-sm font-semibold mb-2 block">Bruker</Label>
                  <Select value={selectedUser?.toString() || ""} onValueChange={(value) => setSelectedUser(parseInt(value))}>
                    <SelectTrigger className="h-12 text-base border-2 border-blue-300 bg-white font-medium">
                      <SelectValue placeholder="Velg bruker..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name} {user.isAdmin && "(Admin)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Label className="text-sm font-semibold mb-2 block">År</Label>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="h-12 text-base border-2 border-slate-300">
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
                    <Button 
                      onClick={() => {
                        if (selectedUser) {
                          setNewPayout(prev => ({ ...prev, userId: selectedUser, year: selectedYear }));
                        }
                        setIsCreateDialogOpen(true);
                      }} 
                      className="h-12 px-6 bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Registrer utbetaling
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!selectedUser && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Velg en bruker for å se utbetalingsoversikten
              </CardContent>
            </Card>
          )}

          {selectedUser && isLoading && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Laster...
              </CardContent>
            </Card>
          )}

          {selectedUser && overview && (
            <>
              {totals && (
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      Sammendrag {selectedYear} – {getUserName(selectedUser)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Booking-inntekter</p>
                        <p className="text-xl font-bold">{formatCurrency(totals.earned)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Justeringer</p>
                        <p className="text-xl font-bold text-orange-600">-{formatCurrency(totals.adjustments)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Netto</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(totals.net)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Månedsoversikt {selectedYear}</CardTitle>
                  <CardDescription>Klikk på en måned for å se detaljer</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {overview.months.map((month) => (
                      <div 
                        key={month.month} 
                        className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${expandedMonth === month.month ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => setExpandedMonth(expandedMonth === month.month ? null : month.month)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{month.monthName}</span>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(month.finalStatus)}
                            {expandedMonth === month.month 
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            }
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          {month.totalBookingAmount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Bookinger (API):</span>
                              <span className="font-medium">{formatCurrency(month.totalBookingAmount)}</span>
                            </div>
                          )}
                          {month.totalManualPaid > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Utbetalinger:</span>
                              <span className="font-medium text-green-600">{formatCurrency(month.totalManualPaid)}</span>
                            </div>
                          )}
                          {month.totalManualOffset > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Justering:</span>
                              <span className="font-medium text-orange-600">-{formatCurrency(month.totalManualOffset)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm border-t pt-1">
                            <span className="text-muted-foreground font-medium">Netto:</span>
                            <span className="font-bold">{formatCurrency(month.netAmount)}</span>
                          </div>
                          {month.manualNotes && (
                            <div className="text-xs text-muted-foreground mt-1 truncate" title={month.manualNotes}>
                              {month.manualNotes}
                            </div>
                          )}
                        </div>

                        {expandedMonth === month.month && (month.bookingPayouts.length > 0 || (month.manualPayouts && month.manualPayouts.length > 0)) && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {month.bookingPayouts.length > 0 && (
                              <>
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Bookingdetaljer (API)</p>
                                {month.bookingPayouts.map((bp) => {
                                  const amount = bp.isOverridden && bp.adminAmount
                                    ? parseFloat(bp.adminAmount)
                                    : parseFloat(bp.calculatedAmount || "0");
                                  return (
                                    <div key={bp.id} className="text-sm bg-slate-50 rounded p-2">
                                      <div className="flex justify-between">
                                        <span className="font-medium">{bp.guestName || 'Ukjent gjest'}</span>
                                        <span className="font-mono">{formatCurrency(amount)}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {bp.checkIn ? new Date(bp.checkIn).toLocaleDateString('nb-NO') : '?'} – {bp.checkOut ? new Date(bp.checkOut).toLocaleDateString('nb-NO') : '?'} · {bp.nights} netter
                                        {bp.isOverridden && <Badge variant="outline" className="ml-2 text-[10px]">Justert</Badge>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                            {month.manualPayouts && month.manualPayouts.length > 0 && (
                              <>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mt-2">Manuelle registreringer</p>
                                {month.manualPayouts.map((mp: any) => {
                                  const mpAmount = parseFloat(mp.amount || "0");
                                  const isOffset = mp.status === 'offset';
                                  return (
                                    <div key={mp.id} className={`text-sm rounded p-2 ${isOffset ? 'bg-orange-50' : 'bg-green-50'}`}>
                                      <div className="flex justify-between">
                                        <span className="font-medium">{mp.notes || (isOffset ? 'Motregning' : 'Utbetaling')}</span>
                                        <span className={`font-mono ${isOffset ? 'text-orange-600' : 'text-green-600'}`}>
                                          {isOffset ? '-' : ''}{formatCurrency(Math.abs(mpAmount))}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {mp.rentalDays ? `${mp.rentalDays} dager` : ''}
                                        {' '}
                                        <Badge variant="outline" className="text-[10px]">
                                          {mp.status === 'paid' ? 'Betalt' : mp.status === 'sent' ? 'Sendt' : mp.status === 'offset' ? 'Motregning' : mp.status === 'pending' ? 'Venter' : mp.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        )}
                        {expandedMonth === month.month && month.bookingPayouts.length === 0 && (!month.manualPayouts || month.manualPayouts.length === 0) && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground">Ingen registreringer denne måneden</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrer utbetaling</DialogTitle>
                <DialogDescription>Registrer en ny utbetaling eller justering</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Bruker</Label>
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
                    <Label>Måned</Label>
                    <Select 
                      value={newPayout.month.toString()} 
                      onValueChange={(value) => setNewPayout({ ...newPayout, month: parseInt(value) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(month => (
                          <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>År</Label>
                    <Select 
                      value={newPayout.year.toString()} 
                      onValueChange={(value) => setNewPayout({ ...newPayout, year: parseInt(value) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Beløp (NOK){newPayout.status === "offset" ? " (Restbeløp etter motregning)" : ""}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newPayout.amount}
                    onChange={(e) => setNewPayout({ ...newPayout, amount: e.target.value })}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Antall utleiedager</Label>
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
                            toast({ title: "Utleiedager beregnet", description: result.message });
                          } catch {
                            toast({ title: "Feil", description: "Kunne ikke beregne utleiedager", variant: "destructive" });
                          }
                        }
                      }}
                      disabled={!newPayout.userId || !newPayout.month || !newPayout.year}
                    >
                      Beregn fra API
                    </Button>
                  </div>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newPayout.rentalDays}
                    onChange={(e) => setNewPayout({ ...newPayout, rentalDays: e.target.value })}
                    min="0"
                    max="31"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select 
                    value={newPayout.status} 
                    onValueChange={(value: "pending" | "paid" | "sent" | "offset") => setNewPayout({ ...newPayout, status: value })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Venter</SelectItem>
                      <SelectItem value="paid">Betalt</SelectItem>
                      <SelectItem value="sent">Utbetaling sendt</SelectItem>
                      <SelectItem value="offset">Motregning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Notater</Label>
                  <Textarea
                    placeholder="Valgfrie notater..."
                    value={newPayout.notes}
                    onChange={(e) => setNewPayout({ ...newPayout, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Avbryt</Button>
                <Button 
                  onClick={() => createPayoutMutation.mutate(newPayout)}
                  disabled={!newPayout.userId || !newPayout.amount}
                >
                  Registrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
