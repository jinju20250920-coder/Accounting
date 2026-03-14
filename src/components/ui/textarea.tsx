import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'excel'
  suppressHydrationWarning?: boolean
  'data-field'?: string
  'data-entry-id'?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = 'default', suppressHydrationWarning, 'data-field': dataField, 'data-entry-id': dataEntryId, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          variant === 'excel'
            ? // Excel 风格：无圆角、无阴影、紧凑、共用边框（无边框，让表格处理边框，垂直居中）
              "w-full min-w-0 rounded-none border-0 bg-transparent px-1.5 text-sm outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 resize-none flex items-center justify-center"
            : // 默认风格
              "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        suppressHydrationWarning={suppressHydrationWarning ?? true}
        data-field={dataField}
        data-entry-id={dataEntryId}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }