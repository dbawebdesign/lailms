'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Users, GraduationCap, BarChart3, MessageSquare } from 'lucide-react'

export default function DevAdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
            <CardTitle>Developer Admin Access</CardTitle>
            <CardDescription>
              Enter the developer password to access admin tools
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
                <p className="text-sm text-red-600">{error}</p>
              )}
              <Button type="submit" className="w-full">
                Access Admin Tools
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Developer Admin Tools</h1>
        <p className="text-muted-foreground">
          Access development tools, demos, and administrative features.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Organizations
            </CardTitle>
            <CardDescription>
              Manage organizations and administrative settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dev-admin/organisations">
              <Button className="w-full">
                Access Organizations
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              AI Grading
            </CardTitle>
            <CardDescription>
              Test and configure AI-powered grading features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dev-admin/ai-grading">
              <Button className="w-full">
                Access AI Grading
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Survey Analytics
            </CardTitle>
            <CardDescription>
              View and analyze survey data and responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dev-admin/survey-analytics">
              <Button className="w-full">
                Access Survey Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              User Messaging
            </CardTitle>
            <CardDescription>
              Send messages to users with mandatory responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dev-admin/messaging">
              <Button className="w-full">
                Access Messaging
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 