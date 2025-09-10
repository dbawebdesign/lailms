'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DevAdminCourseGenerator } from '@/components/dev-admin/DevAdminCourseGenerator'
import { DevAdminCourseList } from '@/components/dev-admin/DevAdminCourseList'
import { RealTimeProgress } from '@/components/ui/real-time-progress'
import { 
  BookOpen, 
  Plus, 
  GraduationCap,
  AlertCircle,
  ArrowLeft,
  Activity
} from 'lucide-react'
import Link from 'next/link'

export default function DevAdminCourseCatalogPage() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('create')

  // Check for tab parameter in URL
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && (tab === 'create' || tab === 'manage')) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const checkPassword = () => {
    const devPassword = 'TerroirLAI'
    if (password === devPassword) {
      setAuthenticated(true)
      setError(null)
    } else {
      setError('Invalid password')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    checkPassword()
  }

  if (!authenticated) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Course Catalog Admin
            </CardTitle>
            <CardDescription>
              Enter the developer password to access course catalog management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter developer password"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full">
                Access Course Catalog Admin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dev-admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dev Admin
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Course Catalog Management</h1>
        <p className="text-muted-foreground">
          Create and manage pre-built courses that users can duplicate and customize.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Course
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Manage Catalog
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Progress Tracking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Course Catalog Entry</CardTitle>
              <CardDescription>
                Generate a new course that will be available for users to duplicate.
                All courses created here will be tagged as "Course Catalog" items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DevAdminCourseGenerator />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Course Catalog</CardTitle>
              <CardDescription>
                View and manage all courses in the catalog. These are the courses users can select and duplicate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DevAdminCourseList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Course Generation Progress</CardTitle>
              <CardDescription>
                Monitor active course generation jobs and their progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealTimeProgress 
                jobId={null} // Will show all active jobs
                onComplete={() => {
                  // Refresh the manage tab when generation completes
                  setActiveTab('manage')
                }}
                showAllJobs={true}
              />
              
              <div className="mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('create')}
                  className="mr-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Course
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('manage')}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  View Catalog
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
