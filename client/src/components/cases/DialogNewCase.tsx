import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "@/hooks/use-language";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";

type DialogNewCaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
};

export function DialogNewCase({ open, onOpenChange, onSubmit }: DialogNewCaseProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  
  // Hent alle brukere hvis admin
  const { data: users } = useQuery({
    queryKey: ['/api/admin/users'],
    enabled: !!user?.isAdmin, // Bare kjør spørringen hvis brukeren er admin
  });
  
  // Form schema
  const baseSchema = {
    title: z.string().min(3, {
      message: t("validation.titleMinLength", { count: 3 }),
    }).max(100, {
      message: t("validation.titleMaxLength", { count: 100 }),
    }),
    category: z.enum(["technical", "billing", "account", "calendar", "other"], {
      errorMap: () => ({ message: t("validation.categoryRequired") }),
    }),
    priority: z.enum(["low", "medium", "high"], {
      errorMap: () => ({ message: t("validation.priorityRequired") }),
    }),
    message: z.string().min(1, {
      message: t("validation.messageMinLength", { count: 1 }),
    }).max(1000, {
      message: t("validation.messageMaxLength", { count: 1000 }),
    }),
  };
  
  // Hvis admin, legg til userId felt
  const formSchema = user?.isAdmin 
    ? z.object({
        ...baseSchema,
        userId: z.number().optional(),
      })
    : z.object(baseSchema);
  
  // Create form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      category: "",
      priority: "medium",
      message: "",
      ...(user?.isAdmin ? { userId: undefined } : {}),
    },
  });

  // Håndter endring av targetUserId
  useEffect(() => {
    if (targetUserId) {
      form.setValue('userId', targetUserId);
    } else {
      form.setValue('userId', undefined);
    }
  }, [targetUserId, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // For admin, send med valgt userId hvis det er valgt
    onSubmit({
      ...values,
      ...(user?.isAdmin && targetUserId ? { userId: targetUserId } : {}),
    });
  };

  const resetForm = () => {
    setTargetUserId(null);
    form.reset({
      title: "",
      category: "",
      priority: "medium",
      message: "",
      ...(user?.isAdmin ? { userId: undefined } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-h-screen overflow-y-auto md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("caseManagement.newCaseTitle")}</DialogTitle>
          <DialogDescription>
            {t("caseManagement.newCaseDescription")}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Brukervelger for administratorer */}
            {user?.isAdmin && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t("caseManagement.selectUser")}
                </label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={targetUserId || ""}
                  onChange={(e) => setTargetUserId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">{t("caseManagement.selectUserPlaceholder")}</option>
                  <option value={user?.id}>{t("caseManagement.createForMe")}</option>
                  
                  {users?.filter(u => !u.isAdmin).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.username}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {targetUserId 
                    ? t("caseManagement.creatingCaseForUser") 
                    : t("caseManagement.selectUserToCreate")}
                </p>
              </div>
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("caseManagement.caseTitle")}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t("caseManagement.caseTitlePlaceholder")} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("caseManagement.category")}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("caseManagement.selectCategory")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="technical">{t("caseManagement.categoryTechnical")}</SelectItem>
                      <SelectItem value="billing">{t("caseManagement.categoryBilling")}</SelectItem>
                      <SelectItem value="account">{t("caseManagement.categoryAccount")}</SelectItem>
                      <SelectItem value="calendar">{t("caseManagement.categoryCalendar")}</SelectItem>
                      <SelectItem value="other">{t("caseManagement.categoryOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("caseManagement.priority")}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("caseManagement.selectPriority")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">{t("caseManagement.priorityLow")}</SelectItem>
                      <SelectItem value="medium">{t("caseManagement.priorityMedium")}</SelectItem>
                      <SelectItem value="high">{t("caseManagement.priorityHigh")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("caseManagement.message")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("caseManagement.messagePlaceholder")} 
                      className="h-32"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit">
                {t("caseManagement.createCase")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}