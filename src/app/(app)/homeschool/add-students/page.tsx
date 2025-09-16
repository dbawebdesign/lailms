'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, GraduationCap, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Student {
  firstName: string
  gradeLevel: string
}

interface ExistingStudent {
  user_id: string
  first_name: string | null
  last_name: string | null
  grade_level: string | null
  username: string | null
}

export default function AddStudentsPage() {
  const [students, setStudents] = useState<Student[]>([{ firstName: '', gradeLevel: '' }])
  const [isLoading, setIsLoading] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([])
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([])
  const [loadingExisting, setLoadingExisting] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadExistingStudents()
  }, [])

  const loadExistingStudents = async () => {
    try {
      setLoadingExisting(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get current user's profile to find family members
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          family_id,
          organisation_id,
          organisations (
            organisation_type
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (!profile) return

      // Check if this is a homeschool organization
      const isHomeschool = (profile.organisations as any)?.organisation_type === 'individual_family' || 
                          (profile.organisations as any)?.organisation_type === 'homeschool_coop'

      if (!isHomeschool) {
        setExistingStudents([])
        return
      }

      let students: ExistingStudent[] = []

      // Get family members - try both family_id and organisation_id
      if (profile.family_id) {
        const { data: familyMembers } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, grade_level, username, role')
          .eq('family_id', profile.family_id)
          .eq('role', 'student')
          .order('first_name')
        
        if (familyMembers) {
          students = familyMembers
        }
      }
      
      // Also try organisation_id to get additional students (not just fallback)
      if (profile.organisation_id) {
        const { data: orgMembers } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, grade_level, username, role')
          .eq('organisation_id', profile.organisation_id)
          .eq('role', 'student')
          .order('first_name')
        
        if (orgMembers) {
          // Merge org members with family members, avoiding duplicates
          orgMembers.forEach(orgMember => {
            if (!students.find(s => s.user_id === orgMember.user_id)) {
              students.push(orgMember)
            }
          })
        }
      }

      // Also check family_students table for additional students
      if (profile.family_id) {
        const { data: familyStudents } = await supabase
          .from('family_students')
          .select(`
            student_id,
            profiles!family_students_student_id_fkey (
              user_id,
              first_name,
              last_name,
              grade_level,
              username,
              role
            )
          `)
          .eq('family_id', profile.family_id)

        if (familyStudents) {
          familyStudents.forEach(fs => {
            if (fs.profiles && !students.find(s => s.user_id === fs.student_id)) {
              const studentProfile = fs.profiles as any
              students.push({
                user_id: fs.student_id,
                first_name: studentProfile.first_name,
                last_name: studentProfile.last_name,
                grade_level: studentProfile.grade_level,
                username: studentProfile.username
              })
            }
          })
        }
      }

      setExistingStudents(students)
    } catch (error) {
      console.error('Error loading existing students:', error)
    } finally {
      setLoadingExisting(false)
    }
  }

  const addStudentField = () => {
    if (students.length < 4) {
      setStudents([...students, { firstName: '', gradeLevel: '' }])
    } else {
      toast.error('Maximum 4 students allowed')
    }
  }

  const removeStudentField = (index: number) => {
    setStudents(students.filter((_, i) => i !== index))
  }

  const updateStudent = (index: number, field: keyof Student, value: string) => {
    const updated = [...students]
    updated[index] = { ...updated[index], [field]: value }
    setStudents(updated)
  }

  const handleSubmit = async () => {
    // Validate
    const validStudents = students.filter(s => s.firstName && s.gradeLevel)
    if (validStudents.length === 0) {
      toast.error('Please add at least one student with name and grade')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/homeschool/fix-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: validStudents })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create students')
      }

      if (result.students && result.students.length > 0) {
        setCreatedCredentials(result.students)
        toast.success('Students created successfully! Save these credentials!')
        // Refresh the existing students list
        await loadExistingStudents()
      }
    } catch (error: any) {
      console.error('Error:', error)
      toast.error(error.message || 'Failed to create students')
    } finally {
      setIsLoading(false)
    }
  }

  if (createdCredentials.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Students Added Successfully!</CardTitle>
              <CardDescription>
                Your students have been added to your family account. You can switch between accounts using the dropdown in the top right.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {createdCredentials.map((student, index) => (
                <Card key={student.id} className="p-4">
                  <h3 className="font-semibold mb-2">{student.firstName} - Grade {student.gradeLevel}</h3>
                  <p className="text-sm text-muted-foreground">
                    This student has been added to your family account. You can switch to their profile from the account switcher in the header.
                  </p>
                </Card>
              ))}
              
              <div className="pt-4">
                <Button onClick={() => router.push('/teach')} className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Add Students to Your Family Account</CardTitle>
            <CardDescription>
              Add up to 4 students to your homeschool family account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {students.map((student, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor={`name-${index}`}>First Name</Label>
                  <Input
                    id={`name-${index}`}
                    value={student.firstName}
                    onChange={(e) => updateStudent(index, 'firstName', e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor={`grade-${index}`}>Grade</Label>
                  <Input
                    id={`grade-${index}`}
                    value={student.gradeLevel}
                    onChange={(e) => updateStudent(index, 'gradeLevel', e.target.value)}
                    placeholder="K-12"
                  />
                </div>
                {students.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStudentField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex gap-4 pt-4">
              {students.length < 4 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addStudentField}
                  className="flex-1"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Student
                </Button>
              )}
              
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Students...
                  </>
                ) : (
                  'Create Students'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Students List */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Students
            </CardTitle>
            <CardDescription>
              Students currently in your family account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingExisting ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg animate-pulse">
                    <div className="h-5 w-5 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    <div className="flex-1">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-1" />
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : existingStudents.length > 0 ? (
              <div className="space-y-3">
                {existingStudents.map((student) => (
                  <div key={student.user_id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <GraduationCap className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {student.grade_level ? `Grade ${student.grade_level}` : 'No grade set'}
                          {student.username && ` • @${student.username}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No students yet</p>
                <p className="text-sm">Add your first student using the form above</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
