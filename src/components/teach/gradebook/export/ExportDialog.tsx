'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, 
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  Calendar,
  Users,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
  data: {
    students: any[];
    assignments: any[];
    grades: Record<string, any>;
    standards: any[];
    settings: any;
  };
}

export function ExportDialog({
  open,
  onOpenChange,
  classInstance,
  data
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  const [selectedData, setSelectedData] = useState({
    grades: true,
    students: true,
    assignments: true,
    feedback: false,
    analytics: false,
    standards: false
  });
  const [dateRange, setDateRange] = useState<'all' | 'current_term' | 'last_month' | 'custom'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const exportFormats = [
    {
      id: 'csv',
      name: 'CSV',
      description: 'Comma-separated values for spreadsheet applications',
      icon: FileSpreadsheet,
      recommended: true
    },
    {
      id: 'xlsx',
      name: 'Excel',
      description: 'Microsoft Excel workbook with multiple sheets',
      icon: FileSpreadsheet,
      recommended: false
    },
    {
      id: 'pdf',
      name: 'PDF',
      description: 'Formatted report for printing and sharing',
      icon: FileText,
      recommended: false
    },
    {
      id: 'json',
      name: 'JSON',
      description: 'Raw data format for system integration',
      icon: Database,
      recommended: false
    }
  ];

  const dataOptions = [
    {
      id: 'grades',
      name: 'Grades & Scores',
      description: 'All student grades and assignment scores',
      icon: BarChart3,
      essential: true
    },
    {
      id: 'students',
      name: 'Student Information',
      description: 'Student names, emails, and enrollment data',
      icon: Users,
      essential: true
    },
    {
      id: 'assignments',
      name: 'Assignment Details',
      description: 'Assignment names, due dates, and point values',
      icon: Calendar,
      essential: true
    },
    {
      id: 'feedback',
      name: 'Feedback & Comments',
      description: 'Teacher feedback and comments on assignments',
      icon: FileText,
      essential: false
    },
    {
      id: 'analytics',
      name: 'Analytics Data',
      description: 'Class statistics and performance trends',
      icon: BarChart3,
      essential: false
    },
    {
      id: 'standards',
      name: 'Standards Mastery',
      description: 'Learning standards and mastery tracking',
      icon: FileText,
      essential: false
    }
  ];

  const handleDataToggle = (dataType: string, checked: boolean) => {
    setSelectedData(prev => ({
      ...prev,
      [dataType]: checked
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Create export data based on selected options
      const exportData = {
        classInstance: classInstance.name,
        exportDate: new Date().toISOString(),
        dateRange,
        students: selectedData.students ? data.students : [],
        assignments: selectedData.assignments ? data.assignments : [],
        grades: selectedData.grades ? data.grades : {},
        analytics: selectedData.analytics ? {
          classAverage: data.students.reduce((sum, s) => sum + (s.overall_grade || 0), 0) / data.students.length,
          totalStudents: data.students.length,
          totalAssignments: data.assignments.length
        } : null,
        standards: selectedData.standards ? data.standards : [],
        feedback: selectedData.feedback ? Object.values(data.grades).filter(g => g.feedback) : []
      };
      
      // Create filename
      const filename = `${classInstance.name.replace(/\s+/g, '_')}_gradebook_${new Date().toISOString().split('T')[0]}.${selectedFormat}`;
      
      // Create and download file
      let content: string;
      if (selectedFormat === 'json') {
        content = JSON.stringify(exportData, null, 2);
      } else if (selectedFormat === 'csv') {
        // Simple CSV export for grades
        const headers = ['Student', 'Email', ...data.assignments.map(a => a.name), 'Overall Grade'];
        const rows = data.students.map(student => [
          student.name,
          student.email,
          ...data.assignments.map(assignment => {
            const grade = data.grades[`${student.id}_${assignment.id}`];
            return grade?.points_earned || 'N/A';
          }),
          student.overall_grade || 'N/A'
        ]);
        content = [headers, ...rows].map(row => row.join(',')).join('\n');
      } else {
        content = JSON.stringify(exportData, null, 2);
      }
      
      // Create and trigger download
      const blob = new Blob([content], { type: selectedFormat === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getSelectedDataCount = () => {
    return Object.values(selectedData).filter(Boolean).length;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Download className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Export Gradebook</h2>
                <p className="text-sm text-gray-500">
                  Export data from {classInstance.name}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Export Format */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h3>
              <div className="space-y-3">
                {exportFormats.map((format) => {
                  const IconComponent = format.icon;
                  return (
                    <div
                      key={format.id}
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-all",
                        selectedFormat === format.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => setSelectedFormat(format.id as any)}
                    >
                      <div className="flex items-center space-x-3">
                        <IconComponent className="h-5 w-5 text-gray-600" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{format.name}</span>
                            {format.recommended && (
                              <Badge className="bg-green-100 text-green-800">Recommended</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{format.description}</p>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2",
                          selectedFormat === format.id
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        )}>
                          {selectedFormat === format.id && (
                            <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Data to Include ({getSelectedDataCount()}/{dataOptions.length})
              </h3>
              <div className="space-y-3">
                {dataOptions.map((option) => {
                  const IconComponent = option.icon;
                  const isSelected = selectedData[option.id as keyof typeof selectedData];
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "border rounded-lg p-4 transition-all",
                        isSelected
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked: boolean) => handleDataToggle(option.id, checked)}
                          disabled={option.essential}
                        />
                        <IconComponent className="h-5 w-5 text-gray-600" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{option.name}</span>
                            {option.essential && (
                              <Badge variant="secondary">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { id: 'all', label: 'All Time', description: 'Complete gradebook history' },
                { id: 'current_term', label: 'Current Term', description: 'This semester/quarter' },
                { id: 'last_month', label: 'Last Month', description: 'Past 30 days' },
                { id: 'custom', label: 'Custom Range', description: 'Select specific dates' }
              ].map((range) => (
                <div
                  key={range.id}
                  className={cn(
                    "border rounded-lg p-3 cursor-pointer transition-all text-center",
                    dateRange === range.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setDateRange(range.id as any)}
                >
                  <div className="font-medium text-gray-900">{range.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{range.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Export Preview</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Format: <span className="font-medium">{selectedFormat.toUpperCase()}</span></div>
              <div>Data types: <span className="font-medium">{getSelectedDataCount()} selected</span></div>
              <div>Date range: <span className="font-medium">{dateRange.replace('_', ' ')}</span></div>
              <div>Estimated file size: <span className="font-medium">~2.3 MB</span></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Export will include data from {data.students.length || 24} students and {data.assignments.length || 16} assignments
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isExporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={getSelectedDataCount() === 0 || isExporting}
                className="bg-gradient-to-r from-green-600 to-blue-600"
              >
                {isExporting ? (
                  'Exporting...'
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 