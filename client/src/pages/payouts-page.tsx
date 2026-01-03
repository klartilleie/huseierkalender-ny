import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Payout } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  X,
  Clock,
  Calendar,
  TrendingUp,
  CreditCard
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

export default function PayoutsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch user's own payouts for selected year
  const { data: payouts, isLoading } = useQuery<Payout[]>({
    queryKey: [`/api/user/payouts/year/${selectedYear}`],
    enabled: !!user,
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
        return <Badge className="bg-orange-500"><DollarSign className="h-3 w-3 mr-1" />Motregner</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Calculate yearly overview
  const yearlyOverview = React.useMemo(() => {
    if (!payouts) return null;
    
    const overview = MONTHS.map(month => {
      const payout = payouts.find(p => p.month === month.value);
      return {
        month: month.label,
        amount: payout?.amount || 0,
        status: payout?.status || null,
        notes: payout?.notes || null,
      };
    });
    
    const total = payouts.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    const paid = payouts.filter(p => p.status === "paid").reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    const sent = payouts.filter(p => p.status === "sent").reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    const pending = payouts.filter(p => p.status === "pending").reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    const offset = payouts.filter(p => p.status === "offset").reduce((sum, p) => sum + Math.abs(parseFloat(p.amount || "0")), 0);
    
    return { overview, total, paid, sent, pending, offset };
  }, [payouts]);

  return (
    <Layout>
      <div className="container mx-auto py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Mine Utbetalinger</h1>
          <p className="text-muted-foreground mt-2">Oversikt over dine månedlige utbetalinger</p>
        </div>

        {/* Year selector */}
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

        {/* Summary Cards */}
        {yearlyOverview && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Netto {selectedYear}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${yearlyOverview.total < 0 ? "text-red-600" : ""}`}>
                  {yearlyOverview.total.toFixed(2)} NOK
                </div>
                <p className="text-xs text-muted-foreground">
                  Total etter motregning
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Utbetalt
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {(yearlyOverview.paid + yearlyOverview.sent).toFixed(2)} NOK
                </div>
                <p className="text-xs text-muted-foreground">
                  Betalt + Sendt
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Venter
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{yearlyOverview.pending.toFixed(2)} NOK</div>
                <p className="text-xs text-muted-foreground">
                  Venter på utbetaling
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Motregner
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">-{yearlyOverview.offset.toFixed(2)} NOK</div>
                <p className="text-xs text-muted-foreground">
                  Negativ balanse
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Overview Grid */}
        {yearlyOverview && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Månedsoversikt {selectedYear}</CardTitle>
              <CardDescription>
                Status for hver måned i året
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {yearlyOverview.overview.map((month, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="font-medium text-sm mb-1">{month.month}</div>
                    <div className="text-2xl font-bold">
                      {month.amount ? `${parseFloat(month.amount.toString()).toFixed(0)},-` : "-"}
                    </div>
                    {month.status && (
                      <div className="mt-2">
                        {getStatusBadge(month.status)}
                      </div>
                    )}
                    {month.notes && (
                      <div className="mt-2 text-xs text-muted-foreground truncate" title={month.notes}>
                        {month.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detaljert oversikt</CardTitle>
            <CardDescription>
              Alle registrerte utbetalinger for {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption>
                {isLoading ? "Laster..." : `${payouts?.length || 0} utbetalinger funnet`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Måned</TableHead>
                  <TableHead className="text-right">Beløp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notater</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts?.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {MONTHS.find(m => m.value === payout.month)?.label} {payout.year}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(payout.amount || "0").toFixed(2)} {payout.currency}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={payout.notes || ""}>
                      {payout.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!payouts || payouts.length === 0) && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Ingen utbetalinger registrert for {selectedYear}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}