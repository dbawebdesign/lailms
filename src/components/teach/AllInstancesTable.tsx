"use client";

import React, { useState, useMemo } from "react";
import { EnrichedClassInstance } from "../../types/teach";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Copy, Edit2, ArchiveIcon, Users, ExternalLink, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface AllInstancesTableProps {
  instances: EnrichedClassInstance[];
  onEditInstance: (instanceId: string) => void;
  onArchiveInstance: (instanceId: string) => void;
  onViewStudents: (instanceId: string) => void;
  onViewInstanceDetails: (instance: EnrichedClassInstance) => void; // Navigates to base class detail page
}

type SortableColumn = keyof EnrichedClassInstance | 'enrolledStudents'; // Add pseudo-column for sorting

export const AllInstancesTable: React.FC<AllInstancesTableProps> = ({
  instances,
  onEditInstance,
  onArchiveInstance,
  onViewStudents,
  onViewInstanceDetails,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortableColumn>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: `${fieldName} Copied!`,
        description: `${text} copied to clipboard.`,
      });
    }).catch(err => {
      console.error("Failed to copy:", err);
      toast({ title: "Copy Failed", description: "Could not copy text to clipboard.", variant: "destructive" });
    });
  };

  const filteredAndSortedInstances = useMemo(() => {
    let filtered = [...instances];

    if (statusFilter !== "all") {
      filtered = filtered.filter(inst => inst.status === statusFilter);
    }

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(inst => 
        inst.name.toLowerCase().includes(lowerSearchTerm) ||
        (inst.base_class?.name || '').toLowerCase().includes(lowerSearchTerm) ||
        inst.enrollment_code.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Sorting logic
    filtered.sort((a, b) => {
      let valA_raw: any = a[sortColumn as keyof EnrichedClassInstance];
      let valB_raw: any = b[sortColumn as keyof EnrichedClassInstance];

      if (sortColumn === 'enrolledStudents') {
        valA_raw = 0; 
        valB_raw = 0;
      }
      
      if (sortColumn === "created_at" || sortColumn === "start_date" || sortColumn === "end_date") {
        valA_raw = a[sortColumn] ? new Date(a[sortColumn]!).getTime() : 0;
        valB_raw = b[sortColumn] ? new Date(b[sortColumn]!).getTime() : 0;
      }

      let valA_processed: string | number;
      let valB_processed: string | number;

      if (typeof valA_raw === 'string') {
        valA_processed = valA_raw.toLowerCase();
      } else if (typeof valA_raw === 'number') {
        valA_processed = valA_raw;
      } else {
        // Default for null, undefined, or other types
        valA_processed = (typeof valB_raw === 'string' || valB_raw === null || valB_raw === undefined) ? "" : 0;
      }

      if (typeof valB_raw === 'string') {
        valB_processed = valB_raw.toLowerCase();
      } else if (typeof valB_raw === 'number') {
        valB_processed = valB_raw;
      } else {
        // Default for null, undefined, or other types
        valB_processed = (typeof valA_raw === 'string' || valA_raw === null || valA_raw === undefined) ? "" : 0;
      }
      
      // Ensure types are consistent for comparison if one became string and other number due to defaulting
      if (typeof valA_processed !== typeof valB_processed) {
        // Prioritize string comparison if one is a string, convert number to string
        if (typeof valA_processed === 'string') {
            valB_processed = String(valB_processed);
        } else {
            valA_processed = String(valA_processed);
        }
      }

      if (valA_processed < valB_processed) return sortOrder === "asc" ? -1 : 1;
      if (valA_processed > valB_processed) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [instances, searchTerm, statusFilter, sortColumn, sortOrder]);

  const getStatusBadgeVariant = (status: EnrichedClassInstance["status"]) => {
    switch (status) {
      case "active": return "default";
      case "upcoming": return "secondary";
      case "completed": return "outline";
      case "archived": return "destructive";
      default: return "secondary";
    }
  };
  
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  if (!instances || instances.length === 0 && !searchTerm && statusFilter === "all") {
    return (
      <div className="py-10 text-center">
        <h3 className="text-xl font-semibold text-muted-foreground">No Class Instances Found</h3>
        <p className="text-muted-foreground mt-2">You haven't created or been assigned to any class instances yet.</p>
        {/* Optional: Link to base classes page to create one? */}
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-1 bg-card rounded-lg shadow-sm border">
            <Input 
                placeholder="Search by name, base class, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs h-9"
            />
            <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

      {filteredAndSortedInstances.length === 0 ? (
        <div className="py-10 text-center">
          <h3 className="text-lg font-medium text-muted-foreground">No instances match your filters.</h3>
        </div>
      ) : (
        <Table>
          <TableHeader>
            {/* Implement clickable sortable headers */}
            <TableRow>
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 font-semibold">Instance Name {sortColumn === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</TableHead>
              <TableHead className="font-semibold">Base Class</TableHead>
              <TableHead className="font-semibold">Enroll. Code</TableHead>
              <TableHead onClick={() => handleSort('status')} className="cursor-pointer hover:bg-muted/50 font-semibold">Status {sortColumn === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}</TableHead>
              <TableHead onClick={() => handleSort('start_date')} className="cursor-pointer hover:bg-muted/50 font-semibold">Start Date {sortColumn === 'start_date' && (sortOrder === 'asc' ? '↑' : '↓')}</TableHead>
              <TableHead className="font-semibold">Period</TableHead>
              <TableHead className="text-right font-semibold">Enrolled</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedInstances.map((instance) => (
              <TableRow key={instance.id} className="hover:bg-muted/50">
                <TableCell className="font-medium text-foreground py-3">{instance.name}</TableCell>
                <TableCell className="text-muted-foreground py-3">
                    <Button variant="link" className="p-0 h-auto text-muted-foreground hover:text-primary" onClick={() => onViewInstanceDetails(instance)}>
                        {instance.base_class?.name || 'N/A'} <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                </TableCell>
                <TableCell className="text-muted-foreground py-3">
                  <div className="flex items-center gap-1">
                    <span>{instance.enrollment_code}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(instance.enrollment_code, "Enrollment Code")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant={getStatusBadgeVariant(instance.status)} className="capitalize text-xs px-2 py-0.5">
                    {instance.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground py-3">
                  {instance.start_date ? format(new Date(instance.start_date), "MMM d, yyyy") : "N/A"}
                </TableCell>
                <TableCell className="text-muted-foreground py-3">N/A</TableCell>
                <TableCell className="text-right text-muted-foreground py-3">0 / ∞</TableCell>
                <TableCell className="text-right py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onViewInstanceDetails(instance)}>
                        <ExternalLink className="mr-2 h-4 w-4" /> View Base Class
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditInstance(instance.id)}>
                        <Edit2 className="mr-2 h-4 w-4" /> Manage Instance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewStudents(instance.id)}>
                        <Users className="mr-2 h-4 w-4" /> Manage Students
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {instance.status !== "archived" && (
                        <DropdownMenuItem onClick={() => onArchiveInstance(instance.id)} className="text-yellow-600 hover:!text-yellow-700 focus:text-yellow-700 focus:bg-yellow-50">
                          <ArchiveIcon className="mr-2 h-4 w-4" /> Archive Instance
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}; 