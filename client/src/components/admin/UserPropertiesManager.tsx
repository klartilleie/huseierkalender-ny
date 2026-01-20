import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Building,
  Plus,
  Trash2,
  Edit,
  Users,
  Star,
  Check
} from "lucide-react";

interface UserProperty {
  id: number;
  userId: number;
  beds24PropId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserPropertiesManagerProps {
  users: User[];
}

export default function UserPropertiesManager({ users }: UserPropertiesManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<UserProperty | null>(null);
  const [newProperty, setNewProperty] = useState({
    beds24PropId: "",
    name: "",
    isDefault: false,
    isActive: true
  });
  
  const { data: properties = [], isLoading } = useQuery<UserProperty[]>({
    queryKey: ["userProperties", selectedUser],
    queryFn: async () => {
      if (!selectedUser) return [];
      const response = await apiRequest("GET", `/api/admin/user-properties?userId=${selectedUser}`);
      return response.json();
    },
    enabled: !!selectedUser,
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/user-properties", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProperties", selectedUser] });
      setIsAddDialogOpen(false);
      setNewProperty({ beds24PropId: "", name: "", isDefault: false, isActive: true });
      toast({
        title: "Eiendom lagt til",
        description: "Eiendommen ble lagt til for brukeren",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke legge til eiendom",
        variant: "destructive",
      });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/user-properties/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProperties", selectedUser] });
      setEditingProperty(null);
      toast({
        title: "Eiendom oppdatert",
        description: "Eiendommen ble oppdatert",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke oppdatere eiendom",
        variant: "destructive",
      });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/user-properties/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProperties", selectedUser] });
      toast({
        title: "Eiendom slettet",
        description: "Eiendommen ble fjernet",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke slette eiendom",
        variant: "destructive",
      });
    },
  });
  
  const handleCreate = () => {
    if (!selectedUser || !newProperty.beds24PropId || !newProperty.name) {
      toast({
        title: "Manglende informasjon",
        description: "Fyll inn alle påkrevde felt",
        variant: "destructive",
      });
      return;
    }
    
    createMutation.mutate({
      userId: selectedUser,
      ...newProperty
    });
  };
  
  const handleUpdate = () => {
    if (!editingProperty) return;
    
    updateMutation.mutate({
      id: editingProperty.id,
      data: {
        beds24PropId: editingProperty.beds24PropId,
        name: editingProperty.name,
        isDefault: editingProperty.isDefault,
        isActive: editingProperty.isActive
      }
    });
  };
  
  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : "Ukjent bruker";
  };
  
  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="h-5 w-5 text-green-600 dark:text-green-400" />
            Administrer brukereiendommer
          </CardTitle>
          <CardDescription>
            Legg til og administrer flere eiendommer (Property ID) for hver bruker
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-md">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                Velg bruker
              </Label>
              <Select 
                value={selectedUser?.toString() || ""} 
                onValueChange={(value) => setSelectedUser(parseInt(value))}
              >
                <SelectTrigger className="h-12 text-base border-2 border-green-300 dark:border-green-700 bg-white dark:bg-slate-800">
                  <SelectValue placeholder="Velg bruker..." />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => !u.isAdmin).map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-600" />
                        {user.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedUser && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Legg til eiendom
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Legg til ny eiendom</DialogTitle>
                    <DialogDescription>
                      Legg til en ny Beds24 eiendom for {getUserName(selectedUser)}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="propId">Beds24 Property ID</Label>
                      <Input
                        id="propId"
                        value={newProperty.beds24PropId}
                        onChange={(e) => setNewProperty({ ...newProperty, beds24PropId: e.target.value })}
                        placeholder="F.eks. 123456"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="propName">Eiendomsnavn</Label>
                      <Input
                        id="propName"
                        value={newProperty.name}
                        onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                        placeholder="F.eks. Hytte i Fjorden"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="isDefault">Sett som standard</Label>
                      <Switch
                        id="isDefault"
                        checked={newProperty.isDefault}
                        onCheckedChange={(checked) => setNewProperty({ ...newProperty, isDefault: checked })}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Avbryt
                    </Button>
                    <Button 
                      onClick={handleCreate}
                      disabled={createMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Legg til
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>
      
      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Eiendommer for {getUserName(selectedUser)}
            </CardTitle>
            <CardDescription>
              {properties.length} eiendom(mer) registrert
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Laster eiendommer...
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ingen eiendommer registrert for denne brukeren
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Navn</TableHead>
                    <TableHead>Property ID</TableHead>
                    <TableHead className="text-center">Standard</TableHead>
                    <TableHead className="text-center">Aktiv</TableHead>
                    <TableHead className="text-center">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property) => (
                    <TableRow key={property.id}>
                      <TableCell className="font-medium">{property.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{property.beds24PropId}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {property.isDefault ? (
                          <Star className="h-5 w-5 text-yellow-500 mx-auto" fill="currentColor" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {property.isActive ? (
                          <Badge className="bg-green-500">Aktiv</Badge>
                        ) : (
                          <Badge variant="secondary">Inaktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingProperty(property)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteMutation.mutate(property.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Edit property dialog */}
      <Dialog open={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger eiendom</DialogTitle>
            <DialogDescription>
              Oppdater informasjon om eiendommen
            </DialogDescription>
          </DialogHeader>
          
          {editingProperty && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editPropId">Beds24 Property ID</Label>
                <Input
                  id="editPropId"
                  value={editingProperty.beds24PropId}
                  onChange={(e) => setEditingProperty({ ...editingProperty, beds24PropId: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editPropName">Eiendomsnavn</Label>
                <Input
                  id="editPropName"
                  value={editingProperty.name}
                  onChange={(e) => setEditingProperty({ ...editingProperty, name: e.target.value })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="editIsDefault">Standard eiendom</Label>
                <Switch
                  id="editIsDefault"
                  checked={editingProperty.isDefault}
                  onCheckedChange={(checked) => setEditingProperty({ ...editingProperty, isDefault: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="editIsActive">Aktiv</Label>
                <Switch
                  id="editIsActive"
                  checked={editingProperty.isActive}
                  onCheckedChange={(checked) => setEditingProperty({ ...editingProperty, isActive: checked })}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProperty(null)}>
              Avbryt
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Lagre endringer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
