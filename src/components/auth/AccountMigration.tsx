'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Mail,
  Lock,
  Users,
  ArrowRight,
  UserPlus,
  Shield
} from 'lucide-react'

interface MigrationProfile {
  username: string
  firstName: string
  lastName: string
  role: string
  organisationType: string
  organisationName: string
}

interface Student {
  id: string
  firstName: string
  gradeLevel: string
}

export default function AccountMigration({ migrationToken, profile }: { 
  migrationToken: string
  profile: MigrationProfile 
}) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'intro' | 'setup' | 'family' | 'complete'>('intro')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [useGoogle, setUseGoogle] = useState(false)
  const [familyName, setFamilyName] = useState(`${profile.firstName} Family`)
  const [students, setStudents] = useState<Student[]>([])
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentGrade, setNewStudentGrade] = useState('')

  const isHomeschoolTeacher = profile.role === 'teacher' && 
    (profile.organisationType === 'individual_family' || profile.organisationType === 'homeschool_coop')

  const handleEmailSetup = async () => {
    if (!useGoogle) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match')
        return
      }
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters')
        return
      }
    }

    setIsLoading(true)
    try {
      if (useGoogle) {
        // Store migration data in session storage for after OAuth callback
        sessionStorage.setItem('migration_data', JSON.stringify({
          migrationToken,
          familyName,
          students
        }))

        // Initiate Google OAuth
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/migration-callback?migration_token=${migrationToken}`,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            }
          }
        })

        if (error) throw error
      } else {
        // Complete migration with email/password
        const response = await fetch('/api/auth/complete-migration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            useGoogle: false,
            migrationToken,
            familyName: isHomeschoolTeacher ? familyName : undefined,
            students: isHomeschoolTeacher ? students : undefined
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Migration failed')
        }

        setStep('complete')
        
        // Sign in with new credentials
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (!signInError) {
          setTimeout(() => {
            router.push(data.redirectTo || '/dashboard')
          }, 2000)
        }
      }
    } catch (error: any) {
      console.error('Migration error:', error)
      toast.error(error.message || 'Migration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const addStudent = () => {
    if (newStudentName && newStudentGrade) {
      setStudents([
        ...students,
        {
          id: crypto.randomUUID(),
          firstName: newStudentName,
          gradeLevel: newStudentGrade
        }
      ])
      setNewStudentName('')
      setNewStudentGrade('')
    }
  }

  const removeStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id))
  }

  const progressValue = 
    step === 'intro' ? 25 :
    step === 'setup' ? 50 :
    step === 'family' ? 75 : 100

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <Progress value={progressValue} className="w-32" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Account Security Update Required
          </CardTitle>
          <CardDescription>
            We're upgrading our authentication system for better security and features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'intro' && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important Update</AlertTitle>
                <AlertDescription>
                  To continue using Learnology AI, you need to update your account to use email-based authentication. 
                  This one-time process will:
                  <ul className="mt-2 ml-4 list-disc space-y-1">
                    <li>Enhance your account security</li>
                    <li>Enable password recovery options</li>
                    <li>Allow login with Google (optional)</li>
                    {isHomeschoolTeacher && (
                      <li>Set up your family account structure</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Your Current Account</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Username:</span> {profile.username}</p>
                  <p><span className="text-muted-foreground">Name:</span> {profile.firstName} {profile.lastName}</p>
                  <p><span className="text-muted-foreground">Role:</span> {profile.role}</p>
                  <p><span className="text-muted-foreground">Organization:</span> {profile.organisationName}</p>
                </div>
              </div>

              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Your data is safe!</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  All your courses, progress, and content will be preserved during this update.
                </AlertDescription>
              </Alert>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setStep('setup')}
              >
                Begin Account Update
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {step === 'setup' && (
            <>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Choose Your Authentication Method</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={useGoogle ? 'default' : 'outline'}
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => setUseGoogle(true)}
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="font-medium">Continue with Google</span>
                    <span className="text-xs text-muted-foreground">Recommended</span>
                  </Button>

                  <Button
                    type="button"
                    variant={!useGoogle ? 'default' : 'outline'}
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => setUseGoogle(false)}
                  >
                    <Mail className="h-6 w-6" />
                    <span className="font-medium">Use Email & Password</span>
                    <span className="text-xs text-muted-foreground">Traditional login</span>
                  </Button>
                </div>

                {!useGoogle && (
                  <div className="space-y-4 mt-4">
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        This will be your new login email
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">New Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-muted-foreground">
                        Must be at least 8 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('intro')}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (isHomeschoolTeacher) {
                      setStep('family')
                    } else {
                      handleEmailSetup()
                    }
                  }}
                  disabled={isLoading || (!useGoogle && (!email || !password || !confirmPassword))}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      {isHomeschoolTeacher ? 'Next: Family Setup' : 'Complete Setup'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'family' && isHomeschoolTeacher && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Set Up Your Family Account</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="familyName">Family Name</Label>
                  <Input
                    id="familyName"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="e.g., The Smith Family"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Add Student Accounts (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    You can add your students now or later from your dashboard
                  </p>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Student name"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                    />
                    <Input
                      placeholder="Grade"
                      value={newStudentGrade}
                      onChange={(e) => setNewStudentGrade(e.target.value)}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addStudent}
                      disabled={!newStudentName || !newStudentGrade}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  {students.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-800 rounded"
                        >
                          <span className="text-sm">
                            {student.firstName} - Grade {student.gradeLevel}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeStudent(student.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('setup')}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEmailSetup}
                  disabled={isLoading || !familyName}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing migration...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'complete' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              <h3 className="text-xl font-bold">Migration Complete!</h3>
              <p className="text-muted-foreground">
                Your account has been successfully updated. Redirecting you to your dashboard...
              </p>
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
