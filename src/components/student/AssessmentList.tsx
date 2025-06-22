import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NewSchemaAssessment, NewSchemaStudentAttempt } from '@/components/assessments/v2/types/newSchemaTypes';

export type AssessmentWithAttempt = NewSchemaAssessment & {
  // Latest attempt data for the current user
  latest_attempt?: Pick<NewSchemaStudentAttempt, 'status' | 'percentage_score' | 'submitted_at'>;
  due_date?: string; // From assessment metadata or class settings
};

const AssessmentList = ({ baseClassId }: { baseClassId: string }) => {
  const [assessments, setAssessments] = useState<AssessmentWithAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const router = useRouter();

  useEffect(() => {
    if (!baseClassId) return;

    async function fetchAssessments() {
      setLoading(true);
      try {
        // This API endpoint needs to be updated to return the AssessmentWithAttempt structure
        // It should perform a LEFT JOIN from assessments to assessment_attempts for the current user
        const response = await fetch(`/api/teach/assessments?baseClassId=${baseClassId}&withAttempts=true`);
        if (!response.ok) throw new Error('Failed to fetch assessments');
        const data: AssessmentWithAttempt[] = await response.json();
        setAssessments(data);
      } catch (error) {
        console.error('Error fetching assessments:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAssessments();
  }, [baseClassId]);

  const filteredAssessments = useMemo(() => {
    return assessments
      .filter(assessment => {
        // Search filter
        const searchLower = searchTerm.toLowerCase();
        return assessment.title.toLowerCase().includes(searchLower) ||
               assessment.description?.toLowerCase().includes(searchLower);
      })
      .filter(assessment => {
        // Status filter
        if (statusFilter === 'all') return true;
        const status = assessment.latest_attempt?.status ?? 'pending';
        return status === statusFilter;
      })
      .filter(assessment => {
        // Type filter
        if (typeFilter === 'all') return true;
        return assessment.assessment_type === typeFilter;
      });
  }, [assessments, searchTerm, statusFilter, typeFilter]);


  const handleAction = (assessment: AssessmentWithAttempt) => {
    const attemptStatus = assessment.latest_attempt?.status;
    if (attemptStatus === 'completed' || attemptStatus === 'graded') {
      // Show results for completed/graded assessments
      router.push(`/assessments/${assessment.id}/results`);
    } else {
      // Takes to the assessment page, which would handle 'in_progress' or start new attempt
      router.push(`/assessments/take/${assessment.id}`);
    }
  };
  
  const getStatusBadgeVariant = (status?: string): "secondary" | "default" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
      case 'graded':
        return 'default'; // Green in shadcn UI
      case 'in_progress':
        return 'outline'; // Blueish in shadcn UI
      case 'grading':
        return 'secondary'; // Gray in shadcn UI for AI grading
      case 'abandoned':
        return 'destructive'; // Red in shadcn UI
      default:
        return 'secondary'; // Gray in shadcn UI for not started
    }
  }

  const getActionText = (status?: string): string => {
    switch (status) {
      case 'completed':
      case 'graded':
        return 'Review';
      case 'in_progress':
        return 'Continue';
      case 'grading':
        return 'View Status';
      case 'abandoned':
        return 'Restart';
      default:
        return 'Start';
    }
  }

  // Calculate percentage score from the attempt data
  const calculatePercentageScore = (attempt?: Pick<NewSchemaStudentAttempt, 'status' | 'percentage_score' | 'submitted_at'>) => {
    if (!attempt || !attempt.percentage_score) return null;
    // The percentage_score is already calculated in the new schema
    return Math.round(attempt.percentage_score);
  };

  if (loading) return <div>Loading assessments...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Assessments</h2>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search assessments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Not Started</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {/* These should be dynamically populated from the enum or available types */}
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
            <SelectItem value="practice">Practice</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAssessments.length === 0 ? (
        <p>No assessments match your criteria.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssessments.map((assessment) => {
            const percentageScore = calculatePercentageScore(assessment.latest_attempt);
            
            return (
              <Card key={assessment.id}>
                <CardHeader>
                  <CardTitle>{assessment.title}</CardTitle>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{assessment.assessment_type}</span>
                    {assessment.due_date && <span>Due: {new Date(assessment.due_date).toLocaleDateString()}</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{assessment.description}</p>
                  <div className="mt-4 flex gap-2">
                      <Badge variant={getStatusBadgeVariant(assessment.latest_attempt?.status)}>
                        {assessment.latest_attempt?.status?.replace('_', ' ') ?? 'Not Started'}
                      </Badge>
                      {percentageScore !== null && (
                          <Badge variant="secondary">
                              Score: {percentageScore}%
                          </Badge>
                      )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleAction(assessment)} className="w-full">
                    {getActionText(assessment.latest_attempt?.status)}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssessmentList; 