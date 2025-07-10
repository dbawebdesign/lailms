import Link from 'next/link';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Avatar component not found, removed for now
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { UserCircle2 } from 'lucide-react'; // Using a placeholder icon

interface RecentlyGradedItemProps {
  submissionId: string;
  assignmentName: string;
  studentName: string;
  studentInitials: string;
  // studentAvatarUrl?: string; // Removed as Avatar component is not available
  score: number | null;
  maxScore?: number; // Optional, if assignments have a defined max score
  gradedAt: string; // ISO date string
  // Example: /teach/instance/{instanceId}/assignment/{assignmentId}/submission/{submissionId}
  viewSubmissionUrl?: string; 
}

export function RecentlyGradedItem({
  submissionId,
  assignmentName,
  studentName,
  studentInitials,
  // studentAvatarUrl, // Removed
  score,
  maxScore,
  gradedAt,
  viewSubmissionUrl,
}: RecentlyGradedItemProps) {
  const formattedGradedDate = gradedAt ? format(parseISO(gradedAt), 'PPp') : 'N/A';
  const displayScore = score !== null ? `${score}${maxScore ? ` / ${maxScore}` : ''}` : 'Not scored';

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-md truncate" title={assignmentName}>{assignmentName}</CardTitle>
        <CardDescription className="text-xs">Graded: {formattedGradedDate}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="flex items-center space-x-3 mb-2">
          {/* Placeholder for Avatar */}
          <UserCircle2 className="h-8 w-8 text-muted-foreground" /> 
          {/* <Avatar className="h-8 w-8">
            {studentAvatarUrl && <AvatarImage src={studentAvatarUrl} alt={studentName} />}
            <AvatarFallback>{studentInitials}</AvatarFallback>
          </Avatar> */}
          <span className="text-sm font-medium truncate" title={studentName}>{studentName}</span>
        </div>
        <div>
          <Badge variant={score === null ? "secondary" : (score >= (maxScore || 100) * 0.7 ? "default" : "destructive")}>
            Score: {displayScore}
          </Badge>
        </div>
      </CardContent>
      <CardFooter>
        {viewSubmissionUrl ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={viewSubmissionUrl}>View Submission</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full" disabled>
            View Submission
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 