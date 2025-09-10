'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCourseCreationModal } from '@/hooks/useCourseCreationModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Plus, 
  PlayCircle, 
  BookOpen, 
  Users, 
  TrendingUp,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Calendar,
  BarChart3,
  X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Student {
  id: string
  firstName: string
  lastName: string
  gradeLevel: string
  username: string
}

interface Course {
  id: string
  name: string
  description?: string
  class_instances?: any[]
}

interface HomeschoolDashboardClientProps {
  userName: string
  organizationName: string
  organizationId: string
  students: Student[]
  courses: Course[]
  isFirstTime: boolean
}

export default function HomeschoolDashboardClient({
  userName,
  organizationName,
  organizationId,
  students,
  courses,
  isFirstTime
}: HomeschoolDashboardClientProps) {
  const [showDemoVideo, setShowDemoVideo] = useState(isFirstTime)
  
  const { openModal, CourseCreationModal } = useCourseCreationModal({ 
    organisationId: organizationId 
  })
  useEffect(() => {
    if (isFirstTime && !showDemoVideo) {
      // Trigger help link animation in sidebar after closing demo
      setTimeout(() => {
        // Dispatch custom event to animate the Help link in the sidebar
        window.dispatchEvent(new CustomEvent('animateHelpLink'))
      }, 500)
    }
  }, [showDemoVideo, isFirstTime])

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-black">
      {/* Clean Header */}
      <div className="border-b border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-xl bg-white/80 dark:bg-black/80">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light text-neutral-900 dark:text-white">
                Welcome back, {userName}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {organizationName}
              </p>
            </div>
            

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isFirstTime ? (
          /* First Time User Layout */
          <div className="space-y-8">
            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-light text-neutral-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <Button variant="ghost" className="h-auto min-h-[120px] p-6 justify-center flex-col items-center text-center space-y-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors" asChild>
                  <Link href="/teach/knowledge-base/create">
                    <Sparkles className="h-8 w-8 text-blue-500" />
                    <div className="space-y-1">
                      <span className="font-medium text-sm">Create Class</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Start with AI</span>
                    </div>
                  </Link>
                </Button>
                <Button variant="ghost" className="h-auto min-h-[120px] p-6 justify-center flex-col items-center text-center space-y-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors" asChild>
                  <Link href="/homeschool/add-students">
                    <Users className="h-8 w-8 text-green-500" />
                    <div className="space-y-1">
                      <span className="font-medium text-sm">Add Students</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Manage family</span>
                    </div>
                  </Link>
                </Button>
                <Button variant="ghost" className="h-auto min-h-[120px] p-6 justify-center flex-col items-center text-center space-y-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors" asChild>
                  <Link href="/teach/gradebook">
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                    <div className="space-y-1">
                      <span className="font-medium text-sm">Gradebook</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Track progress</span>
                    </div>
                  </Link>
                </Button>
                <Button variant="ghost" className="h-auto min-h-[120px] p-6 justify-center flex-col items-center text-center space-y-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors" asChild>
                  <Link href="/teach/schedule">
                    <Calendar className="h-8 w-8 text-orange-500" />
                    <div className="space-y-1">
                      <span className="font-medium text-sm">Schedule</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Plan lessons</span>
                    </div>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Students Section */}
            <div>
              <h2 className="text-lg font-light text-neutral-900 dark:text-white mb-4">Your Students</h2>
              <Card className="p-6 border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur">
                <div className="space-y-4">
                  {students.length > 0 ? (
                    students.map((student) => (
                      <div key={student.id} className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                          {student.firstName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Grade {student.gradeLevel}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <GraduationCap className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                        No students added yet
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/homeschool/add-students">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Your First Student
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Big Call to Action */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-light text-neutral-900 dark:text-white mb-3">
                  Ready to create your first class?
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                  Let's get started with AI-powered course creation. It only takes a few minutes.
                </p>
              </div>
              
              <Button
                size="lg"
                className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 px-8 py-6 text-lg font-light rounded-xl shadow-xl hover:shadow-2xl transition-all"
                asChild
              >
                <Link href="/teach/knowledge-base/create">
                  <Sparkles className="mr-3 h-5 w-5" />
                  Create Your First Class
                </Link>
              </Button>
            </motion.div>
          </div>
        ) : (
          /* Existing User Layout */
          <div className="space-y-8">
            {/* Quick Stats - Minimal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-light">{students.length}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Students</p>
                  </div>
                  <Users className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                </div>
              </Card>
              
              <Card className="p-6 border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-light">{courses.length}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Active Courses</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                </div>
              </Card>
              
              <Card className="p-6 border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-light">0</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">This Week</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Existing user content continues */}
        {!isFirstTime && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Courses */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-light text-neutral-900 dark:text-white">Recent Courses</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/teach/base-classes">
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              
              <div className="space-y-3">
                {courses.map((course) => (
                  <Card
                    key={course.id}
                    className="p-4 glass-card glass-card-hover animate-slide-up card-hover-gradient hover:shadow-lg transition-shadow cursor-pointer"
                    style={{"--hover-gradient": "linear-gradient(135deg, rgba(107, 93, 229, 0.08) 0%, rgba(228, 93, 229, 0.04) 100%)"} as React.CSSProperties}
                  >
                    <Link href={`/teach/base-classes/${course.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-neutral-900 dark:text-white">
                            {course.name}
                          </h3>
                          {course.description && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                              {course.description}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-neutral-400" />
                      </div>
                    </Link>
                  </Card>
                ))}
                
                <Button
                  variant="outline"
                  className="w-full border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600"
                  onClick={openModal}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Course
                </Button>
              </div>
            </div>

            {/* Students List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-light text-neutral-900 dark:text-white">Students</h2>
              </div>
              
              <Card className="p-4 border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 backdrop-blur">
                <div className="space-y-3">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                        {student.firstName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Grade {student.gradeLevel}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {students.length === 0 && (
                    <div className="text-center py-4">
                      <GraduationCap className="h-8 w-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        No students yet
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Quick Actions */}
              <div className="mt-6 space-y-2">
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/teach/gradebook">
                    <BarChart3 className="mr-3 h-4 w-4" />
                    View Gradebook
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/teach/schedule">
                    <Calendar className="mr-3 h-4 w-4" />
                    Schedule
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Demo Video Modal */}
      <Dialog open={showDemoVideo} onOpenChange={setShowDemoVideo}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-neutral-200 dark:border-neutral-800">
          <DialogHeader className="sr-only">
            <DialogTitle>Welcome Demo Video</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-video">
            {/* Video Placeholder - Replace with actual video */}
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
              <div className="text-center text-white">
                <PlayCircle className="h-16 w-16 mx-auto mb-4" />
                <h3 className="text-xl font-light mb-2">How to Create Your First Class</h3>
                <p className="text-sm opacity-80">2 minute tutorial</p>
              </div>
            </div>
            
            {/* Replace above with actual video embed */}
            {/* <iframe
              src="YOUR_VIDEO_URL"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            /> */}
          </div>
        </DialogContent>
      </Dialog>
      
      <CourseCreationModal />
    </div>
  )
}
