import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ProgressData {
  completedAssessments: number;
  totalAssessments: number;
  overallScore: number;
}

const ProgressTracker = ({ studentId, courseId }: { studentId: string, courseId: string }) => {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !courseId) return;

    const fetchProgress = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/teach/progress?studentId=${studentId}&courseId=${courseId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        const data = await response.json();
        setProgress(data);
      } catch (err: any) {
        console.error('Error fetching progress:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [studentId, courseId]);

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Course Progress</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-20 flex items-center justify-center">Loading...</div>
            </CardContent>
        </Card>
    );
  }
  
  if (error) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Course Progress</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-red-500">{error}</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Course Progress</CardTitle>
            <CardDescription>Your performance at a glance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress ? (
            <>
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Completion</span>
                        <span className="text-sm font-medium">{progress.completedAssessments} / {progress.totalAssessments}</span>
                    </div>
                    <Progress value={(progress.completedAssessments / progress.totalAssessments) * 100} />
                </div>
                <div>
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Overall Score</span>
                        <span className="text-sm font-medium">{progress.overallScore}%</span>
                    </div>
                    <Progress value={progress.overallScore} className="[&>div]:bg-green-500" />
                </div>
            </>
          ) : (
            <p>Could not load progress data.</p>
          )}
        </CardContent>
    </Card>
  );
};

export default ProgressTracker; 