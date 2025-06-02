"use client";

import React from "react";
import { BaseClass } from "@/types/teach";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react"; // Or any other icon like DotsThreeVertical

interface BaseClassCardProps {
  baseClass: BaseClass;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onClone: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export const BaseClassCard: React.FC<BaseClassCardProps> = ({
  baseClass,
  onViewDetails,
  onEdit,
  onClone,
  onArchive,
  onDelete,
}) => {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-start justify-between p-6">
        <div>
          <CardTitle className="text-lg font-medium">{baseClass.name}</CardTitle>
          {baseClass.description && (
            <CardDescription className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {baseClass.description}
            </CardDescription>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 ml-2">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewDetails(baseClass.id)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(baseClass.id)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClone(baseClass.id)}>
              Clone
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onArchive(baseClass.id)}
              className="text-yellow-600 hover:!text-yellow-700 focus:text-yellow-700 focus:bg-yellow-50"
            >
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(baseClass.id)}
              className="text-red-600 hover:!text-red-700 focus:text-red-700 focus:bg-red-50"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow p-6 pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {baseClass.subject && (
            <>
              <span className="font-medium text-foreground">Subject:</span>
              <span className="text-muted-foreground">{baseClass.subject}</span>
            </>
          )}
          {baseClass.gradeLevel && (
            <>
              <span className="font-medium text-foreground">Grade:</span>
              <span className="text-muted-foreground">{baseClass.gradeLevel}</span>
            </>
          )}
          <>
            <span className="font-medium text-foreground">Length:</span>
            <span className="text-muted-foreground">{baseClass.lengthInWeeks} weeks</span>
          </>
          <>
            <span className="font-medium text-foreground">Created:</span>
            <span className="text-muted-foreground">{new Date(baseClass.creationDate).toLocaleDateString()}</span>
          </>
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0">
        <Button
          variant="outline"
          className="w-full py-3 px-6 border-gray-300 dark:border-gray-600 hover:bg-accent hover:text-accent-foreground"
          onClick={() => onViewDetails(baseClass.id)}
        >
          View Class
        </Button>
      </CardFooter>
    </Card>
  );
}; 