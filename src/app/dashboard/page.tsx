'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  FileText, 
  MessageCircle, 
  Clock3,
  RefreshCw
} from 'lucide-react';

// Mock data (should be replaced with actual data fetching)
const userData = {
  name: 'Ava',
  courses: [
    {
      id: 1,
      title: 'Introduction to Artificial Intelligence',
      instructor: 'Dr. Sarah Chen',
      progress: 30,
      lastAccessed: 'Yesterday',
      dueDate: 'May 15'
    },
    {
      id: 2,
      title: 'Machine Learning Fundamentals',
      instructor: 'Prof. Michael Rodriguez',
      progress: 67,
      lastAccessed: '2 days ago',
    },
    {
      id: 3,
      title: 'Data Science for Beginners',
      instructor: 'Dr. Emily Wilson',
      progress: 25,
      lastAccessed: '1 week ago',
      dueDate: 'June 1'
    }
  ],
  modules: [
    { 
      id: 1, 
      title: 'Introduction to AI Ethics', 
      progress: 100,
      course: 'Introduction to Artificial Intelligence'
    },
    { 
      id: 2, 
      title: 'Machine Learning Basics', 
      progress: 65,
      course: 'Machine Learning Fundamentals'
    },
    { 
      id: 3, 
      title: 'Neural Networks', 
      progress: 30,
      course: 'Machine Learning Fundamentals'
    },
    { 
      id: 4, 
      title: 'Data Visualization', 
      progress: 0,
      course: 'Data Science for Beginners'
    }
  ],
  overallProgress: 49,
  deadlines: [
    {
      id: 1,
      title: 'AI Ethics Essay',
      course: 'Introduction to AI Ethics',
      dueDate: 'Today',
      type: 'assignment'
    },
    {
      id: 2,
      title: 'Machine Learning Quiz',
      course: 'Machine Learning Basics',
      dueDate: 'Tomorrow',
      type: 'quiz'
    },
    {
      id: 3,
      title: 'Weekly Assignment',
      course: 'Python Programming',
      dueDate: 'May 8',
      type: 'assignment',
      completed: true
    },
    {
      id: 4,
      title: 'Neural Networks Project',
      course: 'Neural Networks',
      dueDate: 'May 11',
      type: 'project',
      daysLeft: 5
    },
    {
      id: 5,
      title: 'Final Exam',
      course: 'Data Science Fundamentals',
      dueDate: 'May 16',
      type: 'exam',
      daysLeft: 10
    }
  ],
  todayFocus: [
    {
      id: 1,
      title: 'Complete "Introduction to AI Ethics" module',
      completed: true
    },
    {
      id: 2,
      title: 'Review feedback on your last assignment',
      completed: true
    },
    {
      id: 3,
      title: 'Upcoming quiz: Machine Learning Basics (May 15)',
      completed: false
    }
  ]
};

