import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} aria-labelledby={title ? `toast-${id}-title` : undefined} aria-describedby={description ? `toast-${id}-description` : undefined}>
            <div className="grid gap-1">
              {title && <ToastTitle id={`toast-${id}-title`}>{title}</ToastTitle>}
              {description && (
                <ToastDescription id={`toast-${id}-description`}>
                  {typeof description === 'string' 
                    ? description 
                    : description instanceof Error 
                      ? description.message || 'En feil oppstod' 
                      : typeof description === 'object' && description !== null && description !== undefined
                        ? (description as any)?.message || 'Operasjon fullført'
                        : 'Operasjon fullført'}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
