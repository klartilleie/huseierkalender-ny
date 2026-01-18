import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  Users,
  Calendar,
  Moon,
  Wallet,
  Percent,
  RefreshCw,
  AlertCircle
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

interface BookingPayout {
  id: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  dailyPrice: number;
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  netPayout: number;
  bookingId: string | null;
  status: string;
}

interface PayoutResponse {
  bookings: BookingPayout[];
  priceInfo: {
    dailyPrice: number;
    discountPercent: number;
    priceRangeName: string;
  };
  totals: {
    totalBookings: number;
    totalNights: number;
    totalGross: number;
    totalDiscount: number;
    totalNet: number;
  };
}

interface BookingPayoutCalculatorProps {
  users: User[];
}

export default function BookingPayoutCalculator({ users }: BookingPayoutCalculatorProps) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePayouts = async () => {
    if (!selectedUser) {
      toast({
        title: "Velg en bruker",
        description: "Du må velge en bruker for å beregne utbetalinger",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", "/api/admin/payouts/calculate-booking-payouts", {
        userId: selectedUser,
        month: selectedMonth,
        year: selectedYear
      });
      
      const data = await response.json();
      
      if (data.message && data.bookings?.length === 0) {
        setError(data.message);
        setPayoutData(null);
      } else {
        setPayoutData(data);
      }
    } catch (err: any) {
      setError(err.message || "Kunne ikke beregne utbetalinger");
      setPayoutData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : "Ukjent bruker";
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return <Badge className="bg-green-500">Ny</Badge>;
      case "confirmed":
        return <Badge className="bg-blue-500">Bekreftet</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500">Kansellert</Badge>;
      case "black":
        return <Badge className="bg-gray-800">Blokkert</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Beregn utbetalinger fra bookinger
          </CardTitle>
          <CardDescription>
            Velg bruker, måned og år for å beregne utbetalinger basert på Beds24-bookinger og brukerens prisintervall
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Bruker
              </Label>
              <Select 
                value={selectedUser?.toString() || ""} 
                onValueChange={(value) => setSelectedUser(parseInt(value))}
              >
                <SelectTrigger className="h-12 text-base border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800">
                  <SelectValue placeholder="Velg bruker..." />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => !u.isAdmin).map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-600" />
                        {user.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Måned
              </Label>
              <Select 
                value={selectedMonth.toString()} 
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="h-12 text-base border-2 border-slate-300 dark:border-slate-700">
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
            
            <div className="w-32">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                År
              </Label>
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="h-12 text-base border-2 border-slate-300 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={calculatePayouts} 
                disabled={isLoading || !selectedUser}
                className="h-12 px-6 bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4 mr-2" />
                )}
                Beregn
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {payoutData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500 rounded-lg">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Bookinger</p>
                    <p className="text-2xl font-bold">{payoutData.totals.totalBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500 rounded-lg">
                    <Moon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">Totalt netter</p>
                    <p className="text-2xl font-bold">{payoutData.totals.totalNights}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500 rounded-lg">
                    <Percent className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-orange-600 dark:text-orange-400">Rabatt ({payoutData.priceInfo.discountPercent}%)</p>
                    <p className="text-2xl font-bold">{formatCurrency(payoutData.totals.totalDiscount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500 rounded-lg">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400">Total utbetaling</p>
                    <p className="text-2xl font-bold">{formatCurrency(payoutData.totals.totalNet)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Booking-utbetalinger for {getUserName(selectedUser!)} - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
              <CardDescription>
                Dagspris: {formatCurrency(payoutData.priceInfo.dailyPrice)} | 
                Rabatt: {payoutData.priceInfo.discountPercent}% | 
                Prisintervall: {payoutData.priceInfo.priceRangeName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gjest</TableHead>
                    <TableHead>Innsjekk</TableHead>
                    <TableHead>Utsjekk</TableHead>
                    <TableHead className="text-center">Netter</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead className="text-right">Rabatt</TableHead>
                    <TableHead className="text-right">Utbetaling</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutData.bookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Ingen bookinger funnet for denne perioden
                      </TableCell>
                    </TableRow>
                  ) : (
                    payoutData.bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.guestName}</TableCell>
                        <TableCell>{format(new Date(booking.checkIn), "d. MMM", { locale: nb })}</TableCell>
                        <TableCell>{format(new Date(booking.checkOut), "d. MMM", { locale: nb })}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{booking.nights}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(booking.grossAmount)}</TableCell>
                        <TableCell className="text-right text-orange-600">
                          -{formatCurrency(booking.discountAmount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(booking.netPayout)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(booking.status)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {payoutData.bookings.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-end gap-8">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Brutto total</p>
                    <p className="text-lg font-semibold">{formatCurrency(payoutData.totals.totalGross)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total rabatt</p>
                    <p className="text-lg font-semibold text-orange-600">-{formatCurrency(payoutData.totals.totalDiscount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Netto utbetaling</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(payoutData.totals.totalNet)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
