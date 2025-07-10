import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface ActiveClassItemProps {
  id: string;
  name: string;
  baseClassName: string;
  studentCount: number;
  manageClassUrl?: string; // Optional: URL to the specific class management page
}

export function ActiveClassItem({
  id,
  name,
  baseClassName,
  studentCount,
  manageClassUrl,
}: ActiveClassItemProps) {
  const displayClassName = name || baseClassName; // Prefer instance name, fallback to base class name

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg truncate" title={displayClassName}>
          {displayClassName}
        </CardTitle>
        {name && baseClassName && name !== baseClassName && (
          <p className="text-xs text-muted-foreground truncate" title={baseClassName}>
            Based on: {baseClassName}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="flex items-center text-sm text-muted-foreground">
          <Users className="mr-2 h-4 w-4" />
          <span>{studentCount} Student{studentCount !== 1 ? 's' : ''}</span>
        </div>
        {/* Add more details here if needed, e.g., next assignment, upcoming lesson */}
      </CardContent>
      <CardFooter>
        {manageClassUrl ? (
          <Button asChild className="w-full">
            <Link href={manageClassUrl}>Manage Class</Link>
          </Button>
        ) : (
          <Button className="w-full" disabled>
            Manage Class
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 