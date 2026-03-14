import { useToast as useCustomToast, ToastType } from '@/components/ui/toast'

interface ToastOptions {
  title?: string
  description?: string
  duration?: number
  type?: ToastType
}

export function useToast() {
  const { showToast } = useCustomToast()

  const toast = ({ title, description, duration = 3000, type = 'info' }: ToastOptions = {}) => {
    const message = title ? `${title}\n${description}` : description || '操作成功'
    showToast(type, message, duration)
  }

  return { toast }
}