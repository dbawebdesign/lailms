'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface Student {
  firstName: string
  gradeLevel: string
}

export default function AddStudentsPage() {
  const [students, setStudents] = useState<Student[]>([{ firstName: '', gradeLevel: '' }])
  const [isLoading, setIsLoading] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([])
  const router = useRouter()

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
                <Button onClick={() => router.push('/homeschool')} className="w-full">
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
      </div>
    </div>
  )
}
