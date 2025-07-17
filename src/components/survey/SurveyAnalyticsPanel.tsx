'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  BarChart3,
  X,
  Database,
  GripVertical,
  Download,
  Code,
  ExternalLink,
  Copy,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  visualization?: {
    file: string
    downloadUrl: string
    embedCode: string
    previewUrl: string
  }
  metadata?: {
    generatedAt: string
    fileSize: number
    visualizationType: string
    dataSource: string
    outputFormat?: string
  }
}

interface SurveyAnalyticsPanelProps {
  isOpen: boolean
  onClose: () => void
  className?: string
  onWidthChange?: (width: number) => void
}

export function SurveyAnalyticsPanel({ isOpen, onClose, className, onWidthChange }: SurveyAnalyticsPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Luna, your survey analytics assistant. I have access to all your survey response data from both authenticated users and public anonymous responses, giving you comprehensive insights.\n\n**Data Sources:**\n• Authenticated user surveys (registered users)\n• Public anonymous surveys (includes screening questions)\n\n**What I Can Do:**\n• Analyze data patterns and provide insights\n• Create interactive visualizations and charts\n• Generate presentation-ready graphics\n• Build social media content from your data\n\nTry asking me:\n• What are the biggest pain points for homeschool parents?\n• **Create a visual showing our problem/solution data**\n• **Generate an infographic about user demographics**\n• **Make a chart for my PowerPoint presentation**\n• How do responses differ between authenticated and public users?\n• Show me correlations between education level and feature preferences",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [viewportHeight, setViewportHeight] = useState('100vh')
  const [panelWidth, setPanelWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({})
  
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const suggestedQuestions = [
    "What are the biggest pain points?",
    "Create a visual for PowerPoint",
    "Generate a Google Slides presentation",
    "Make a social media graphic",
    "Show demographic patterns",
    "Create an interactive dashboard"
  ]

  // Mobile detection and viewport height handling
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    const updateViewportHeight = () => {
      setViewportHeight(`${window.innerHeight}px`)
    }

    checkMobile()
    updateViewportHeight()
    
    window.addEventListener('resize', checkMobile)
    window.addEventListener('resize', updateViewportHeight)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('resize', updateViewportHeight)
    }
  }, [])

  // Resize functionality
  const startResize = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = panelWidth

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX
      const newWidth = Math.max(280, Math.min(800, startWidth + deltaX))
      setPanelWidth(newWidth)
      onWidthChange?.(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth, onWidthChange])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/survey/analytics-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        visualization: data.visualization,
        metadata: data.metadata
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string, messageId: string, type: 'embed' | 'url') => {
    try {
      await navigator.clipboard.writeText(text)
      const key = `${messageId}-${type}`
      setCopiedStates(prev => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const renderVisualizationActions = (message: Message) => {
    if (!message.visualization) return null

    const { downloadUrl, embedCode, previewUrl } = message.visualization
    const embedKey = `${message.id}-embed`
    const urlKey = `${message.id}-url`

    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-blue-900">Interactive Visualization Ready</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Download Button */}
          <Button
            onClick={() => window.open(downloadUrl, '_blank')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <Download className="w-4 h-4" />
            Download HTML
          </Button>

          {/* Preview Button */}
          <Button
            onClick={() => window.open(previewUrl, '_blank')}
            variant="outline"
            className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            size="sm"
          >
            <ExternalLink className="w-4 h-4" />
            Preview
          </Button>

          {/* Copy Embed Code */}
          <Button
            onClick={() => copyToClipboard(embedCode, message.id, 'embed')}
            variant="outline"
            className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            size="sm"
          >
            {copiedStates[embedKey] ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Code className="w-4 h-4" />
            )}
            {copiedStates[embedKey] ? 'Copied!' : 'Copy Embed'}
          </Button>
        </div>

        {/* Embed Code Preview */}
        <div className="mt-3 p-3 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-x-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-500">Embed Code:</span>
            <Button
              onClick={() => copyToClipboard(embedCode, message.id, 'embed')}
              variant="ghost"
              size="sm"
              className="h-6 px-2"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <code className="block truncate">{embedCode}</code>
        </div>

        {/* Direct URL */}
        <div className="mt-2 p-3 bg-gray-100 rounded text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-500">Direct URL:</span>
            <Button
              onClick={() => copyToClipboard(downloadUrl, message.id, 'url')}
              variant="ghost"
              size="sm"
              className="h-6 px-2"
            >
              {copiedStates[urlKey] ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <code className="block truncate font-mono text-blue-600">{downloadUrl}</code>
        </div>

        {/* Metadata */}
        {message.metadata && (
          <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-4">
            <span>Type: {message.metadata.visualizationType}</span>
            <span>Size: {(message.metadata.fileSize / 1024).toFixed(1)}KB</span>
            <span>Generated: {new Date(message.metadata.generatedAt).toLocaleTimeString()}</span>
            {message.metadata.outputFormat && (
              <span>Format: {message.metadata.outputFormat === 'powerpoint' ? 'PowerPoint Ready' : 
                             message.metadata.outputFormat === 'google-slides' ? 'Google Slides Ready' : 
                             message.metadata.outputFormat}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  const formatContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.trim() === '') {
        return <br key={index} />
      }
      
      // Handle emoji bullets and enhanced formatting
      if (line.trim().startsWith('🎯') || line.trim().startsWith('📊') || line.trim().startsWith('🔗')) {
        return (
          <p key={index} className="mb-2 font-medium text-blue-900">
            {line.trim()}
          </p>
        )
      }
      
      // Handle bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <p key={index} className="ml-4 mb-1">
            {line.trim()}
          </p>
        )
      }
      
      // Handle numbered lists
      if (/^\d+\./.test(line.trim())) {
        return (
          <p key={index} className="ml-4 mb-1 font-medium">
            {line.trim()}
          </p>
        )
      }

      // Handle bold text
      if (line.includes('**')) {
        const parts = line.split('**')
        return (
          <p key={index} className="mb-2">
            {parts.map((part, i) => 
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </p>
        )
      }
      
      return (
        <p key={index} className="mb-2">
          {line}
        </p>
      )
    })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 h-full bg-white border-l border-gray-200 z-50 flex flex-col transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          isMobile ? "w-full" : "",
          className
        )}
        style={{
          width: !isMobile ? `${panelWidth}px` : '100%',
          height: viewportHeight
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Image
                src="/web-app-manifest-512x512.png"
                alt="Luna"
                width={16}
                height={16}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Luna Analytics</h2>
              <p className="text-sm text-blue-100">Survey Data & Visualizations</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 animate-in slide-in-from-bottom-2",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <Image
                        src="/web-app-manifest-512x512.png"
                        alt="Luna"
                        width={16}
                        height={16}
                        className="object-contain"
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 max-w-[85%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 break-words",
                        message.role === 'user'
                          ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white ml-auto"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <div className="text-sm leading-relaxed">
                        {formatContent(message.content)}
                      </div>
                    </div>
                    
                    {/* Visualization Actions */}
                    {renderVisualizationActions(message)}
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <Image
                      src="/web-app-manifest-512x512.png"
                      alt="Luna"
                      width={16}
                      height={16}
                      className="object-contain"
                    />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing data...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Suggested Questions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestedQuestions.map((question, index) => (
              <Button
                key={index}
                onClick={() => setInput(question)}
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2 bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
              >
                {question}
              </Button>
            ))}
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about survey data or request a visualization..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Resize Handle */}
        {!isMobile && (
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors group"
            onMouseDown={startResize}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-3 h-8 bg-gray-300 rounded-l-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <GripVertical className="w-3 h-3 text-gray-600" />
            </div>
          </div>
        )}
      </div>
    </>
  )
} 