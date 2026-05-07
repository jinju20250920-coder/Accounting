import * as React from "react"
import { Search, CheckCircle } from "lucide-react"

// 简单的 Command 组件实现，避免依赖外部包
const Command = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-white text-sm ${className}`}
    {...props}
  />
))
Command.displayName = "Command"

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <input
      ref={ref}
      className={`flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  </div>
))
CommandInput.displayName = "CommandInput"

const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`py-6 text-center text-sm ${className}`}
    {...props}
  />
))
CommandEmpty.displayName = "CommandEmpty"

const CommandGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`overflow-hidden p-2 ${className}`}
    {...props}
  />
))
CommandGroup.displayName = "CommandGroup"

const CommandItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string
    onSelect?: () => void
  }
>(({ className, value, onSelect, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground ${className}`}
    onClick={onSelect}
    {...props}
  />
))
CommandItem.displayName = "CommandItem"

const CommandList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`overflow-y-auto overflow-x-hidden ${className}`}
    {...props}
  />
))
CommandList.displayName = "CommandList"

export { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList }