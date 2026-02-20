import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/Layout";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  DollarSign, 
  Check,
  Clock,
  TrendingUp,
  CreditCard,
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

export default function PayoutsPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

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
      }>;
      totalBookingAmount: number;
      manualPayout: any;
      manualAmount: number;
      manualStatus: string | null;
      manualNotes: string | null;
      netAmount: number;
      finalStatus: string;
    }>;
  }>({
    queryKey: [`/api/user/payouts/overview/${selectedYear}`],
    enabled: !!user,
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

  const totals = React.useMemo(() => {
    if (!overview?.months) return { earned: 0, paid: 0, pending: 0, adjustments: 0 };
    
    const earned = overview.months.reduce((s, m) => s + m.totalBookingAmount, 0);
    const paid = overview.months
      .filter(m => m.finalStatus === 'paid' || m.finalStatus === 'sent')
      .reduce((s, m) => s + m.netAmount, 0);
    const pending = overview.months
      .filter(m => m.finalStatus === 'pending' && m.totalBookingAmount > 0)
      .reduce((s, m) => s + m.netAmount, 0);
    const adjustments = overview.months
      .filter(m => m.manualStatus === 'offset')
      .reduce((s, m) => s + Math.abs(m.manualAmount), 0);
    
    return { earned, paid, pending, adjustments };
  }, [overview]);

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Mine Utbetalinger</h1>
          <p className="text-muted-foreground mt-1">Oversikt over dine månedlige utbetalinger</p>
        </div>

        <div className="mb-6">
          <Label>Velg år</Label>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-48">
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

        {isLoading && <p className="text-muted-foreground">Laster...</p>}

        {overview && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Totalt opptjent</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totals.earned)}</div>
                  <p className="text-xs text-muted-foreground">Fra bookinger i {selectedYear}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Utbetalt</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</div>
                  <p className="text-xs text-muted-foreground">Betalt / sendt</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Venter</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totals.pending)}</div>
                  <p className="text-xs text-muted-foreground">Venter på utbetaling</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Justeringer</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">-{formatCurrency(totals.adjustments)}</div>
                  <p className="text-xs text-muted-foreground">Motregninger</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Månedsoversikt {selectedYear}</CardTitle>
                <CardDescription>Klikk på en måned for å se bookingdetaljer</CardDescription>
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
                          {month.bookingPayouts.length > 0 && (
                            expandedMonth === month.month 
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Bookinger:</span>
                          <span className="font-medium">{formatCurrency(month.totalBookingAmount)}</span>
                        </div>
                        {month.manualStatus === 'offset' && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Justering:</span>
                            <span className="font-medium text-orange-600">-{formatCurrency(Math.abs(month.manualAmount))}</span>
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

                      {expandedMonth === month.month && month.bookingPayouts.length > 0 && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Bookingdetaljer</p>
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
                        </div>
                      )}
                      {expandedMonth === month.month && month.bookingPayouts.length === 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground">Ingen bookinger registrert denne måneden</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
