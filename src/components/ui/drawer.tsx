"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Button } from "./button"

// Context to pass close handler to DrawerContent
const DrawerContext = React.createContext<{
  onClose?: () => void
}>({})

interface DrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Drawer = ({ open, onOpenChange, children }: DrawerProps) => {
  const handleClose = () => onOpenChange?.(false)

  // 阻止抽屉内部点击时关闭
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* 抽屉内容 */}
          <div
            className="relative z-10 w-full max-w-md transform rounded-l-lg bg-white transition-all duration-300 ease-in-out"
            onClick={handleContentClick}
            style={{
              maxHeight: "100vh",
              transform: open ? "translateX(0)" : "translateX(100%)",
            }}
          >
            <DrawerContext.Provider value={{ onClose: handleClose }}>
              {children}
            </DrawerContext.Provider>
          </div>
        </div>
      )}
    </>
  )
}

interface DrawerTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const DrawerTrigger = ({ children }: DrawerTriggerProps) => {
  return <>{children}</>
}

const DrawerPortal = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

interface DrawerContentProps {
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

const DrawerContent = ({ className, children, style }: DrawerContentProps) => {
  const { onClose } = React.useContext(DrawerContext)

  return (
    <div className={cn("relative flex flex-col h-full", className)} style={style}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex-1 text-left">
          {/* 标题会在 DrawerHeader 中定义 */}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
            onClick={onClose}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}

interface DrawerHeaderProps {
  className?: string
  children: React.ReactNode
}

const DrawerHeader = ({ className, children }: DrawerHeaderProps) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-left",
      className
    )}
  >
    {children}
  </div>
)

interface DrawerFooterProps {
  className?: string
  children: React.ReactNode
}

const DrawerFooter = ({ className, children }: DrawerFooterProps) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t",
      className
    )}
  >
    {children}
  </div>
)

interface DrawerTitleProps {
  className?: string
  children: React.ReactNode
}

const DrawerTitle = ({ className, children }: DrawerTitleProps) => (
  <h2
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
  >
    {children}
  </h2>
)

interface DrawerDescriptionProps {
  className?: string
  children: React.ReactNode
}

const DrawerDescription = ({ className, children }: DrawerDescriptionProps) => (
  <p className={cn("text-sm text-muted-foreground", className)}>
    {children}
  </p>
)

export {
  Drawer,
  DrawerPortal,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
}
