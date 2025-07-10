"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface TableProps extends React.ComponentProps<"table"> {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

function Table({ className, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
      role="region"
      aria-label={props['aria-label'] || "Data table"}
      tabIndex={0}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        role="table"
        {...props}
      />
    </div>
  )
}

interface TableHeaderProps extends React.ComponentProps<"thead"> {}

function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

interface TableBodyProps extends React.ComponentProps<"tbody"> {}

function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

interface TableFooterProps extends React.ComponentProps<"tfoot"> {}

function TableFooter({ className, ...props }: TableFooterProps) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

interface TableRowProps extends React.ComponentProps<"tr"> {}

function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

interface TableHeadProps extends React.ComponentProps<"th"> {
  scope?: "col" | "row" | "colgroup" | "rowgroup";
  'aria-sort'?: "none" | "ascending" | "descending" | "other";
}

function TableHead({ className, scope = "col", ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      scope={scope}
      {...props}
    />
  )
}

interface TableCellProps extends React.ComponentProps<"td"> {
  scope?: "row" | "col" | "rowgroup" | "colgroup";
}

function TableCell({ className, scope, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      scope={scope}
      {...props}
    />
  )
}

interface TableCaptionProps extends React.ComponentProps<"caption"> {}

function TableCaption({
  className,
  ...props
}: TableCaptionProps) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  type TableProps,
  type TableHeadProps,
  type TableCellProps,
}
