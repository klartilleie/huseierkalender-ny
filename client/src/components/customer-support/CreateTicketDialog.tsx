import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// Form schema for ticket creation
const ticketFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100),
  category: z.string({ required_error: "Please select a category" }),
  priority: z.string({ required_error: "Please select a priority level" }),
  message: z.string().min(5, { message: "Message must be at least 5 characters" }),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TicketFormValues) => void;
  isSubmitting?: boolean;
}

export default function CreateTicketDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: CreateTicketDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Form setup
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: "",
      category: "technical",
      priority: "medium",
      message: "",
    },
  });

  // Categories for support tickets
  const categories = [
    { value: "technical", label: t("caseManagement.categoryTechnical") },
    { value: "billing", label: t("caseManagement.categoryBilling") },
    { value: "account", label: t("caseManagement.categoryAccount") },
    { value: "information", label: t("caseManagement.categoryInformation") },
    { value: "complaint", label: t("caseManagement.categoryComplaint") },
  ];

  // Priority levels
  const priorities = [
    { value: "low", label: t("caseManagement.priorityLow") },
    { value: "medium", label: t("caseManagement.priorityMedium") },
    { value: "high", label: t("caseManagement.priorityHigh") },
  ];

  // Submit handler
  const handleSubmit = (values: TicketFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("caseManagement.newCaseTitle")}</DialogTitle>
          <DialogDescription>
            {t("caseManagement.newCaseDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("caseManagement.category")}</FormLabel>
                    <Select 
                      defaultValue={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("caseManagement.selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
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
                      defaultValue={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("caseManagement.selectPriority")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorities.map(priority => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("caseManagement.message")}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t("caseManagement.messagePlaceholder")} 
                      className="min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.processing") : t("caseManagement.submitCase")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}