export default function DashboardPage() {
  // Get current date for greeting
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric' 
  });
  
  // Determine greeting based on time of day
  const hour = today.getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  if (hour >= 17) greeting = "Good evening";

  return (
    <div className="space-y-8">
      {/* Greeting and Date */}
      <div className="bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-950/30 dark:to-purple-950/30 rounded-xl p-6 mb-6">
        <h1 className="text-3xl font-bold mb-1">{greeting}, {userData.name}!</h1>
        <p className="text-muted-foreground">{formattedDate}</p>
        
        {/* Today's Focus */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Today's Focus</h2>
          <ul className="space-y-2">
            {userData.todayFocus.map(item => (
              <li key={item.id} className="flex items-start gap-2">
                <div className={`flex h-5 w-5 mt-0.5 shrink-0 items-center justify-center rounded-full border ${item.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-primary'}`}>
                  {item.completed && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <span className={item.completed ? 'text-muted-foreground line-through' : ''}>
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Continue Learning Button */}
        <Button className="mt-6 bg-primary hover:bg-primary/90 text-white">Continue Learning</Button>
      </div>

      {/* My Courses Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">My Courses</h2>
          <Button variant="link" className="text-primary">View All</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userData.courses.map(course => (
            <Card key={course.id} className="overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-blue-900/50 dark:to-indigo-900/50 relative">
                {course.dueDate && (
                  <div className="absolute top-2 right-2 bg-background/90 rounded-md px-2 py-1 text-xs">
                    Due {course.dueDate}
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg line-clamp-1">{course.title}</h3>
                <p className="text-muted-foreground text-sm">{course.instructor}</p>
                
                <div className="mt-4 mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                </div>
                
                <p className="text-xs text-muted-foreground mt-4">
                  Last accessed: {course.lastAccessed}
                </p>
                
                <div className="flex justify-between mt-4">
                  <Button variant="outline" size="sm">Continue</Button>
                  <Button variant="ghost" size="sm">Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Your Progress and Upcoming Deadlines Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Progress */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-6">Your Progress</h2>
            
            <div className="space-y-6">
              {userData.modules.map(module => (
                <div key={module.id} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{module.title}</span>
                    <span className="text-muted-foreground">{module.progress}%</span>
                  </div>
                  <Progress value={module.progress} className="h-2" />
                </div>
              ))}
              
              <div className="pt-4 mt-6 border-t">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Overall Progress</span>
                  <span className="font-semibold">{userData.overallProgress}%</span>
                </div>
                <Progress value={userData.overallProgress} className="h-3" />
              </div>
            </div>
            
            <div className="mt-6 bg-muted/50 p-4 rounded-lg flex items-center gap-3">
              <div className="bg-primary/20 text-primary p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                </svg>
              </div>
              <div>
                <p className="font-medium">Congratulations! You've completed some modules.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Upcoming Deadlines */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Upcoming Deadlines</h2>
              <Button variant="ghost" size="sm" className="text-primary">
                View All
              </Button>
            </div>
            
            <div className="space-y-4">
              {userData.deadlines.filter(item => !item.completed).slice(0, 4).map(deadline => (
                <div key={deadline.id} className="border rounded-lg p-4">
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      deadline.dueDate === 'Today' ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400' :
                      deadline.dueDate === 'Tomorrow' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400' :
                      'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                    }`}>
                      {deadline.type === 'assignment' && <FileText size={18} />}
                      {deadline.type === 'quiz' && <Clock3 size={18} />}
                      {deadline.type === 'project' && <MessageCircle size={18} />}
                      {deadline.type === 'exam' && <Clock size={18} />}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{deadline.title}</h3>
                      <p className="text-sm text-muted-foreground">{deadline.course}</p>
                      
                      <div className="flex justify-between mt-2">
                        <span className={`text-sm ${
                          deadline.dueDate === 'Today' ? 'text-orange-600 dark:text-orange-400' :
                          deadline.dueDate === 'Tomorrow' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-muted-foreground'
                        }`}>
                          {deadline.dueDate}
                          {deadline.daysLeft && ` • ${deadline.daysLeft} days left`}
                        </span>
                        
                        <Button size="sm" variant="outline">Start</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">AI Recommendations</h2>
              <div className="text-sm text-muted-foreground">Personalized recommendations based on your learning patterns</div>
            </div>
            <Button size="icon" variant="ghost" aria-label="Refresh recommendations">
              <RefreshCw size={16} />
            </Button>
          </div>
          
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="practice">Practice</TabsTrigger>
              <TabsTrigger value="tips">Tips</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-1">Study in shorter, focused sessions</h3>
                    <p className="text-sm text-muted-foreground">Based on your learning patterns, you might benefit from the Pomodoro technique: 25-minute focused sessions with 5-minute breaks.</p>
                    
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/40">
                        Study Habits
                      </Button>
                      <Button size="sm" variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/40">
                        Productivity
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="resources">
              <p className="text-muted-foreground">Switch to the "Resources" tab to see recommended learning materials.</p>
            </TabsContent>
            
            <TabsContent value="courses">
              <p className="text-muted-foreground">Switch to the "Courses" tab to see recommended courses.</p>
            </TabsContent>
            
            <TabsContent value="practice">
              <p className="text-muted-foreground">Switch to the "Practice" tab to see recommended practice exercises.</p>
            </TabsContent>
            
            <TabsContent value="tips">
              <p className="text-muted-foreground">Switch to the "Tips" tab to see learning tips and strategies.</p>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-center mt-4">
            <Button variant="link" className="text-primary">
              Refresh Recommendations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 