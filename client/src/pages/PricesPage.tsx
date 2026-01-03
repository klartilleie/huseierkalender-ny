import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import { useDevicePreference } from "@/hooks/use-device-preference";

interface PriceRange {
  id: number;
  name: string;
  priceFrom: string;
  priceTo: string;
  discountPercent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InsertPriceRange {
  name: string;
  priceFrom: string;
  priceTo: string;
  discountPercent: string;
  isActive: boolean;
}

export default function PricesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<PriceRange | null>(null);
  const [newPrice, setNewPrice] = useState<InsertPriceRange>({
    name: "",
    priceFrom: "",
    priceTo: "",
    discountPercent: "0",
    isActive: true,
  });

  // Fetch users for admin selection
  const { data: users = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: user?.isAdmin === true,
  });

  // Fetch prices - for admins when user selected, for regular users always
  const { data: prices, isLoading } = useQuery<PriceRange[]>({
    queryKey: ["/api/prices"],
    enabled: user?.isAdmin ? selectedUserId !== null : true,
  });

  // Create price mutation
  const createPriceMutation = useMutation({
    mutationFn: async (priceData: InsertPriceRange) => {
      const response = await fetch("/api/prices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(priceData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Kunne ikke opprette prisintervall");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      setIsCreateDialogOpen(false);
      setNewPrice({
        name: "",
        priceFrom: "",
        priceTo: "",
        discountPercent: "0",
        isActive: true,
      });
      toast({
        title: "Prisintervall opprettet",
        description: "Nytt prisintervall er lagt til i systemet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil ved oppretting",
        description: error?.message || "Kunne ikke opprette prisintervall",
        variant: "destructive",
      });
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async (priceData: PriceRange) => {
      const response = await fetch(`/api/prices/${priceData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(priceData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Kunne ikke oppdatere prisintervall");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      setIsEditDialogOpen(false);
      setSelectedPrice(null);
      toast({
        title: "Prisintervall oppdatert",
        description: "Endringene er lagret.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil ved oppdatering",
        description: error?.message || "Kunne ikke oppdatere prisintervall",
        variant: "destructive",
      });
    },
  });

  // Delete price mutation
  const deletePriceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/prices/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Kunne ikke slette prisintervall");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({
        title: "Prisintervall slettet",
        description: "Prisintervallet er fjernet fra systemet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil ved sletting",
        description: error?.message || "Kunne ikke slette prisintervall",
        variant: "destructive",
      });
    },
  });

  const handleCreatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceData = {
      ...newPrice,
      userId: selectedUserId || user?.id
    };
    createPriceMutation.mutate(priceData);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPrice) {
      updatePriceMutation.mutate(selectedPrice);
    }
  };

  const handleDeletePrice = (id: number) => {
    if (confirm("Vil du slette dette prisintervallet?\n\nDette kan ikke angres.")) {
      deletePriceMutation.mutate(id);
    }
  };

  const openEditDialog = (price: PriceRange) => {
    setSelectedPrice(price);
    setIsEditDialogOpen(true);
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    return `${parseFloat(amount).toLocaleString('no-NO')} kr`;
  };

  const { devicePreference } = useDevicePreference();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={true} onClose={() => {}} onICalClick={() => {}} />
      <div className={`flex-1 ${devicePreference === 'mobile' ? '' : 'ml-64'} overflow-hidden`}>
        <div className="container mx-auto p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-center">Prisintervaller</h1>
        </div>
      </div>

      {/* User Selector for Admin */}
      {user?.isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Velg bruker</CardTitle>
            <CardDescription>
              Velg hvilken bruker prislisten skal gjeldre for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(Number(value))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Velg en bruker..." />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* No user selected message */}
      {user?.isAdmin && !selectedUserId && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Velg en bruker for å se deres prisintervaller</p>
          </CardContent>
        </Card>
      )}

      {/* Price ranges content */}
      {(selectedUserId || !user?.isAdmin) && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div></div>
            {user?.isAdmin && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
                <Plus size={16} />
                Nytt prisintervall
              </Button>
            )}
          </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2 justify-center">
{t("prices.yourPricesPerDay")}
            {!user?.isAdmin && (
              <Badge variant="secondary">{t("prices.readOnlyBadge")}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t("prices.year")}</TableHead>
                    <TableHead className="font-semibold">{t("prices.priceFrom")}</TableHead>
                    <TableHead className="font-semibold">{t("prices.priceTo")}</TableHead>
                    <TableHead className="font-semibold">{t("prices.discount")}</TableHead>
                    <TableHead className="font-semibold">{t("prices.status")}</TableHead>
                    {user?.isAdmin && <TableHead className="font-semibold text-right">{t("prices.actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices?.filter(price => 
                    user?.isAdmin 
                      ? (selectedUserId ? price.userId === selectedUserId : false)
                      : price.userId === user?.id
                  ).map((price) => (
                    <TableRow key={price.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{price.name}</TableCell>
                      <TableCell className="text-green-600 font-mono">
                        {formatCurrency(price.priceFrom)}
                      </TableCell>
                      <TableCell className="text-green-600 font-mono">
                        {formatCurrency(price.priceTo)}
                      </TableCell>
                      <TableCell className="text-orange-600 font-mono font-semibold">
                        {parseFloat(price.discountPercent)}%
                      </TableCell>
                      <TableCell>
                        {price.isActive ? (
                          <Badge variant="default" className="bg-green-600">{t("prices.active")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("prices.inactive")}</Badge>
                        )}
                      </TableCell>
                      {user?.isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(price)}
                              title="Rediger prisintervall"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeletePrice(price.id)}
                              title="Slett prisintervall"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {(!prices?.filter(price => 
                    user?.isAdmin 
                      ? (selectedUserId ? price.userId === selectedUserId : false)
                      : price.userId === user?.id
                  ).length) && (
                    <TableRow>
                      <TableCell colSpan={user?.isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                        {user?.isAdmin && !selectedUserId 
                          ? t("prices.selectUserMessage")
                          : t("prices.noPricesFound")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      )}

      {/* Create Price Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" aria-describedby="create-price-description">
          <DialogHeader>
            <DialogTitle>Opprett nytt prisintervall</DialogTitle>
            <div id="create-price-description" className="sr-only">
              Dialog for å opprette nytt prisintervall med navn, priser og rabatt
            </div>
          </DialogHeader>
          <form onSubmit={handleCreatePrice}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Navn</Label>
                <Input
                  id="name"
                  className="col-span-3"
                  value={newPrice.name}
                  onChange={(e) => setNewPrice({ ...newPrice, name: e.target.value })}
                  placeholder="F.eks. 'Standard pakke'"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priceFrom" className="text-right">Pris fra (kr)</Label>
                <Input
                  id="priceFrom"
                  type="number"
                  step="0.01"
                  className="col-span-3"
                  value={newPrice.priceFrom}
                  onChange={(e) => setNewPrice({ ...newPrice, priceFrom: e.target.value })}
                  placeholder="1000"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priceTo" className="text-right">Pris til (kr)</Label>
                <Input
                  id="priceTo"
                  type="number"
                  step="0.01"
                  className="col-span-3"
                  value={newPrice.priceTo}
                  onChange={(e) => setNewPrice({ ...newPrice, priceTo: e.target.value })}
                  placeholder="2000"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="discountPercent" className="text-right">Rabatt (%)</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="col-span-3"
                  value={newPrice.discountPercent}
                  onChange={(e) => setNewPrice({ ...newPrice, discountPercent: e.target.value })}
                  placeholder="15"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">Aktiv</Label>
                <div className="col-span-3">
                  <Switch
                    id="isActive"
                    checked={newPrice.isActive}
                    onCheckedChange={(checked) => setNewPrice({ ...newPrice, isActive: checked })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Avbryt
              </Button>
              <Button type="submit" disabled={createPriceMutation.isPending}>
                {createPriceMutation.isPending ? "Oppretter..." : "Opprett"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" aria-describedby="edit-price-description">
          <DialogHeader>
            <DialogTitle>Rediger prisintervall</DialogTitle>
            <div id="edit-price-description" className="sr-only">
              Dialog for å redigere eksisterende prisintervall
            </div>
          </DialogHeader>
          {selectedPrice && (
            <form onSubmit={handleUpdatePrice}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Navn</Label>
                  <Input
                    id="edit-name"
                    className="col-span-3"
                    value={selectedPrice.name}
                    onChange={(e) => setSelectedPrice({ ...selectedPrice, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-priceFrom" className="text-right">Pris fra (kr)</Label>
                  <Input
                    id="edit-priceFrom"
                    type="number"
                    step="0.01"
                    className="col-span-3"
                    value={selectedPrice.priceFrom}
                    onChange={(e) => setSelectedPrice({ ...selectedPrice, priceFrom: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-priceTo" className="text-right">Pris til (kr)</Label>
                  <Input
                    id="edit-priceTo"
                    type="number"
                    step="0.01"
                    className="col-span-3"
                    value={selectedPrice.priceTo}
                    onChange={(e) => setSelectedPrice({ ...selectedPrice, priceTo: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-discountPercent" className="text-right">Rabatt (%)</Label>
                  <Input
                    id="edit-discountPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="col-span-3"
                    value={selectedPrice.discountPercent}
                    onChange={(e) => setSelectedPrice({ ...selectedPrice, discountPercent: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-isActive" className="text-right">Aktiv</Label>
                  <div className="col-span-3">
                    <Switch
                      id="edit-isActive"
                      checked={selectedPrice.isActive}
                      onCheckedChange={(checked) => setSelectedPrice({ ...selectedPrice, isActive: checked })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={updatePriceMutation.isPending}>
                  {updatePriceMutation.isPending ? "Lagrer..." : "Lagre endringer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}