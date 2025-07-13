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
  GripVertical
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
      content: "Hi! I'm Luna, your survey analytics assistant. I have access to all your survey response data and can provide detailed insights.\n\nTry asking me:\n• What are the biggest pain points for homeschool parents?\n• Which features should we prioritize for development?\n• How do pricing expectations vary by income level?\n• What demographic patterns do you see in the responses?\n• Show me correlations between education level and feature preferences",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [viewportHeight, setViewportHeight] = useState('100vh')
  const [panelWidth, setPanelWidth] = useState(320) // Default width (w-80 = 320px)
  const [isResizing, setIsResizing] = useState(false)
  
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const suggestedQuestions = [
    "What are the biggest pain points?",
    "Which features should we prioritize?",
    "How do pricing expectations vary?",
    "Show me demographic patterns",
    "Education level correlations"
  ]

  // Handle mobile detection and viewport changes
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    const handleResize = () => {
      checkMobile()
      
      if (window.innerWidth < 768) {
        const visualHeight = window.visualViewport?.height || window.innerHeight
        setViewportHeight(`${visualHeight}px`)
        const vh = visualHeight * 0.01
        document.documentElement.style.setProperty('--vh', `${vh}px`)
      } else {
        setViewportHeight('100vh')
        document.documentElement.style.removeProperty('--vh')
      }
    }

    handleResize()
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  // Prevent background scrolling on mobile when panel is open
  useEffect(() => {
    let originalBodyOverflow = ''
    let originalBodyPosition = ''
    let originalBodyTop = ''
    let originalBodyWidth = ''
    let originalBodyHeight = ''
    let originalDocElementOverflow = ''
    let scrollY = 0
    let stylesApplied = false

    if (isMobile && isOpen) {
      scrollY = window.scrollY
      const bodyStyle = window.getComputedStyle(document.body)
      originalBodyOverflow = bodyStyle.overflow
      originalBodyPosition = bodyStyle.position
      originalBodyTop = bodyStyle.top
      originalBodyWidth = bodyStyle.width
      originalBodyHeight = bodyStyle.height

      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.height = '100vh'

      originalDocElementOverflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      stylesApplied = true
    }

    return () => {
      if (stylesApplied) {
        document.body.style.overflow = originalBodyOverflow
        document.body.style.position = originalBodyPosition
        document.body.style.top = originalBodyTop
        document.body.style.width = originalBodyWidth
        document.body.style.height = originalBodyHeight
        document.documentElement.style.overflow = originalDocElementOverflow
        window.scrollTo(0, scrollY)
      }
    }
  }, [isMobile, isOpen])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const newWidth = window.innerWidth - e.clientX
    // Minimum width of 320px (w-80), maximum of 60% of screen width
    const minWidth = 320
    const maxWidth = window.innerWidth * 0.6
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    
    setPanelWidth(clampedWidth)
    onWidthChange?.(clampedWidth)
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

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
        timestamp: new Date()
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

  const formatContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.trim() === '') {
        return <br key={index} />
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
      
      return (
        <p key={index} className="mb-2">
          {line}
        </p>
      )
    })
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
    inputRef.current?.focus()
  }

  // Mobile full-screen layout
  if (isMobile && isOpen) {
    return (
      <div 
        className="fixed inset-0 flex flex-col bg-background mobile-chat-overlay"
        style={{ 
          height: viewportHeight,
          minHeight: viewportHeight,
          maxHeight: viewportHeight,
          zIndex: 9999,
          isolation: 'isolate'
        }}
      >
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 text-white flex items-center justify-between border-b flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg">
              <Image
                src="/web-app-manifest-512x512.png"
                alt="Learnology AI"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="font-medium text-lg">Survey Analytics</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                  <Database className="w-3 h-3 mr-1" />
                  Live Data
                </Badge>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Close Survey Analytics Panel"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Mobile Chat Thread */}
        <div className="flex-1 overflow-hidden min-h-0 relative bg-background">
          <ScrollArea ref={scrollAreaRef} className="h-full overscroll-contain">
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 max-w-full animate-in slide-in-from-bottom-2",
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
                  
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 max-w-[85%] break-words",
                      message.role === 'user'
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white ml-auto"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <div className="text-sm leading-relaxed">
                      {formatContent(message.content)}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start animate-in slide-in-from-bottom-2">
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
                      Analyzing survey data...
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Questions for Mobile */}
              {messages.length === 1 && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Quick questions:</p>
                  <div className="space-y-2">
                    {suggestedQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestedQuestion(question)}
                        className="text-xs h-7 text-left w-full justify-start"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Mobile Input Area */}
        <div className="p-4 border-t bg-background flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about survey insights..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Desktop side panel layout (like Luna)
  if (!isMobile && isOpen) {
    return (
      <aside
        ref={panelRef}
        className="fixed top-0 right-0 h-screen flex flex-col bg-background border-l border-[#E0E0E0] dark:border-[#333333] z-50 transform transition-transform duration-300 ease-in-out"
        style={{ width: `${panelWidth}px` }}
        aria-label="Survey Analytics Panel"
      >
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          className={cn(
            "absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-10",
            isResizing && "bg-blue-500"
          )}
          onMouseDown={handleMouseDown}
        />
        {/* Panel Header */}
        <div className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-[#E0E0E0] dark:border-[#333333] shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close Survey Analytics Panel"
              className="h-8 w-8 hover:bg-gradient-to-r hover:from-[#6B5DE5]/5 hover:to-[#6B5DE5]/10"
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg">
                <Image
                  src="/web-app-manifest-512x512.png"
                  alt="Learnology AI"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Survey Analytics</h2>
                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  <Database className="w-3 h-3 mr-1" />
                  Live Data
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Thread */}
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
                  
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 max-w-[85%] break-words",
                      message.role === 'user'
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white ml-auto"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <div className="text-sm leading-relaxed">
                      {formatContent(message.content)}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start animate-in slide-in-from-bottom-2">
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
                      Analyzing survey data...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="px-4 py-3 border-t bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-xs h-7"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about survey insights..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </aside>
    )
  }

  // Default: panel is not visible
  return null
} 