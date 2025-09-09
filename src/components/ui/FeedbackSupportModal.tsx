"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AccessibleModal } from '@/components/ui/accessible-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, MessageCircle, HelpCircle, Bug, AlertTriangle, Info } from 'lucide-react';
import { usePathname } from 'next/navigation';

// Form validation schema
const feedbackSchema = z.object({
  category: z.enum(['feedback', 'support', 'bug_report'], {
    required_error: "Please select a category",
  }),
  priority: z.enum(['low', 'medium', 'high', 'critical'], {
    required_error: "Please select a priority level",
  }),
  subject: z.string().min(5, "Subject must be at least 5 characters").max(100, "Subject must be less than 100 characters"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000, "Message must be less than 2000 characters"),
  contactEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  wantsFollowup: z.boolean().default(false),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'feedback' | 'support' | 'bug_report';
  initialPriority?: 'low' | 'medium' | 'high' | 'critical';
}

const categoryConfig = {
  feedback: {
    icon: MessageCircle,
    label: 'Feedback',
    description: 'Share your thoughts, suggestions, or ideas',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    priorities: ['low', 'medium', 'high'] as const,
  },
  support: {
    icon: HelpCircle,
    label: 'Support Request',
    description: 'Get help with using the platform',
    color: 'bg-green-100 text-green-800 border-green-200',
    priorities: ['low', 'medium', 'high', 'critical'] as const,
  },
  bug_report: {
    icon: Bug,
    label: 'Bug Report',
    description: 'Report a technical issue or error',
    color: 'bg-red-100 text-red-800 border-red-200',
    priorities: ['low', 'medium', 'high', 'critical'] as const,
  },
};

const priorityConfig = {
  low: { label: 'Low', icon: Info, color: 'text-gray-600' },
  medium: { label: 'Medium', icon: AlertTriangle, color: 'text-yellow-600' },
  high: { label: 'High', icon: AlertTriangle, color: 'text-orange-600' },
  critical: { label: 'Critical', icon: AlertTriangle, color: 'text-red-600' },
};

export const FeedbackSupportModal: React.FC<FeedbackSupportModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'feedback',
  initialPriority = 'medium',
}) => {
  const { toast } = useToast();
  const pathname = usePathname();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'category' | 'form' | 'success'>('category');
  const [selectedCategory, setSelectedCategory] = useState<'feedback' | 'support' | 'bug_report'>(initialCategory);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: initialCategory,
      priority: initialPriority,
      subject: '',
      message: '',
      contactEmail: '',
      wantsFollowup: false,
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('category');
      setSelectedCategory(initialCategory);
      setSubmissionResult(null);
      form.reset({
        category: initialCategory,
        priority: initialPriority,
        subject: '',
        message: '',
        contactEmail: '',
        wantsFollowup: false,
      });
    }
  }, [isOpen, initialCategory, initialPriority, form]);

  const handleCategorySelect = (category: 'feedback' | 'support' | 'bug_report') => {
    setSelectedCategory(category);
    form.setValue('category', category);
    // Set appropriate default priority based on category
    const defaultPriority = category === 'feedback' ? 'medium' : 'high';
    form.setValue('priority', defaultPriority);
    setStep('form');
  };

  const getBrowserInfo = () => {
    if (typeof window === 'undefined') return null;
    
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
    };
  };

  const handleSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    
    try {
      const submitData = {
        ...data,
        currentPage: pathname,
        browserInfo: getBrowserInfo(),
      };

      const response = await fetch('/api/feedback-support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      const result = await response.json();
      
      // Store submission result and show success step
      setSubmissionResult({ data, result });
      setStep('success');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSuccess = () => {
    if (!submissionResult) return null;
    
    const { data, result } = submissionResult;
    const config = categoryConfig[data.category as keyof typeof categoryConfig];
    const IconComponent = config.icon;
    
    const successMessages = {
      feedback: {
        title: "Thank you for your feedback! 🎉",
        description: `Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.`,
        followupText: data.wantsFollowup ? 'We\'ll follow up with you soon if needed.' : ''
      },
      support: {
        title: "Support request received! 🤝",
        description: `Your support request has been submitted successfully. Our team will review it and get back to you as soon as possible.`,
        followupText: data.wantsFollowup ? 'We\'ll contact you using the provided email address.' : 'You can expect a response within 24-48 hours.'
      },
      bug_report: {
        title: "Bug report submitted! 🐛",
        description: `Thank you for reporting this issue. Your bug report has been logged and our development team will investigate.`,
        followupText: data.wantsFollowup ? 'We\'ll keep you updated on the progress.' : 'We\'ll work on fixing this as soon as possible.'
      }
    };

    const successMessage = successMessages[data.category as keyof typeof successMessages];
    const submissionId = result.data?.id ? result.data.id.slice(-8) : '';
    
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <IconComponent className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
            {successMessage.title}
          </h3>
          <p className="text-muted-foreground">
            {successMessage.description}
          </p>
          {successMessage.followupText && (
            <p className="text-sm text-muted-foreground">
              {successMessage.followupText}
            </p>
          )}
        </div>

        {submissionId && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm font-medium">Reference ID</p>
            <p className="text-xs text-muted-foreground font-mono">{submissionId}</p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-medium">What you submitted:</h4>
          <div className="text-left bg-muted/30 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
                             <Badge variant="outline">
                 {priorityConfig[data.priority as keyof typeof priorityConfig].label}
               </Badge>
            </div>
            <p className="font-medium">{data.subject}</p>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {data.message}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={onClose} className="w-full max-w-xs">
            Close
          </Button>
        </div>
      </div>
    );
  };

  const renderCategorySelection = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">How can we help you?</h3>
        <p className="text-sm text-muted-foreground">Select the type of feedback you'd like to share</p>
      </div>
      
      <div className="space-y-3">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const IconComponent = config.icon;
          return (
            <button
              key={key}
              onClick={() => handleCategorySelect(key as 'feedback' | 'support' | 'bug_report')}
              className="w-full p-4 text-left border rounded-lg hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex items-start space-x-3">
                <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium">{config.label}</h4>
                    <Badge variant="outline" className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderForm = () => {
    const config = categoryConfig[selectedCategory];
    const IconComponent = config.icon;
    
    return (
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Category Header */}
        <div className="flex items-center space-x-2 pb-4 border-b">
          <IconComponent className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">{config.label}</h3>
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
          <button
            type="button"
            onClick={() => setStep('category')}
            className="ml-auto text-sm text-primary hover:underline"
          >
            Change
          </button>
        </div>

        {/* Priority Selection */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority Level</Label>
          <Select
            value={form.watch('priority')}
            onValueChange={(value) => form.setValue('priority', value as 'low' | 'medium' | 'high' | 'critical')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {config.priorities.map((priority) => {
                const priorityConf = priorityConfig[priority];
                const PriorityIcon = priorityConf.icon;
                return (
                  <SelectItem key={priority} value={priority}>
                    <div className="flex items-center space-x-2">
                      <PriorityIcon className={`h-4 w-4 ${priorityConf.color}`} />
                      <span>{priorityConf.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {form.formState.errors.priority && (
            <p className="text-sm text-destructive">{form.formState.errors.priority.message}</p>
          )}
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            placeholder={`Brief summary of your ${config.label.toLowerCase()}`}
            {...form.register('subject')}
          />
          {form.formState.errors.subject && (
            <p className="text-sm text-destructive">{form.formState.errors.subject.message}</p>
          )}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder={`Please provide detailed information about your ${config.label.toLowerCase()}...`}
            rows={6}
            {...form.register('message')}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{form.formState.errors.message?.message || ''}</span>
            <span>{form.watch('message')?.length || 0}/2000</span>
          </div>
        </div>

        {/* Contact Email */}
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact Email (Optional)</Label>
          <Input
            id="contactEmail"
            type="email"
            placeholder="your.email@example.com"
            {...form.register('contactEmail')}
          />
          {form.formState.errors.contactEmail && (
            <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
          )}
        </div>

        {/* Follow-up Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="wantsFollowup"
            checked={form.watch('wantsFollowup')}
            onCheckedChange={(checked) => form.setValue('wantsFollowup', !!checked)}
          />
          <Label htmlFor="wantsFollowup" className="text-sm">
            I would like to receive follow-up communication about this submission
          </Label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              selectedCategory === 'feedback' ? 'Share Feedback' :
              selectedCategory === 'support' ? 'Request Support' :
              'Report Bug'
            )}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'category' ? 'Feedback & Support' : 
             step === 'form' ? `Submit ${categoryConfig[selectedCategory].label}` : 
             'Submission Complete'}
      description={step === 'category' ? 'We value your feedback and are here to help' : undefined}
      size="lg"
      closeOnOverlayClick={!isSubmitting}
      closeOnEscape={!isSubmitting}
    >
      {step === 'category' ? renderCategorySelection() : 
       step === 'form' ? renderForm() : 
       renderSuccess()}
    </AccessibleModal>
  );
};
