import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@learnologyai/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type AssessmentAttempt = Database['public']['Tables']['assessment_attempts']['Row'];

export type AssessmentWithAttempt = Assessment & {
  // Assuming the API returns the latest attempt for the current user
  latest_attempt?: Pick<AssessmentAttempt, 'status' | 'score' | 'completed_at'>;
  due_date?: string; // This might come from assessment.settings or elsewhere
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
    if (attemptStatus === 'completed' || attemptStatus === 'passed' || attemptStatus === 'failed') {
      // Assuming a results page exists
      router.push(`/assessments/${assessment.id}/results`);
    } else {
      // Takes to the assessment page, which would handle 'pending' or 'in-progress'
      router.push(`/assessments/take/${assessment.id}`);
    }
  };
  
  const getStatusBadgeVariant = (status?: string): "secondary" | "default" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
      case 'passed':
        return 'default'; // Green in shadcn UI
      case 'in-progress':
        return 'outline'; // Blueish in shadcn UI
      case 'failed':
        return 'destructive'; // Red in shadcn UI
      case 'pending':
      default:
        return 'secondary'; // Gray in shadcn UI
    }
  }

  const getActionText = (status?: string): string => {
    switch (status) {
      case 'completed':
      case 'passed':
      case 'failed':
        return 'Review';
      case 'in-progress':
        return 'Continue';
      case 'pending':
      default:
        return 'Start';
    }
  }

  // Calculate percentage score from score and total questions if available
  const calculatePercentageScore = (attempt?: Pick<AssessmentAttempt, 'status' | 'score' | 'completed_at'>) => {
    if (!attempt || !attempt.score) return null;
    // This would need to be calculated based on the assessment's total possible points
    // For now, assuming score is already a percentage or needs to be calculated differently
    return Math.round(attempt.score);
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
                        {assessment.latest_attempt?.status?.replace('-', ' ') ?? 'Not Started'}
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