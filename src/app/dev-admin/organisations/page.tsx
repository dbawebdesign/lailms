'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

// Define the organization type
interface Organisation {
  id: string
  name: string
  abbr: string | null
  organisation_type: string | null
  created_at: string
}

export default function OrganisationsPage() {
  const router = useRouter()
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [abbr, setAbbr] = useState('')
  const [orgType, setOrgType] = useState<string>('')
  
  // Password protection
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  
  // Check if the auth is correct
  const checkPassword = () => {
    const devPassword = process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD
    if (!devPassword) {
      setError('Dev admin password not configured')
      return
    }
    if (password === devPassword) {
      setAuthenticated(true)
      fetchOrganisations()
    } else {
      setError('Invalid password')
    }
  }
  
  // Check for existing auth
  useEffect(() => {
    setLoading(false)
  }, [])
  
  // Fetch organisations from API
  const fetchOrganisations = async () => {
    if (!authenticated) return
    
    try {
      setLoading(true)
      const response = await fetch('/api/dev-admin/organisations', {
        method: 'GET',
        headers: {
          'x-dev-admin-password': process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD || ''
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch organisations')
      }
      
      const data = await response.json()
      setOrganisations(data)
    } catch (err) {
      console.error('Error fetching organisations:', err)
      setError('Failed to load organisations')
      toast({
        title: 'Error',
        description: 'Failed to load organisations',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Create a new organization
  const createOrganisation = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive"
      })
      return
    }
    
    setCreating(true)
    
    try {
      const response = await fetch('/api/dev-admin/organisations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dev-admin-password': process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD || ''
        },
        body: JSON.stringify({
          name,
          abbr: abbr || null,
          organisation_type: orgType === 'none' ? null : orgType
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create organisation')
      }
      
      // Clear form
      setName('')
      setAbbr('')
      setOrgType('')
      
      // Refresh organisation list
      fetchOrganisations()
      
      toast({
        title: "Success",
        description: "Organisation created successfully",
      })
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'An error occurred while creating the organisation',
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }
  
  // Show login form if not authenticated
  if (!authenticated) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Developer Admin Access</CardTitle>
            <CardDescription>
              This area is restricted to authorized developers only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); checkPassword(); }}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password">Developer Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Enter developer password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push('/')}>Back</Button>
            <Button onClick={checkPassword}>Access</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Developer Admin: Organisations</h1>
      
      {/* Create organisation form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create New Organisation</CardTitle>
          <CardDescription>Add a new organisation to the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createOrganisation} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Organisation Name *</Label>
                <Input 
                  id="name" 
                  placeholder="Enter organisation name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="abbr">Abbreviation</Label>
                <Input 
                  id="abbr" 
                  placeholder="e.g. ACME" 
                  value={abbr}
                  onChange={(e) => setAbbr(e.target.value)}
                  maxLength={10}
                />
              </div>
            </div>
            
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="type">Organisation Type</Label>
              <Select value={orgType} onValueChange={setOrgType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select organisation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                  <SelectItem value="Government">Government</SelectItem>
                  <SelectItem value="Homeschool">Homeschool</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button type="submit" disabled={creating} className="mt-4">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organisation
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Organisations list */}
      <Card>
        <CardHeader>
          <CardTitle>Organisations</CardTitle>
          <CardDescription>Manage existing organisations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center p-4 text-red-500">{error}</div>
          ) : organisations.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">No organisations found</div>
          ) : (
            <Table>
              <TableCaption>List of all organisations</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organisations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{org.abbr || '—'}</TableCell>
                    <TableCell>{org.organisation_type || '—'}</TableCell>
                    <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{org.id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={fetchOrganisations} disabled={loading}>
            Refresh
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 