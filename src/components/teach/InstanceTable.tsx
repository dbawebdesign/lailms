"use client";

import React from "react";
import { ClassInstance } from "../../types/teach";
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
import { MoreHorizontal, Copy, Eye, Edit2, ArchiveIcon, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useEnrollmentCodeClipboard } from "@/hooks/useClipboard";

interface InstanceTableProps {
  instances: ClassInstance[];
  baseClassId: string; // For context, might be used for some actions
  onEditInstance: (instanceId: string) => void;
  onArchiveInstance: (instanceId: string) => void;
  onViewStudents: (instanceId: string) => void; // Placeholder for future student management
}

export const InstanceTable: React.FC<InstanceTableProps> = ({
  instances,
  // baseClassId, // available if needed
  onEditInstance,
  onArchiveInstance,
  onViewStudents,
}) => {
  const { toast } = useToast();
  const { copy: copyToClipboard } = useEnrollmentCodeClipboard();

  if (!instances || instances.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        No class instances found for this base class.
      </div>
    );
  }

  const getStatusBadgeVariant = (status: ClassInstance["status"]) => {
    switch (status) {
      case "active": return "default";
      case "upcoming": return "secondary";
      case "completed": return "outline";
      case "archived": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-semibold">Instance Name</TableHead>
          <TableHead className="font-semibold">Enrollment Code</TableHead>
          <TableHead className="font-semibold">Status</TableHead>
          <TableHead className="font-semibold">Dates (Start - End)</TableHead>
          <TableHead className="font-semibold">Period</TableHead>
          <TableHead className="text-right font-semibold">Capacity</TableHead>
          <TableHead className="text-right font-semibold">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((instance) => (
          <TableRow key={instance.id} className="hover:bg-muted/50">
            <TableCell className="font-medium text-foreground">{instance.name}</TableCell>
            <TableCell className="text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{instance.enrollment_code}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(instance.enrollment_code, "Enrollment Code")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(instance.status)} className="capitalize">
                {instance.status}
              </Badge>
            </TableCell>
            <TableCell>
              {instance.start_date ? format(new Date(instance.start_date), "MMM d, yyyy") : "N/A"}
              {" - "}
              {instance.end_date ? format(new Date(instance.end_date), "MMM d, yyyy") : "N/A"}
            </TableCell>
            <TableCell>N/A</TableCell>
            <TableCell className="text-right">N/A</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  {/* <DropdownMenuItem onClick={() => console.log("View Instance Details:", instance.id)}>
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={() => onEditInstance(instance.id)}>
                    <Edit2 className="mr-2 h-4 w-4" /> Manage Instance
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewStudents(instance.id)}>
                    <Users className="mr-2 h-4 w-4" /> Manage Students
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {instance.status !== "archived" && (
                    <DropdownMenuItem 
                      onClick={() => onArchiveInstance(instance.id)}
                      className="text-yellow-600 hover:!text-yellow-700 focus:text-yellow-700 focus:bg-yellow-50"
                    >
                      <ArchiveIcon className="mr-2 h-4 w-4" /> Archive Instance
                    </DropdownMenuItem>
                  )}
                   {/* Add Unarchive option if needed */}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}; 