'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, GraduationCap } from 'lucide-react'

export default function DevAdminPage() {
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
      </div>
    </div>
  )
} 