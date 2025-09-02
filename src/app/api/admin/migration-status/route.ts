import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface Migration {
  status: 'completed' | 'pending' | 'failed'
  created_at: string
  completed_at?: string
}

interface AuthUser {
  id: string
  email: string
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Initialize admin client
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get migration statistics
    const stats = await getMigrationStats(adminSupabase)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Migration status error:', error)
    return NextResponse.json({ error: 'Failed to get migration status' }, { status: 500 })
  }
}

async function getMigrationStats(supabase: any) {
  // Get total users needing migration
  const { data: authUsers }: { data: AuthUser[] | null } = await supabase
    .from('auth.users')
    .select('id, email')
    .like('email', '%@%.internal')

  const needsMigration = authUsers?.length || 0

  // Get migration progress
  const { data: migrations }: { data: Migration[] | null } = await supabase
    .from('account_migrations')
    .select('status, created_at, completed_at')

  const completed = migrations?.filter(m => m.status === 'completed').length || 0
  const pending = migrations?.filter(m => m.status === 'pending').length || 0
  const failed = migrations?.filter(m => m.status === 'failed').length || 0

  // Calculate average migration time
  const completedMigrations = migrations?.filter((m: Migration) => m.status === 'completed' && m.completed_at)
  let avgMigrationTime = 0
  if (completedMigrations && completedMigrations.length > 0) {
    const totalTime = completedMigrations.reduce((acc: number, m: Migration) => {
      const start = new Date(m.created_at).getTime()
      const end = new Date(m.completed_at!).getTime()
      return acc + (end - start)
    }, 0)
    avgMigrationTime = Math.round(totalTime / completedMigrations.length / 1000 / 60) // in minutes
  }

  // Get breakdown by organization
  const { data: orgBreakdown } = await supabase
    .from('profiles')
    .select(`
      organisation_id,
      organisations!inner (
        name,
        organisation_type
      )
    `)
    .in('user_id', authUsers?.map((u: AuthUser) => u.id) || [])

  const byOrganization = orgBreakdown?.reduce((acc: any, p: any) => {
    const orgName = p.organisations?.name || 'Unknown'
    if (!acc[orgName]) {
      acc[orgName] = {
        name: orgName,
        type: p.organisations?.organisation_type,
        count: 0
      }
    }
    acc[orgName].count++
    return acc
  }, {})

  // Get breakdown by role
  const { data: roleBreakdown } = await supabase
    .from('profiles')
    .select('role')
    .in('user_id', authUsers?.map((u: AuthUser) => u.id) || [])

  const byRole = roleBreakdown?.reduce((acc: any, p: any) => {
    const role = p.role || 'unknown'
    acc[role] = (acc[role] || 0) + 1
    return acc
  }, {})

  return {
    summary: {
      totalNeedingMigration: needsMigration,
      completed,
      pending,
      failed,
      percentComplete: needsMigration > 0 ? Math.round((completed / needsMigration) * 100) : 0,
      avgMigrationTimeMinutes: avgMigrationTime
    },
    breakdown: {
      byOrganization: Object.values(byOrganization || {}),
      byRole
    },
    recentMigrations: migrations?.slice(0, 10).map((m: Migration) => ({
      status: m.status,
      createdAt: m.created_at,
      completedAt: m.completed_at
    }))
  }
}
