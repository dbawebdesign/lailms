"use client";

import React, { useState, useMemo } from "react";
import { BaseClass } from "../../types/teach";
import { BaseClassCard } from "./BaseClassCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface BaseClassCardGridProps {
  baseClasses: BaseClass[];
  // Action handlers to be passed to BaseClassCard
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onClone: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  // Handler for a potential "Create New" button if managed at this level
  // onCreateNew?: () => void; 
}

type SortKey = "name" | "created_at" | "lengthInWeeks";
type SortOrder = "asc" | "desc";

export const BaseClassCardGrid: React.FC<BaseClassCardGridProps> = ({
  baseClasses,
  onViewDetails,
  onEdit,
  onClone,
  onArchive,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const filteredAndSortedClasses = useMemo(() => {
    let classes = [...baseClasses].filter((bc) =>
      bc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    classes.sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (sortKey === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }
      
      // Ensure consistent comparison for numbers or strings
      if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return classes;
  }, [baseClasses, searchTerm, sortKey, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  };

  if (!baseClasses || baseClasses.length === 0 && searchTerm === "") {
    return (
      <div className="text-center py-10">
        <h3 className="text-xl font-semibold">No Base Classes Yet</h3>
        <p className="text-muted-foreground">
          Get started by creating a new base class.
        </p>
        {/* Optional: Add a create new button here if not handled by parent page 
        {onCreateNew && <Button onClick={onCreateNew} className="mt-4">Create New Base Class</Button>}*/}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
        <Input
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2 items-center ml-auto">
          <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="created_at">Creation Date</SelectItem>
              <SelectItem value="lengthInWeeks">Length</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={toggleSortOrder}>
            {sortOrder === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
      </div>

      {filteredAndSortedClasses.length === 0 && searchTerm !== "" && (
         <div className="text-center py-10">
          <h3 className="text-xl font-semibold">No Matching Classes</h3>
          <p className="text-muted-foreground">
            Try a different search term or adjust your filters.
          </p>
        </div>
      )}

      {filteredAndSortedClasses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedClasses.map((bc) => (
            <BaseClassCard
              key={bc.id}
              baseClass={bc}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onClone={onClone}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}; 