import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from 'date-fns';
import { CalendarClock } from "lucide-react";

interface UpcomingDeadlineItemProps {
  id: string;
  assignmentName: string;
  className: string; // Class name or context
  dueDate: string; // ISO date string
  // Link to the assignment/quiz details page
  detailsUrl?: string; 
}

export function UpcomingDeadlineItem({
  id,
  assignmentName,
  className,
  dueDate,
  detailsUrl,
}: UpcomingDeadlineItemProps) {
  const formattedDueDate = dueDate ? format(parseISO(dueDate), 'PP') : 'N/A';
  const daysRemaining = dueDate ? Math.ceil((parseISO(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
            <CardTitle className="text-md font-medium truncate" title={assignmentName}>{assignmentName}</CardTitle>
            {daysRemaining !== null && (
                <span 
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${ 
                        daysRemaining < 0 ? 'bg-destructive/20 text-destructive-foreground' 
                        : daysRemaining <= 3 ? 'bg-warning/20 text-warning-foreground' 
                        : 'bg-primary/10 text-primary' // Or a less prominent color for far-off deadlines
                    }`}
                >
                    {daysRemaining < 0 ? 'Overdue' : daysRemaining === 0 ? 'Today' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}
                </span>
            )}
        </div>
        <CardDescription className="text-xs truncate" title={className}>{className}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarClock className="mr-2 h-4 w-4" />
          <span>Due: {formattedDueDate}</span>
        </div>
        {/* We can add a link here if detailsUrl is provided */}
        {/* {detailsUrl && <Button asChild size="sm" className="mt-2 w-full"><Link href={detailsUrl}>View Details</Link></Button>} */}
      </CardContent>
    </Card>
  );
} 