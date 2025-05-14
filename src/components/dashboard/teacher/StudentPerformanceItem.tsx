import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // Assuming Progress component is available
import { Users, TrendingUp, AlertCircle } from "lucide-react";

interface StudentPerformanceItemProps {
  id: string; // Could be class_instance_id
  name: string; // Class name
  studentCount: number;
  averageScore?: number;
  // Example: number of students with scores below a certain threshold (e.g., 60%)
  studentsAtRiskCount?: number; 
  // Link to a more detailed performance report for this class
  detailsUrl?: string;
}

export function StudentPerformanceItem({
  id,
  name,
  studentCount,
  averageScore,
  studentsAtRiskCount,
  detailsUrl,
}: StudentPerformanceItemProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-medium truncate" title={name}>{name}</CardTitle>
        <CardDescription className="text-xs flex items-center">
            <Users className="mr-1 h-3 w-3" /> {studentCount} Student{studentCount !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {averageScore !== undefined && (
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">Average Score</span>
                <span className="text-sm font-semibold">{averageScore.toFixed(1)}%</span>
            </div>
            <Progress value={averageScore} className="h-2" />
          </div>
        )}
        {studentsAtRiskCount !== undefined && studentsAtRiskCount > 0 && (
          <div className="flex items-center text-xs text-warning-foreground mt-2">
            <AlertCircle className="mr-1 h-3 w-3 text-warning" />
            <span>{studentsAtRiskCount} student{studentsAtRiskCount !== 1 ? 's' : ''} may need attention</span>
          </div>
        )}
        {averageScore === undefined && studentsAtRiskCount === undefined && (
            <p className="text-xs text-muted-foreground">Performance data not yet available.</p>
        )}
        {/* We can add a link here if detailsUrl is provided */}
        {/* {detailsUrl && <Button asChild size="sm" className="mt-3 w-full"><Link href={detailsUrl}>View Details</Link></Button>} */}
      </CardContent>
    </Card>
  );
} 