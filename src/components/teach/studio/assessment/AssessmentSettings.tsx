'use client';

import React from 'react';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const settingsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['quiz', 'exam', 'practice']),
  status: z.enum(['draft', 'published']),
  timeLimit: z.number().int().positive().optional(),
  shuffleQuestions: z.boolean().default(false),
  showCorrectAnswers: z.boolean().default(false),
  passingScore: z.number().min(0).max(100).optional(),
});

type AssessmentSettingsValues = z.infer<typeof settingsSchema>;

interface AssessmentSettingsProps {
  initialData?: Partial<AssessmentSettingsValues>;
  onSave: (data: AssessmentSettingsValues) => void;
  isLoading?: boolean;
}

export const AssessmentSettings: React.FC<AssessmentSettingsProps> = ({ initialData, onSave, isLoading }) => {
  const form = useForm<AssessmentSettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'quiz',
      status: 'draft',
      shuffleQuestions: false,
      showCorrectAnswers: false,
      ...initialData,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Assessment Details</CardTitle>
            <CardDescription>Basic information about the assessment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "title"> }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chapter 1 Quiz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "description"> }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="A brief description of the assessment" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "type"> }) => (
                        <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an assessment type" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="quiz">Quiz</SelectItem>
                                <SelectItem value="exam">Exam</SelectItem>
                                <SelectItem value="practice">Practice</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "status"> }) => (
                        <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Behavioral settings for the assessment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="shuffleQuestions"
                    render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "shuffleQuestions"> }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel>Shuffle Questions</FormLabel>
                                <FormDescription>Randomize the order of questions for each student.</FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="showCorrectAnswers"
                    render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "showCorrectAnswers"> }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel>Show Correct Answers</FormLabel>
                                <FormDescription>Display correct answers after submission.</FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="passingScore"
                    render={({ field }: { field: ControllerRenderProps<AssessmentSettingsValues, "passingScore"> }) => (
                        <FormItem>
                        <FormLabel>Passing Score (%)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g. 70" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))}/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
            </CardContent>
        </Card>

        <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
        </div>
      </form>
    </Form>
  );
};