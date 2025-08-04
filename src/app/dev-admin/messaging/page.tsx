'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { ArrowLeft, Send, MessageCircle, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import type { Profile, AdminMessageWithResponse } from '@/types/messaging'

interface AdminMessageWithProfile extends AdminMessageWithResponse {
  profiles: Profile
}

export default function MessagingPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [messages, setMessages] = useState<AdminMessageWithProfile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    loadUsers()
    loadMessages()
  }, [])

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, username, role')
        .neq('role', 'super_admin')
        .order('first_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_messages')
        .select(`
          id,
          from_admin_id,
          subject,
          message,
          created_at,
          updated_at,
          to_user_id,
          profiles!admin_messages_to_user_id_fkey (
            user_id,
            first_name,
            last_name,
            username,
            role
          ),
          admin_message_responses (
            response,
            responded_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      })
    } finally {
      setLoadingMessages(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedUserId || !subject.trim() || !messageContent.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('admin_messages')
        .insert({
          from_admin_id: user.id,
          to_user_id: selectedUserId,
          subject: subject.trim(),
          message: messageContent.trim()
        })

      if (error) throw error

      toast({
        title: "Success",
        description: "Message sent successfully",
      })

      // Reset form
      setSelectedUserId('')
      setSubject('')
      setMessageContent('')
      
      // Reload messages
      loadMessages()
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getUserDisplayName = (profile: Profile) => {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    return name || profile.username || 'Unknown User'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Link href="/dev-admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Dev Admin
        </Link>
        <h1 className="text-3xl font-bold mb-2">User Messaging</h1>
        <p className="text-muted-foreground">
          Send messages to users that require a response before they can continue using the application.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Message Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Message
            </CardTitle>
            <CardDescription>
              Send a mandatory message to a specific user
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{getUserDisplayName(user)}</span>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter message subject"
              />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Enter your message"
                rows={4}
              />
            </div>

            <Button 
              onClick={sendMessage} 
              disabled={loading || !selectedUserId || !subject.trim() || !messageContent.trim()}
              className="w-full"
            >
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Message History
            </CardTitle>
            <CardDescription>
              View sent messages and user responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <p className="text-muted-foreground">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground">No messages sent yet</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.map((message) => (
                  <div key={message.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{message.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          To: {getUserDisplayName(message.profiles)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {message.admin_message_responses.length > 0 ? (
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Responded
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm bg-muted p-2 rounded">
                      {message.message}
                    </p>

                    {message.admin_message_responses.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <h5 className="text-sm font-medium mb-1">Response:</h5>
                        <p className="text-sm bg-green-50 dark:bg-green-950 p-2 rounded">
                          {message.admin_message_responses[0].response}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Responded: {formatDate(message.admin_message_responses[0].responded_at)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}