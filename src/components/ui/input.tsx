import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  variant?: 'default' | 'excel'
  'data-field'?: string
  'data-entry-id'?: string
}

function Input({ className, type, variant = 'default', 'data-field': dataField, 'data-entry-id': dataEntryId, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-variant={variant}
      data-field={dataField}
      data-entry-id={dataEntryId}
      className={cn(
        variant === 'excel'
          ? // Excel 风格：无圆角、无阴影、紧凑、共用边框（无边框，让表格处理边框）
            "h-7 w-full min-w-0 rounded-none border-0 bg-transparent px-1.5 py-0.5 text-sm outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50"
          : // 默认风格
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // 移除数字输入框的上下箭头
        type === 'number' && "appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance:textfield]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
