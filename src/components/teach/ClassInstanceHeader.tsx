"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Clock, Settings, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";

interface ClassInstanceHeaderProps {
  classInstance: {
    id: string;
    name: string;
    enrollmentCode: string;
    status: "active" | "archived" | "upcoming" | "completed";
    period?: string;
    baseClass: {
      id: string;
      name: string;
    };
  };
}

export function ClassInstanceHeader({ classInstance }: ClassInstanceHeaderProps) {
  const { toast } = useToast();

  const copyEnrollmentCode = () => {
    navigator.clipboard.writeText(classInstance.enrollmentCode).then(() => {
      toast({
        title: "Copied!",
        description: "Enrollment code copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Could not copy enrollment code",
        variant: "destructive",
      });
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/20";
      case "upcoming": return "bg-info/10 text-info border-info/20";
      case "completed": return "bg-muted/10 text-muted-foreground border-muted/20";
      case "archived": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Link 
            href="/teach/instances" 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to All Classes
          </Link>
        </div>
        <h1 className="text-3xl lg:text-[36px] font-bold tracking-tight">
          {classInstance.name}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge 
            variant="outline" 
            className={`px-3 py-1 ${getStatusColor(classInstance.status)}`}
          >
            {classInstance.status.charAt(0).toUpperCase() + classInstance.status.slice(1)}
          </Badge>
          {classInstance.period && (
            <Badge variant="secondary" className="px-3 py-1">
              <Clock className="w-3 h-3 mr-1" />
              {classInstance.period}
            </Badge>
          )}
          <span className="text-muted-foreground">
            Based on <Link 
              href={`/teach/base-classes/${classInstance.baseClass.id}`}
              className="text-primary hover:underline"
            >
              {classInstance.baseClass.name}
            </Link>
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
          <span className="text-sm text-muted-foreground">Enrollment Code:</span>
          <code className="font-mono text-sm font-semibold">{classInstance.enrollmentCode}</code>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={copyEnrollmentCode}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/teach/instances/${classInstance.id}/settings`}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/teach/base-classes/${classInstance.baseClass.id}`}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Content
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 