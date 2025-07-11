"use client";

import React, { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from '@/components/ui/button';
import { Command as CommandIcon } from 'lucide-react'; // Alias to avoid naming conflict
import { useUIContext } from '@/context/UIContext';

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const { openFeedbackModal } = useUIContext();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      {/* Can add a button trigger if needed, but Cmd+K is the primary */}
       {/* <Button variant="outline" onClick={() => setOpen(true)}>
         <CommandIcon className="mr-2 h-4 w-4" /> Open Palette
       </Button> */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {/* Placeholder Groups/Items - Will be populated later */}
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { console.log("Navigate Dashboard"); setOpen(false); }}>Dashboard</CommandItem>
            <CommandItem onSelect={() => { console.log("Navigate Settings"); setOpen(false); }}>Settings</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { console.log("Action: Create Task"); setOpen(false); }}>Create New Task</CommandItem>
            <CommandItem onSelect={() => { openFeedbackModal({ category: 'feedback', priority: 'medium' }); setOpen(false); }}>Send Feedback</CommandItem>
            <CommandItem onSelect={() => { openFeedbackModal({ category: 'support', priority: 'medium' }); setOpen(false); }}>Get Support</CommandItem>
            <CommandItem onSelect={() => { openFeedbackModal({ category: 'bug_report', priority: 'high' }); setOpen(false); }}>Report Bug</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default CommandPalette; 