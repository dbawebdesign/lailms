'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { AlertTriangle } from 'lucide-react'
import type { AdminMessage } from '@/types/messaging'

interface PendingMessage extends AdminMessage {
  admin_message_responses: { id: string }[]
}

export default function AdminMessageModal() {
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    checkForPendingMessages()
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('admin_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_messages',
          filter: `to_user_id=eq.${supabase.auth.getUser().then(({ data }) => data.user?.id)}`
        },
        () => {
          checkForPendingMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const checkForPendingMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('admin_messages')
        .select(`
          id,
          subject,
          message,
          created_at,
          admin_message_responses (id)
        `)
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Find the first message without a response
      const unansweredMessage = data?.find(msg => msg.admin_message_responses.length === 0)
      
      if (unansweredMessage) {
        setPendingMessage(unansweredMessage)
      } else {
        setPendingMessage(null)
      }
    } catch (error) {
      console.error('Error checking for pending messages:', error)
    } finally {
      setChecking(false)
    }
  }

  const submitResponse = async () => {
    if (!pendingMessage || !response.trim()) {
      toast({
        title: "Error",
        description: "Please provide a response",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('admin_message_responses')
        .insert({
          message_id: pendingMessage.id,
          response: response.trim()
        })

      if (error) throw error

      toast({
        title: "Response Sent",
        description: "Your response has been sent to the administrators",
      })

      setPendingMessage(null)
      setResponse('')
    } catch (error) {
      console.error('Error submitting response:', error)
      toast({
        title: "Error",
        description: "Failed to send response. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Don't render anything while checking for messages
  if (checking) {
    return null
  }

  return (
    <Dialog open={!!pendingMessage} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Message from Administration
          </DialogTitle>
          <DialogDescription>
            You have received an important message that requires your response before you can continue.
          </DialogDescription>
        </DialogHeader>
        
        {pendingMessage && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg">{pendingMessage.subject}</h3>
              <p className="text-sm text-muted-foreground">
                Received: {formatDate(pendingMessage.created_at)}
              </p>
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <p className="whitespace-pre-wrap">{pendingMessage.message}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response">Your Response *</Label>
              <Textarea
                id="response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Please provide your response..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                onClick={submitResponse}
                disabled={loading || !response.trim()}
                className="min-w-24"
              >
                {loading ? "Sending..." : "Send Response"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}