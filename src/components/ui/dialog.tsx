"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Button } from "./button"

// Context to pass close handler to DialogContent
const DialogContext = React.createContext<{
  onClose?: () => void
}>({})

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const handleClose = () => onOpenChange?.(false)

  // 阻止对话框内部点击时关闭
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* 对话框内容 */}
          <div
            className="relative z-10 w-full transform rounded-lg bg-white transition-all"
            onClick={handleContentClick}
            style={{
              margin: "20px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto"
            }}
          >
            <DialogContext.Provider value={{ onClose: handleClose }}>
              {children}
            </DialogContext.Provider>
          </div>
        </div>
      )}
    </>
  )
}

interface DialogTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const DialogTrigger = ({ children }: DialogTriggerProps) => {
  return <>{children}</>
}

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

const DialogContent = ({ className, children, style }: DialogContentProps) => {
  const { onClose } = React.useContext(DialogContext)

  return (
    <div className={cn("relative p-6", className)} style={style}>
      {/* 关闭按钮 */}
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-7 w-7 rounded-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
          onClick={onClose}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      )}
      {children}
    </div>
  )
}

interface DialogHeaderProps {
  className?: string
  children: React.ReactNode
}

const DialogHeader = ({ className, children }: DialogHeaderProps) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left pr-8",
      className
    )}
  >
    {children}
  </div>
)

interface DialogFooterProps {
  className?: string
  children: React.ReactNode
}

const DialogFooter = ({ className, children }: DialogFooterProps) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
  >
    {children}
  </div>
)

interface DialogTitleProps {
  className?: string
  children: React.ReactNode
}

const DialogTitle = ({ className, children }: DialogTitleProps) => (
  <h2
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
  >
    {children}
  </h2>
)

interface DialogDescriptionProps {
  className?: string
  children: React.ReactNode
}

const DialogDescription = ({ className, children }: DialogDescriptionProps) => (
  <p className={cn("text-sm text-muted-foreground", className)}>
    {children}
  </p>
)

export {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
}
