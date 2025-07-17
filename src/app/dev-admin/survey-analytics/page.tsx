'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  PieChart, 
  Download,
  RefreshCw,
  Filter,
  AlertTriangle,
  Star,
  DollarSign,
  Target,
  Lightbulb,
  MessageSquare,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'

import { SurveyAnalyticsPanel } from '@/components/survey/SurveyAnalyticsPanel'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// Color palette for charts - following Apple/Tesla design principles with distinct colors
// Enhanced with better contrast ratios for accessibility
const CHART_COLORS = {
  primary: '#2563EB',      // Blue (darker for better contrast)
  secondary: '#059669',    // Green (darker for better contrast)
  accent: '#D97706',       // Amber (darker for better contrast)
  warning: '#DC2626',      // Red (darker for better contrast)
  info: '#7C3AED',         // Purple (darker for better contrast)
  muted: '#4B5563',        // Gray (darker for better contrast)
  success: '#047857',      // Emerald (darker for better contrast)
  // Distinct color palette for multi-data visualizations with enhanced contrast
  distinct: [
    '#2563EB',  // Blue (enhanced contrast)
    '#059669',  // Green (enhanced contrast)
    '#D97706',  // Amber (enhanced contrast)
    '#DC2626',  // Red (enhanced contrast)
    '#7C3AED',  // Purple (enhanced contrast)
    '#0891B2',  // Cyan (enhanced contrast)
    '#65A30D',  // Lime (enhanced contrast)
    '#EA580C',  // Orange (enhanced contrast)
    '#DB2777',  // Pink (enhanced contrast)
    '#4F46E5',  // Indigo (enhanced contrast)
  ],
  // High contrast colors specifically for pie charts and data points
  pieChart: [
    '#1E40AF',  // Deep Blue
    '#166534',  // Deep Green
    '#B45309',  // Deep Amber
    '#B91C1C',  // Deep Red
    '#6B21A8',  // Deep Purple
    '#0E7490',  // Deep Cyan
    '#4D7C0F',  // Deep Lime
    '#C2410C',  // Deep Orange
    '#BE185D',  // Deep Pink
    '#3730A3',  // Deep Indigo
  ],
  gradient: ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#65A30D', '#EA580C', '#DB2777', '#4F46E5']
}

// Score color mapping for intuitive understanding
const getScoreColor = (score: number, max: number = 5) => {
  const percentage = (score / max) * 100
  if (percentage >= 80) return CHART_COLORS.success
  if (percentage >= 60) return CHART_COLORS.primary
  if (percentage >= 40) return CHART_COLORS.accent
  return CHART_COLORS.warning
}

// Priority color mapping
const getPriorityColor = (rank: number) => {
  if (rank === 1) return CHART_COLORS.success
  if (rank === 2) return CHART_COLORS.primary
  if (rank === 3) return CHART_COLORS.accent
  return CHART_COLORS.muted
}

interface SurveyQuestion {
  id: number
  question_text: string
  question_type: string
  options: any
  section_id: number
  section_title: string
}

interface SurveyResponse {
  id: number
  user_id: string | null
  completed_at: string
  duration_seconds: number
  device_info: any
  source: 'authenticated' | 'public'
  email?: string
  session_id?: string
  ip_address?: string
  question_responses: Array<{
    question_id: number
    response_value: string
    response_text: string | null
    question: SurveyQuestion
  }>
}

interface AnalyticsData {
  responses: SurveyResponse[]
  questions: SurveyQuestion[]
  totalResponses: number
  authenticatedResponses: number
  publicResponses: number
  problemValidationScores: Record<string, number>
  featureImportanceScores: Record<string, number>
  primaryConcerns: Record<string, number>
      demographics: {
      approaches: Record<string, number>
      coopParticipation: Record<string, number>
      incomeRanges: Record<string, number>
      educationLevels: Record<string, number>
      pricingExpectations: Array<number>
      maxPricing: Array<number>
      npsScore: number
      npsResponses: Array<number>
      techPlatforms: Record<string, number>
    }
  dataQuality: {
    totalExpectedQuestions: number
    responsesWithDuration: number
    responsesWithDeviceInfo: number
    dataIntegrityScore: number
  }
}

export default function SurveyAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incomeFilter, setIncomeFilter] = useState<string>('all')
  const [educationFilter, setEducationFilter] = useState<string>('all')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [panelWidth, setPanelWidth] = useState(320)

  // Handle mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all survey data via admin API route (bypasses RLS to get ALL responses)
      const response = await fetch('/api/dev-admin/survey-analytics')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch survey data: ${response.statusText}`)
      }

      const { responses, questions, totalResponses, authenticatedResponses, publicResponses } = await response.json()

      // Calculate analytics from ALL survey responses
      const analytics = calculateAnalytics(responses, questions)
      analytics.totalResponses = totalResponses
      analytics.authenticatedResponses = authenticatedResponses
      analytics.publicResponses = publicResponses
      setData(analytics)

    } catch (err) {
      console.error('Error fetching survey data:', err)
      setError('Failed to load survey data')
    } finally {
      setLoading(false)
    }
  }

  const calculateAnalytics = (responses: SurveyResponse[], questions: SurveyQuestion[]): AnalyticsData => {
    // This function processes combined data from both authenticated and public surveys
    // Question mappings:
    // - Problem Validation: Q1-7 (auth) + Q47-53 (public)
    // - Feature Importance: Q8-14 (auth) + Q54-60 (public)
    // - Primary Concerns: Q15 (auth) + Q61 (public)
    // - Demographics: Q16-23 (auth) + Q62-69 (public)
    // - NPS: Q22 (auth) + Q68 (public)
    // Filter responses based on selected demographics
    const filteredResponses = responses.filter(response => {
      if (incomeFilter !== 'all') {
        const incomeResponse = response.question_responses.find(qr => qr.question_id === 18 || qr.question_id === 64)
        if (!incomeResponse || incomeResponse.response_value !== incomeFilter) return false
      }
      
      if (educationFilter !== 'all') {
        const educationResponse = response.question_responses.find(qr => qr.question_id === 19 || qr.question_id === 65)
        if (!educationResponse || educationResponse.response_value !== educationFilter) return false
      }
      
      return true
    })

    // Problem Validation Analysis (Questions 1-7 from auth, 47-53 from public)
    const problemValidationScores: Record<string, number> = {}
    const likertScale = ['Strongly Disagree', 'Disagree', 'Somewhat Agree', 'Agree', 'Strongly Agree']
    
    // Map of authenticated question IDs to public question IDs
    const problemValidationMapping = [
      { auth: 1, public: 47 },
      { auth: 2, public: 48 },
      { auth: 3, public: 49 },
      { auth: 4, public: 50 },
      { auth: 5, public: 51 },
      { auth: 6, public: 52 },
      { auth: 7, public: 53 }
    ]
    
    problemValidationMapping.forEach(({ auth, public: pub }) => {
      // Get responses from both authenticated and public surveys
      const questionResponses = filteredResponses.flatMap(r => 
        r.question_responses.filter(qr => qr.question_id === auth || qr.question_id === pub)
      )
      
      if (questionResponses.length > 0) {
        const averageScore = questionResponses.reduce((sum, qr) => {
          const score = likertScale.indexOf(qr.response_value) + 1
          return sum + (score || 0)
        }, 0) / questionResponses.length
        
        // Use the authenticated question for the label (they have the same text)
        const question = questions.find(q => q.id === auth)
        if (question) {
          problemValidationScores[question.question_text] = averageScore
        }
      }
    })

    // Feature Importance Analysis (Questions 8-14 from auth, 54-60 from public)
    const featureImportanceScores: Record<string, number> = {}
    const importanceScale = ['Very Unimportant', 'Unimportant', 'Neutral', 'Somewhat Important', 'Very Important']
    
    // Map of authenticated question IDs to public question IDs
    const featureImportanceMapping = [
      { auth: 8, public: 54 },
      { auth: 9, public: 55 },
      { auth: 10, public: 56 },
      { auth: 11, public: 57 },
      { auth: 12, public: 58 },
      { auth: 13, public: 59 },
      { auth: 14, public: 60 }
    ]
    
    featureImportanceMapping.forEach(({ auth, public: pub }) => {
      // Get responses from both authenticated and public surveys
      const questionResponses = filteredResponses.flatMap(r => 
        r.question_responses.filter(qr => qr.question_id === auth || qr.question_id === pub)
      )
      
      if (questionResponses.length > 0) {
        const averageScore = questionResponses.reduce((sum, qr) => {
          const score = importanceScale.indexOf(qr.response_value) + 1
          return sum + (score || 0)
        }, 0) / questionResponses.length
        
        // Use the authenticated question for the label (they have the same text)
        const question = questions.find(q => q.id === auth)
        if (question) {
          featureImportanceScores[question.question_text] = averageScore
        }
      }
    })

    // Primary Concerns Analysis (Question 15 from auth, 61 from public)
    const primaryConcerns: Record<string, number> = {}
    const concernResponses = filteredResponses.flatMap(r => 
      r.question_responses.filter(qr => qr.question_id === 15 || qr.question_id === 61)
    )
    concernResponses.forEach(qr => {
      primaryConcerns[qr.response_value] = (primaryConcerns[qr.response_value] || 0) + 1
    })

    // Demographics Analysis
    const demographics = {
      approaches: {} as Record<string, number>,
      coopParticipation: {} as Record<string, number>,
      incomeRanges: {} as Record<string, number>,
      educationLevels: {} as Record<string, number>,
      pricingExpectations: [] as number[],
      maxPricing: [] as number[],
      npsScore: 0,
      npsResponses: [] as number[],
      techPlatforms: {} as Record<string, number>
    }

    // Process demographics
    filteredResponses.forEach(response => {
      response.question_responses.forEach(qr => {
        switch (qr.question_id) {
          case 16: // Homeschooling approaches (authenticated)
          case 62: // Homeschooling approaches (public)
            try {
              const approaches = JSON.parse(qr.response_value)
              approaches.forEach((approach: string) => {
                demographics.approaches[approach] = (demographics.approaches[approach] || 0) + 1
              })
            } catch (e) {
              // Handle single value responses
              demographics.approaches[qr.response_value] = (demographics.approaches[qr.response_value] || 0) + 1
            }
            break
          case 17: // Co-op participation (authenticated)
          case 63: // Co-op participation (public)
            demographics.coopParticipation[qr.response_value] = (demographics.coopParticipation[qr.response_value] || 0) + 1
            break
          case 18: // Income ranges (authenticated)
          case 64: // Income ranges (public)
            demographics.incomeRanges[qr.response_value] = (demographics.incomeRanges[qr.response_value] || 0) + 1
            break
          case 19: // Education levels (authenticated)
          case 65: // Education levels (public)
            demographics.educationLevels[qr.response_value] = (demographics.educationLevels[qr.response_value] || 0) + 1
            break
          case 20: // Expected pricing (authenticated)
          case 66: // Expected pricing (public)
            const expectedPrice = parseFloat(qr.response_value)
            if (!isNaN(expectedPrice)) {
              demographics.pricingExpectations.push(expectedPrice)
            }
            break
          case 21: // Max pricing (authenticated)
          case 67: // Max pricing (public)
            const maxPrice = parseFloat(qr.response_value)
            if (!isNaN(maxPrice)) {
              demographics.maxPricing.push(maxPrice)
            }
            break
          case 22: // NPS Score (authenticated survey)
          case 68: // NPS Score (public survey)
            const npsValue = parseFloat(qr.response_value)
            if (!isNaN(npsValue)) {
              // Store individual NPS responses for proper calculation
              if (!demographics.npsResponses) {
                demographics.npsResponses = []
              }
              demographics.npsResponses.push(npsValue)
            }
            break
          case 23: // Tech platforms (authenticated)
          case 69: // Tech platforms (public)
            try {
              const platforms = JSON.parse(qr.response_value)
              platforms.forEach((platform: string) => {
                demographics.techPlatforms[platform] = (demographics.techPlatforms[platform] || 0) + 1
              })
            } catch (e) {
              demographics.techPlatforms[qr.response_value] = (demographics.techPlatforms[qr.response_value] || 0) + 1
            }
            break
        }
      })
    })

    // Calculate proper NPS score using standard methodology
    // Combines responses from both authenticated (Q22) and public (Q68) surveys
    if (demographics.npsResponses.length > 0) {
      const promoters = demographics.npsResponses.filter(score => score >= 9).length
      const detractors = demographics.npsResponses.filter(score => score <= 6).length
      const totalResponses = demographics.npsResponses.length
      
      // NPS = (% of Promoters) - (% of Detractors)
      const promoterPercentage = (promoters / totalResponses) * 100
      const detractorPercentage = (detractors / totalResponses) * 100
      demographics.npsScore = promoterPercentage - detractorPercentage
    } else {
      demographics.npsScore = 0
    }

    // Calculate data quality metrics
    const totalExpectedQuestions = 23 // We have 23 questions in total
    const responsesWithDuration = filteredResponses.filter(r => r.duration_seconds > 0).length
    const responsesWithDeviceInfo = filteredResponses.filter(r => r.device_info !== null).length
    
    const dataIntegrityScore = filteredResponses.length > 0 
      ? ((responsesWithDuration + responsesWithDeviceInfo) / (filteredResponses.length * 2)) * 100
      : 0

    return {
      responses: filteredResponses,
      questions,
      totalResponses: filteredResponses.length,
      authenticatedResponses: filteredResponses.filter(r => r.source === 'authenticated').length,
      publicResponses: filteredResponses.filter(r => r.source === 'public').length,
      problemValidationScores,
      featureImportanceScores,
      primaryConcerns,
      demographics,
      dataQuality: {
        totalExpectedQuestions,
        responsesWithDuration,
        responsesWithDeviceInfo,
        dataIntegrityScore
      }
    }
  }

  // Memoized calculations for insights
  const insights = useMemo(() => {
    if (!data) return null

    const topProblems = Object.entries(data.problemValidationScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)

    const topFeatures = Object.entries(data.featureImportanceScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)

    const averageExpectedPrice = data.demographics.pricingExpectations.length > 0
      ? data.demographics.pricingExpectations.reduce((a, b) => a + b, 0) / data.demographics.pricingExpectations.length
      : 0

    const averageMaxPrice = data.demographics.maxPricing.length > 0
      ? data.demographics.maxPricing.reduce((a, b) => a + b, 0) / data.demographics.maxPricing.length
      : 0

    // Standard NPS interpretation logic for -100 to +100 scale
    const npsScore = data.demographics.npsScore;
    let npsCategory = '';
    let npsDescription = '';
    if (npsScore >= 70) {
      npsCategory = 'World-class loyalty';
      npsDescription = 'NPS above 70 indicates world-class customer loyalty.';
    } else if (npsScore >= 50) {
      npsCategory = 'Excellent';
      npsDescription = 'NPS above 50 is considered excellent.';
    } else if (npsScore >= 0) {
      npsCategory = 'Generally good';
      npsDescription = 'NPS above 0 means more promoters than detractors.';
    } else {
      npsCategory = 'Problematic';
      npsDescription = 'NPS below 0 means more detractors than promoters.';
    }

    return {
      topProblems,
      topFeatures,
      averageExpectedPrice,
      averageMaxPrice,
      npsCategory,
      npsDescription,
      npsScore: npsScore
    }
  }, [data])

  useEffect(() => {
    fetchAnalyticsData()
  }, [incomeFilter, educationFilter])

  const exportData = () => {
    if (!data) return
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Question,Response,User ID,Completed At\n" +
      data.responses.flatMap(r => 
        r.question_responses.map(qr => 
          `"${qr.question.question_text}","${qr.response_value}","${r.user_id}","${r.completed_at}"`
        )
      ).join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "survey_analytics.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading survey analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchAnalyticsData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Main Content */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out min-h-screen",
          "px-6 py-6"
        )}
        style={{
          width: !isMobile && isPanelOpen ? `calc(100vw - ${panelWidth}px)` : '100vw'
        }}
      >
        <div className="container mx-auto max-w-7xl">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Survey Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Actionable insights from homeschool parent survey responses
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAnalyticsData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Demographic Filters
          </CardTitle>
          <CardDescription>
            Filter responses by demographic characteristics to see patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Income Range</label>
              <Select value={incomeFilter} onValueChange={setIncomeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All income ranges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All income ranges</SelectItem>
                  <SelectItem value="Less than $30,000">Less than $30,000</SelectItem>
                  <SelectItem value="$30,000-$49,999">$30,000-$49,999</SelectItem>
                  <SelectItem value="$50,000-$74,999">$50,000-$74,999</SelectItem>
                  <SelectItem value="$75,000-$99,999">$75,000-$99,999</SelectItem>
                  <SelectItem value="$100,000-$149,999">$100,000-$149,999</SelectItem>
                  <SelectItem value="More than $150,000">More than $150,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Education Level</label>
              <Select value={educationFilter} onValueChange={setEducationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All education levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All education levels</SelectItem>
                  <SelectItem value="High school diploma">High school diploma</SelectItem>
                  <SelectItem value="Some college">Some college</SelectItem>
                  <SelectItem value="Bachelor's degree">Bachelor's degree</SelectItem>
                  <SelectItem value="Graduate degree">Graduate degree</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Badge variant="outline" className="h-fit">
                {data?.totalResponses || 0} responses filtered
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights Overview */}
      {insights && (
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Top Problem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-tight text-gray-900">
                  {insights.topProblems[0]?.[0]?.substring(0, 50)}...
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Progress 
                      value={(insights.topProblems[0]?.[1] || 0) / 5 * 100} 
                      className="h-2"
                      style={{ 
                        background: `linear-gradient(to right, ${CHART_COLORS.warning}20, ${CHART_COLORS.warning}40)`
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold text-red-600">
                    {insights.topProblems[0]?.[1]?.toFixed(1)}/5
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Most Wanted Feature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-tight text-gray-900">
                  {insights.topFeatures[0]?.[0]?.substring(0, 50)}...
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Progress 
                      value={(insights.topFeatures[0]?.[1] || 0) / 5 * 100} 
                      className="h-2"
                      style={{ 
                        background: `linear-gradient(to right, ${CHART_COLORS.accent}20, ${CHART_COLORS.accent}40)`
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold text-yellow-600">
                    {insights.topFeatures[0]?.[1]?.toFixed(1)}/5
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Price Expectation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-green-600">
                    ${insights.averageExpectedPrice.toFixed(0)}
                  </span>
                  <span className="text-sm text-green-700">
                    /month
                  </span>
                </div>
                <div className="text-xs text-green-700">
                  Max tolerance: ${insights.averageMaxPrice.toFixed(0)}
                </div>
                <Progress 
                  value={(insights.averageExpectedPrice / insights.averageMaxPrice) * 100} 
                  className="h-2"
                  style={{ 
                    background: `linear-gradient(to right, ${CHART_COLORS.success}20, ${CHART_COLORS.success}40)`
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                <Target className="w-4 h-4" />
                NPS Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-600">
                    {insights.npsScore.toFixed(0)}
                  </span>
                  <span className="text-sm text-blue-700">
                    NPS
                  </span>
                </div>
                <div className="text-xs text-blue-700">
                  {insights.npsCategory}
                </div>
                <div className="text-xs text-blue-500">
                  {insights.npsDescription}
                </div>
                <Progress 
                  value={Math.max(0, (insights.npsScore + 100) / 2)} 
                  className="h-2"
                  style={{ 
                    background: `linear-gradient(to right, ${CHART_COLORS.primary}20, ${CHART_COLORS.primary}40)`
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

             <Tabs defaultValue="problems" className="space-y-6">
         <TabsList className="grid w-full grid-cols-6">
           <TabsTrigger value="problems">Problem Validation</TabsTrigger>
           <TabsTrigger value="features">Feature Importance</TabsTrigger>
           <TabsTrigger value="concerns">Primary Concerns</TabsTrigger>
           <TabsTrigger value="demographics">Demographics</TabsTrigger>
           <TabsTrigger value="insights">Strategic Insights</TabsTrigger>
           <TabsTrigger value="quality">Data Quality</TabsTrigger>
         </TabsList>

        <TabsContent value="problems" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Chart View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-300 font-semibold">
                  <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Problem Validation Scores
                </CardTitle>
                <CardDescription className="text-gray-700 dark:text-gray-400 font-normal">
                  Visual ranking of homeschooling challenges by agreement level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(data?.problemValidationScores || {})
                        .sort(([,a], [,b]) => b - a)
                        .map(([problem, score], index) => ({
                          name: problem.length > 25 ? problem.substring(0, 25) + '...' : problem,
                          fullName: problem,
                          score: score
                        }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="name" 
                        fontSize={12}
                        tick={{ fill: '#9CA3AF', fontWeight: 500 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={[0, 5]} 
                        fontSize={12}
                        tick={{ fill: '#9CA3AF', fontWeight: 500 }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)}/5`, 'Score']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          color: '#374151',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      />
                      <Bar 
                        dataKey="score" 
                        radius={[4, 4, 0, 0]}
                      >
                        {Object.entries(data?.problemValidationScores || {})
                          .sort(([,a], [,b]) => b - a)
                          .map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getScoreColor(entry[1], 5)} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Detailed List View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-300 font-semibold">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  Detailed Problem Analysis
                </CardTitle>
                <CardDescription className="text-gray-700 dark:text-gray-400 font-normal">
                  Ranked by agreement level (1=Strongly Disagree, 5=Strongly Agree)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {Object.entries(data?.problemValidationScores || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([problem, score], index) => (
                      <div key={problem} className="space-y-3 p-3 rounded-lg border bg-white hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: getPriorityColor(index + 1) }}
                            >
                              {index + 1}
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold leading-tight mb-2 text-gray-900">
                              {problem}
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <Progress 
                                  value={(score / 5) * 100} 
                                  className="h-2"
                                  style={{ 
                                    background: `linear-gradient(to right, ${getScoreColor(score, 5)}20, ${getScoreColor(score, 5)}40)`
                                  }}
                                />
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span 
                                  className="text-lg font-bold"
                                  style={{ color: getScoreColor(score, 5) }}
                                >
                                  {score.toFixed(1)}
                                </span>
                                <span className="text-sm text-gray-800 font-semibold">/5</span>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-700 mt-1 font-semibold">
                              <span>Low Agreement</span>
                              <span>High Agreement</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Chart View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-300 font-semibold">
                  <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  Feature Importance Ranking
                </CardTitle>
                <CardDescription className="text-gray-700 dark:text-gray-400 font-normal">
                  Visual ranking of feature importance by parent ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(data?.featureImportanceScores || {})
                        .sort(([,a], [,b]) => b - a)
                        .map(([feature, score], index) => ({
                          name: feature.length > 25 ? feature.substring(0, 25) + '...' : feature,
                          fullName: feature,
                          score: score
                        }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="name" 
                        fontSize={12}
                        tick={{ fill: '#9CA3AF', fontWeight: 500 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={[0, 5]} 
                        fontSize={12}
                        tick={{ fill: '#9CA3AF', fontWeight: 500 }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)}/5`, 'Score']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          color: '#374151',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      />
                      <Bar 
                        dataKey="score" 
                        radius={[4, 4, 0, 0]}
                      >
                        {Object.entries(data?.featureImportanceScores || {})
                          .sort(([,a], [,b]) => b - a)
                          .map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getScoreColor(entry[1], 5)} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Priority Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600" />
                  Development Priority Matrix
                </CardTitle>
                <CardDescription>
                  Feature prioritization based on importance scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {Object.entries(data?.featureImportanceScores || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([feature, score], index) => {
                      const priority = index < 3 ? 'High' : index < 6 ? 'Medium' : 'Low'
                      const priorityColor = index < 3 ? 'bg-green-100 text-green-800 border-green-200' : 
                                          index < 6 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                          'bg-gray-100 text-gray-800 border-gray-200'
                      
                      return (
                        <div key={feature} className="space-y-3 p-3 rounded-lg border bg-white hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: getPriorityColor(index + 1) }}
                              >
                                {index + 1}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <p className="text-sm font-semibold leading-tight flex-1 pr-2 text-gray-900">
                                  {feature}
                                </p>
                                <Badge className={`text-xs ${priorityColor}`}>
                                  {priority}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <Progress 
                                    value={(score / 5) * 100} 
                                    className="h-2"
                                    style={{ 
                                      background: `linear-gradient(to right, ${getScoreColor(score, 5)}20, ${getScoreColor(score, 5)}40)`
                                    }}
                                  />
                                </div>
                                <div className="text-right flex-shrink-0">
                                                                  <span 
                                  className="text-lg font-bold"
                                  style={{ color: getScoreColor(score, 5) }}
                                >
                                  {score.toFixed(1)}
                                </span>
                                <span className="text-sm text-gray-800 font-semibold">/5</span>
                                </div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-600 mt-1 font-medium">
                                <span>Unimportant</span>
                                <span>Very Important</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="concerns" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pie Chart View */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-300 font-semibold">
                  <PieChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Concern Distribution
                </CardTitle>
                <CardDescription className="text-gray-700 dark:text-gray-400 font-normal">
                  Visual breakdown of primary concerns about AI adoption
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={Object.entries(data?.primaryConcerns || {})
                          .sort(([,a], [,b]) => b - a)
                          .map(([concern, count], index) => ({
                            name: concern.length > 30 ? concern.substring(0, 30) + '...' : concern,
                            fullName: concern,
                            value: count,
                            percentage: data?.totalResponses ? (count / data.totalResponses) * 100 : 0
                          }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percentage }: any) => percentage > 10 ? `${percentage.toFixed(1)}%` : ''}
                        outerRadius={80}
                        dataKey="value"
                        style={{ fontSize: '14px', fontWeight: 700 }}
                      >
                        {Object.entries(data?.primaryConcerns || {})
                          .sort(([,a], [,b]) => b - a)
                          .map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS.pieChart[index % CHART_COLORS.pieChart.length]} />
                          ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => [
                          `${value} responses (${props.payload.percentage.toFixed(1)}%)`, 
                          props.payload.fullName
                        ]}
                        labelStyle={{ color: '#374151', fontWeight: 600 }}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          color: '#374151',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Concerns List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Detailed Concern Analysis
                </CardTitle>
                <CardDescription>
                  Ranked concerns with response counts and percentages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {Object.entries(data?.primaryConcerns || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([concern, count], index) => {
                      const percentage = data?.totalResponses ? (count / data.totalResponses) * 100 : 0
                      const severity = percentage >= 30 ? 'High' : percentage >= 15 ? 'Medium' : 'Low'
                      const severityColor = percentage >= 30 ? 'bg-red-100 text-red-800 border-red-200' : 
                                           percentage >= 15 ? 'bg-orange-100 text-orange-800 border-orange-200' : 
                                           'bg-yellow-100 text-yellow-800 border-yellow-200'
                      
                      return (
                        <div key={concern} className="space-y-3 p-3 rounded-lg border bg-white hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div 
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: CHART_COLORS.distinct[index % CHART_COLORS.distinct.length] }}
                              >
                                {index + 1}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <p className="text-sm font-semibold leading-tight flex-1 pr-2 text-gray-900">
                                  {concern}
                                </p>
                                <Badge className={`text-xs ${severityColor}`}>
                                  {severity}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <Progress 
                                    value={percentage} 
                                    className="h-2"
                                    style={{ 
                                      background: `linear-gradient(to right, ${CHART_COLORS.distinct[index % CHART_COLORS.distinct.length]}20, ${CHART_COLORS.distinct[index % CHART_COLORS.distinct.length]}40)`
                                    }}
                                  />
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span 
                                    className="text-lg font-bold"
                                    style={{ color: CHART_COLORS.distinct[index % CHART_COLORS.distinct.length] }}
                                  >
                                    {count}
                                  </span>
                                  <span className="text-sm text-gray-800 font-semibold ml-2">
                                    ({percentage.toFixed(1)}%)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6">
          <div className="grid gap-6">
            {/* Top Row - Key Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Responses</p>
                      <p className="text-2xl font-bold text-blue-600">{data?.totalResponses || 0}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {data?.authenticatedResponses || 0} Authenticated
                        </Badge>
                        <Badge className="text-xs bg-green-600 text-white border-none">{data?.publicResponses || 0} Public</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Expected Price</p>
                      <p className="text-2xl font-bold text-green-600">${insights?.averageExpectedPrice.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600 rounded-lg">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Price Tolerance</p>
                      <p className="text-2xl font-bold text-purple-600">${insights?.averageMaxPrice.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-600 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">NPS Score</p>
                      <p className="text-2xl font-bold text-amber-600">{insights?.npsScore.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle Row - Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-300 font-semibold">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Homeschooling Approaches
                  </CardTitle>
                  <CardDescription className="text-gray-700 dark:text-gray-400 font-normal">Distribution of current teaching methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(data?.demographics.approaches || {})
                          .sort(([,a], [,b]) => b - a)
                          .map(([approach, count], index) => ({
                            name: approach.length > 20 ? approach.substring(0, 20) + '...' : approach,
                            fullName: approach,
                            value: count,
                            percentage: data?.totalResponses ? (count / data.totalResponses) * 100 : 0,
                            fill: CHART_COLORS.distinct[index % CHART_COLORS.distinct.length]
                          }))}
                        margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis 
                          dataKey="name" 
                          fontSize={12}
                          tick={{ fill: '#9CA3AF', fontWeight: 500 }}
                        />
                        <YAxis 
                          fontSize={12}
                          tick={{ fill: '#9CA3AF', fontWeight: 500 }}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `${value} responses (${props.payload.percentage.toFixed(1)}%)`, 
                            props.payload.fullName
                          ]}
                          labelStyle={{ color: '#374151', fontWeight: 600 }}
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: 500
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {Object.entries(data?.demographics.approaches || {})
                            .sort(([,a], [,b]) => b - a)
                            .map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS.distinct[index % CHART_COLORS.distinct.length]} />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-300 font-semibold">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    Income Distribution
                  </CardTitle>
                  <CardDescription className="text-gray-700 dark:text-gray-400 font-normal">Household income ranges of respondents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={Object.entries(data?.demographics.incomeRanges || {})
                            .sort(([,a], [,b]) => b - a)
                            .map(([range, count], index) => ({
                              name: range,
                              value: count,
                              percentage: data?.totalResponses ? (count / data.totalResponses) * 100 : 0
                            }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ percentage }: any) => percentage > 10 ? `${percentage.toFixed(1)}%` : ''}
                          outerRadius={80}
                          dataKey="value"
                          style={{ fontSize: '14px', fontWeight: 700 }}
                        >
                          {Object.entries(data?.demographics.incomeRanges || {})
                            .sort(([,a], [,b]) => b - a)
                            .map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS.pieChart[index % CHART_COLORS.pieChart.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `${value} responses (${props.payload.percentage.toFixed(1)}%)`, 
                            props.payload.name
                          ]}
                          labelStyle={{ color: '#374151', fontWeight: 600 }}
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #D1D5DB',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: 500
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row - Tables */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Pricing Analysis
                  </CardTitle>
                  <CardDescription>Expected vs maximum pricing tolerance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-green-800">Expected Price</span>
                        <span className="text-2xl font-bold text-green-600">
                          ${insights?.averageExpectedPrice.toFixed(0)}/month
                        </span>
                      </div>
                      <div className="text-xs text-green-700">
                        Range: ${Math.min(...(data?.demographics.pricingExpectations || [0]))} - ${Math.max(...(data?.demographics.pricingExpectations || [0]))}
                      </div>
                      <div className="mt-2">
                        <Progress 
                          value={insights?.averageExpectedPrice ? (insights.averageExpectedPrice / 100) * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-purple-800">Maximum Price</span>
                        <span className="text-2xl font-bold text-purple-600">
                          ${insights?.averageMaxPrice.toFixed(0)}/month
                        </span>
                      </div>
                      <div className="text-xs text-purple-700">
                        Range: ${Math.min(...(data?.demographics.maxPricing || [0]))} - ${Math.max(...(data?.demographics.maxPricing || [0]))}
                      </div>
                      <div className="mt-2">
                        <Progress 
                          value={insights?.averageMaxPrice ? (insights.averageMaxPrice / 150) * 100 : 0} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Technology Usage
                  </CardTitle>
                  <CardDescription>Current educational technology platforms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {Object.entries(data?.demographics.techPlatforms || {})
                      .sort(([,a], [,b]) => b - a)
                      .map(([platform, count], index) => {
                        const percentage = data?.totalResponses ? (count / data.totalResponses) * 100 : 0
                        return (
                          <div key={platform} className="p-3 rounded-lg border bg-white hover:bg-gray-50/50 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-gray-900">{platform}</span>
                              <div className="flex items-center gap-2">
                                <span 
                                  className="text-lg font-bold"
                                  style={{ color: CHART_COLORS.distinct[index % CHART_COLORS.distinct.length] }}
                                >
                                  {count}
                                </span>
                                <span className="text-sm text-gray-800 font-semibold">
                                  ({percentage.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                            <Progress 
                              value={percentage} 
                              className="h-2"
                              style={{ 
                                background: `linear-gradient(to right, ${CHART_COLORS.distinct[index % CHART_COLORS.distinct.length]}20, ${CHART_COLORS.distinct[index % CHART_COLORS.distinct.length]}40)`
                              }}
                            />
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  Product Development Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Top Priority Features</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      {insights?.topFeatures.slice(0, 3).map(([feature, score], index) => (
                        <li key={feature}>
                          {index + 1}. {feature.substring(0, 60)}... ({score.toFixed(1)}/5)
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-900 mb-2">Biggest Pain Points</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {insights?.topProblems.slice(0, 3).map(([problem, score], index) => (
                        <li key={problem}>
                          {index + 1}. {problem.substring(0, 60)}... ({score.toFixed(1)}/5)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600" />
                  Business Strategy Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Pricing Strategy</h4>
                    <p className="text-sm text-green-800">
                      Target price: ${insights?.averageExpectedPrice.toFixed(0)}/month with flexibility up to ${insights?.averageMaxPrice.toFixed(0)}/month. 
                      Price sensitivity varies by income level.
                    </p>
                  </div>

                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-medium text-orange-900 mb-2">Market Concerns</h4>
                    <p className="text-sm text-orange-800">
                      Primary concern: {Object.entries(data?.primaryConcerns || {})
                        .sort(([,a], [,b]) => b - a)[0]?.[0]}. 
                      Address this in marketing and product design.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">Customer Satisfaction</h4>
                    <p className="text-sm text-purple-800">
                      NPS Score: {insights?.npsScore.toFixed(0)} ({insights?.npsCategory}). <br />
                      {insights?.npsDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Demographic Patterns & Recommendations</CardTitle>
              <CardDescription>
                Key insights based on respondent characteristics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Income-Based Insights</h4>
                  <p className="text-sm text-muted-foreground">
                    Higher income families show greater willingness to pay premium prices for time-saving features.
                    Consider tiered pricing model.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Education Level Patterns</h4>
                  <p className="text-sm text-muted-foreground">
                    Parents with higher education levels prioritize curriculum control and customization features.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Technology Adoption</h4>
                  <p className="text-sm text-muted-foreground">
                    Most families already use educational technology, indicating readiness for AI-powered solutions.
                  </p>
                </div>
              </div>
                         </CardContent>
           </Card>
         </TabsContent>



         <TabsContent value="quality" className="space-y-6">
           <div className="grid gap-6 md:grid-cols-2">
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <CheckCircle className="w-5 h-5 text-green-600" />
                   Data Quality Overview
                 </CardTitle>
                 <CardDescription>
                   Validation metrics for survey response data integrity
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                     <span className="font-medium text-green-900">Data Integrity Score</span>
                     <span className="text-2xl font-bold text-green-600">
                       {data?.dataQuality?.dataIntegrityScore?.toFixed(1) || '0'}%
                     </span>
                   </div>

                   <div className="space-y-3">
                     <div className="flex justify-between items-center">
                       <span className="text-sm">Duration Tracking</span>
                       <div className="flex items-center gap-2">
                         {(data?.dataQuality?.responsesWithDuration || 0) === (data?.totalResponses || 0) ? (
                           <CheckCircle className="w-4 h-4 text-green-600" />
                         ) : (
                           <XCircle className="w-4 h-4 text-red-600" />
                         )}
                         <span className="font-medium">
                           {data?.dataQuality?.responsesWithDuration || 0}/{data?.totalResponses || 0}
                         </span>
                       </div>
                     </div>

                     <div className="flex justify-between items-center">
                       <span className="text-sm">Device Information</span>
                       <div className="flex items-center gap-2">
                         {(data?.dataQuality?.responsesWithDeviceInfo || 0) === (data?.totalResponses || 0) ? (
                           <CheckCircle className="w-4 h-4 text-green-600" />
                         ) : (
                           <XCircle className="w-4 h-4 text-red-600" />
                         )}
                         <span className="font-medium">
                           {data?.dataQuality?.responsesWithDeviceInfo || 0}/{data?.totalResponses || 0}
                         </span>
                       </div>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Response Validation Details</CardTitle>
                 <CardDescription>
                   Detailed breakdown of data completeness and accuracy
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                   <div className="p-4 border rounded-lg">
                     <h4 className="font-medium mb-2">Expected Questions per Response</h4>
                     <p className="text-2xl font-bold">{data?.dataQuality?.totalExpectedQuestions || 23}</p>
                     <p className="text-sm text-muted-foreground">
                       Each response should contain answers to all 23 questions across 4 sections
                     </p>
                   </div>

                   <div className="p-4 border rounded-lg">
                     <h4 className="font-medium mb-2">Data Collection Status</h4>
                     <div className="space-y-2">
                       <div className="flex justify-between text-sm">
                         <span>Question Responses</span>
                         <span className="font-medium">
                           {data?.responses?.reduce((sum, r) => sum + r.question_responses.length, 0) || 0} total
                         </span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span>Average Duration</span>
                         <span className="font-medium">
                           {data?.responses?.filter(r => r.duration_seconds > 0).length && data.responses.length > 0
                             ? Math.round(
                                 data.responses
                                   .filter(r => r.duration_seconds > 0)
                                   .reduce((sum, r) => sum + r.duration_seconds, 0) /
                                 data.responses.filter(r => r.duration_seconds > 0).length
                               )
                             : 0
                           } seconds
                         </span>
                       </div>
                       <div className="flex justify-between text-sm">
                         <span>Device Data Collected</span>
                         <span className="font-medium">
                           {((data?.dataQuality?.responsesWithDeviceInfo || 0) / (data?.totalResponses || 1) * 100).toFixed(0)}%
                         </span>
                       </div>
                     </div>
                   </div>

                   {(data?.dataQuality?.dataIntegrityScore || 0) < 100 && (
                     <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                       <h4 className="font-medium text-yellow-900 mb-2">Data Quality Recommendations</h4>
                       <ul className="text-sm text-yellow-800 space-y-1">
                         {(data?.dataQuality?.responsesWithDuration || 0) < (data?.totalResponses || 0) && (
                           <li>• Duration tracking is incomplete - verify timer implementation</li>
                         )}
                         {(data?.dataQuality?.responsesWithDeviceInfo || 0) < (data?.totalResponses || 0) && (
                           <li>• Device information collection needs improvement</li>
                         )}
                       </ul>
                     </div>
                   )}
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
       </Tabs>

       {/* AI Analytics Chat Button */}
       {!isPanelOpen && (
         <Button 
           onClick={() => setIsPanelOpen(true)}
           className={cn(
             "fixed z-50 rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl",
             // Glassmorphism styling
             "backdrop-blur-md bg-white/20 border border-white/30",
             "hover:bg-white/30 hover:border-white/40",
             "dark:bg-black/20 dark:border-white/20 dark:hover:bg-black/30",
             isMobile 
               ? 'bottom-6 right-6 h-14 w-14 p-0' 
               : 'bottom-4 right-4 h-12 w-12 p-0'
           )}
           aria-label="Open Survey Analytics Assistant"
         >
           <Image
             src="/web-app-manifest-512x512.png"
             alt="Survey Analytics Assistant"
             width={isMobile ? 24 : 20}
             height={isMobile ? 24 : 20}
             className="object-contain"
           />
         </Button>
       )}

       </div>
       </div>

       {/* Survey Analytics Panel - Outside main content for proper positioning */}
       <SurveyAnalyticsPanel 
         isOpen={isPanelOpen} 
         onClose={() => setIsPanelOpen(false)}
         onWidthChange={setPanelWidth}
       />
     </>
   )
 } 