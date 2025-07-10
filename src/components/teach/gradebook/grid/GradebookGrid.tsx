'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  Target,
  Sparkles,
  BookOpen,
  Users,
  Calendar,
  Award,
  Star,
  Eye,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tables } from '../../../../../packages/types/db';
import { gradeService } from '@/lib/services/gradebook';

type Assignment = Tables<'assignments'>;

interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  overall_grade?: number;
  grade_letter?: string;
  missing_assignments?: number;
  late_assignments?: number;
  mastery_level?: 'below' | 'approaching' | 'proficient' | 'advanced';
}

interface Grade {
  student_id: string;
  assignment_id: string;
  points_earned?: number;
  percentage?: number;
  letter_grade?: string;
  status: 'graded' | 'missing' | 'late' | 'excused' | 'pending';
  feedback?: string;
  submitted_at?: string;
  graded_at?: string;
}

interface GradebookGridProps {
  classInstance: {
    id: string;
    name: string;
    base_class_id: string;
    enrollment_code: string;
    settings?: any;
  };
  data: {
    students: Student[];
    assignments: Assignment[];
    grades: Record<string, Grade>;
    standards: any[];
    settings: any;
  };
  selectedStudents: string[];
  onSelectedStudentsChange: (students: string[]) => void;
  onStudentSelect: (studentId: string) => void;
  onDataChange?: () => void; // Add callback for data refresh
  isLoading: boolean;
}

export function GradebookGrid({
  classInstance,
  data,
  selectedStudents,
  onSelectedStudentsChange,
  onStudentSelect,
  onDataChange,
  isLoading
}: GradebookGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'percentage' | 'points' | 'letter'>('percentage');
  const [filterBy, setFilterBy] = useState<'all' | 'at-risk' | 'excelling'>('all');
  const [editingCell, setEditingCell] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [studentActionsOpen, setStudentActionsOpen] = useState(false);
  const [selectedStudentForActions, setSelectedStudentForActions] = useState<Student | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    name: '',
    description: '',
    type: 'assignment',
    points_possible: 100,
    due_date: '',
    category: ''
  });

  // Use live data from props
  const students = data.students;
  const assignments = data.assignments;
  const grades = data.grades;

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterBy === 'at-risk') {
      return (student.overall_grade || 0) < 75 || (student.missing_assignments || 0) > 1;
    }
    if (filterBy === 'excelling') {
      return (student.overall_grade || 0) >= 90 && (student.missing_assignments || 0) === 0;
    }
    
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectedStudentsChange(filteredStudents.map(s => s.id));
    } else {
      onSelectedStudentsChange([]);
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      onSelectedStudentsChange([...selectedStudents, studentId]);
    } else {
      onSelectedStudentsChange(selectedStudents.filter(id => id !== studentId));
    }
  };

  const handleCellClick = (studentId: string, assignmentId: string, currentValue: string) => {
    setEditingCell({ studentId, assignmentId });
    setCellValue(currentValue);
  };

  const handleCellSave = async (studentId: string, assignmentId: string) => {
    try {
      if (!cellValue.trim()) {
        // If cell value is empty, find and delete the existing grade
        const existingGrade = await gradeService.getGrade(studentId, assignmentId);
        if (existingGrade) {
          await gradeService.deleteGrade(existingGrade.id);
        }
      } else {
        // Parse the input based on view mode
        let pointsEarned: number | null = null;
        let percentage: number | null = null;
        let letterGrade: string | null = null;

        if (viewMode === 'percentage') {
          const pct = parseFloat(cellValue);
          if (!isNaN(pct) && pct >= 0 && pct <= 100) {
            percentage = pct;
            // Find the assignment to calculate points
            const assignment = assignments.find(a => a.id === assignmentId);
            if (assignment && assignment.points_possible) {
              pointsEarned = Math.round((pct / 100) * assignment.points_possible * 100) / 100;
            }
          }
        } else if (viewMode === 'points') {
          const pts = parseFloat(cellValue);
          if (!isNaN(pts) && pts >= 0) {
            pointsEarned = pts;
            // Find the assignment to calculate percentage
            const assignment = assignments.find(a => a.id === assignmentId);
            if (assignment && assignment.points_possible && assignment.points_possible > 0) {
              percentage = Math.round((pts / assignment.points_possible) * 100 * 100) / 100;
            }
          }
        } else if (viewMode === 'letter') {
          letterGrade = cellValue.toUpperCase();
        }

        // Create or update the grade using upsert
        await gradeService.upsertGrade({
          student_id: studentId,
          assignment_id: assignmentId,
          class_instance_id: classInstance.id,
          points_earned: pointsEarned,
          percentage: percentage,
          status: 'graded',
          graded_at: new Date().toISOString(),
          graded_by: null // Will be set by RLS policy based on current user
        });
      }
      
      setEditingCell(null);
      setCellValue('');
      onDataChange?.(); // Notify parent to refresh data
    } catch (error) {
      console.error('Error saving grade:', error);
      alert('Failed to save grade. Please try again.');
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setCellValue('');
  };

  const handleCreateAssignment = () => {
    setAssignmentDialogOpen(true);
  };

  const handleSaveAssignment = () => {
    // TODO: Save new assignment
    console.log('Creating assignment:', newAssignment);
    setAssignmentDialogOpen(false);
    setNewAssignment({
      name: '',
      description: '',
      type: 'assignment',
      points_possible: 100,
      due_date: '',
      category: ''
    });
  };

  const handleStudentActions = (student: Student) => {
    setSelectedStudentForActions(student);
    setStudentActionsOpen(true);
  };

  const getGradeDisplay = (student: Student, assignment: Assignment) => {
    const gradeKey = `${student.id}-${assignment.id}`;
    const grade = grades[gradeKey];
    
    if (!grade) {
      return { display: '-', className: 'text-muted-foreground', value: '' };
    }
    
    if (grade.status === 'missing') {
      return { display: 'Missing', className: 'text-destructive font-medium', value: '' };
    }
    
    if (grade.status === 'late') {
      return { display: 'Late', className: 'text-warning font-medium', value: grade.percentage?.toString() || '' };
    }
    
    if (grade.status === 'excused') {
      return { display: 'Excused', className: 'text-muted-foreground font-medium', value: '' };
    }
    
    if (viewMode === 'percentage' && grade.percentage) {
      const color = grade.percentage >= 90 ? 'text-success' :
                   grade.percentage >= 80 ? 'text-info' :
                   grade.percentage >= 70 ? 'text-warning' : 'text-destructive';
      return { display: `${grade.percentage}%`, className: `${color} font-medium`, value: grade.percentage.toString() };
    }
    
    if (viewMode === 'points' && grade.points_earned) {
      return { display: `${grade.points_earned}/${assignment.points_possible}`, className: 'text-foreground font-medium', value: grade.points_earned.toString() };
    }
    
    if (viewMode === 'letter' && grade.letter_grade) {
      return { display: grade.letter_grade, className: 'text-foreground font-medium', value: grade.letter_grade };
    }
    
    return { display: '-', className: 'text-muted-foreground', value: '' };
  };

  const getMasteryBadge = (level: string) => {
    switch (level) {
      case 'advanced':
        return <Badge className="bg-success/10 text-success border-success/20 text-xs">Advanced</Badge>;
      case 'proficient':
        return <Badge className="bg-info/10 text-info border-info/20 text-xs">Proficient</Badge>;
      case 'approaching':
        return <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">Approaching</Badge>;
      case 'below':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Below</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-h3 font-medium text-foreground">Loading gradebook...</h3>
            <p className="text-caption text-muted-foreground">Please wait while we load your data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-8 border-b border-divider bg-surface/30">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-h1 font-bold text-foreground">Grade Management</h2>
            <p className="text-body text-muted-foreground mt-2">
              Track and manage student grades and assignments
            </p>
          </div>
          <Button 
            onClick={handleCreateAssignment}
            className="bg-brand-gradient hover:opacity-90 transition-airy shadow-md hover:shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Assignment
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-divider focus:border-primary/50"
            />
          </div>
          
          <Select value={filterBy} onValueChange={(value) => setFilterBy(value as any)}>
            <SelectTrigger className="w-40 border-divider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="excelling">Excelling</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
            <SelectTrigger className="w-40 border-divider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="points">Points</SelectItem>
              <SelectItem value="letter">Letter Grade</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gradebook Table */}
      <div className="flex-1 overflow-auto bg-background">
        <table className="w-full">
          {/* Table Header */}
          <thead className="bg-surface/50 sticky top-0 z-10 border-b border-divider">
            <tr>
              <th className="text-left p-4 w-12 bg-surface/50">
                <Checkbox
                  checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="text-left p-4 min-w-[200px] bg-surface/50 sticky left-16">
                <span className="text-caption font-semibold text-foreground uppercase tracking-wide">Student</span>
              </th>
              <th className="text-center p-4 w-24 bg-surface/50">
                <span className="text-caption font-semibold text-foreground uppercase tracking-wide">Overall</span>
              </th>
              {assignments.filter(a => a.published).map((assignment) => (
                <th key={assignment.id} className="text-center p-4 w-32 bg-surface/50">
                  <div className="space-y-1">
                    <div className="text-caption font-medium text-foreground">{assignment.name}</div>
                    <div className="text-xs text-muted-foreground">{assignment.points_possible}pts</div>
                  </div>
                </th>
              ))}
              <th className="text-center p-4 w-20 bg-surface/50">
                <span className="text-caption font-semibold text-foreground uppercase tracking-wide">Actions</span>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-divider">
            {filteredStudents.map((student) => (
              <tr 
                key={student.id} 
                className={cn(
                  "hover:bg-surface/30 transition-airy group",
                  selectedStudents.includes(student.id) && "bg-info/5"
                )}
              >
                {/* Checkbox */}
                <td className="p-4 bg-background group-hover:bg-surface/30 transition-airy">
                  <Checkbox
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={(checked) => handleSelectStudent(student.id, !!checked)}
                  />
                </td>

                {/* Student Info */}
                <td className="p-4 bg-background group-hover:bg-surface/30 transition-airy sticky left-16">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-brand-gradient rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{student.name}</div>
                      <div className="flex items-center gap-2">
                        {getMasteryBadge(student.mastery_level || 'approaching')}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Overall Grade */}
                <td className="p-4 text-center">
                  <div className="space-y-1">
                    <div className={cn(
                      "text-body font-semibold",
                      (student.overall_grade || 0) >= 90 ? 'text-success' :
                      (student.overall_grade || 0) >= 80 ? 'text-info' :
                      (student.overall_grade || 0) >= 70 ? 'text-warning' : 'text-destructive'
                    )}>
                      {student.overall_grade ? `${student.overall_grade}%` : '-'}
                    </div>
                    <div className="text-caption text-muted-foreground">
                      {student.grade_letter || '-'}
                    </div>
                  </div>
                </td>

                {/* Assignment Grades */}
                {assignments.filter(a => a.published).map((assignment) => {
                  const gradeInfo = getGradeDisplay(student, assignment);
                  const isEditing = editingCell?.studentId === student.id && editingCell?.assignmentId === assignment.id;
                  
                  return (
                    <td key={assignment.id} className="p-4 text-center">
                      {isEditing ? (
                        <Input
                          value={cellValue}
                          onChange={(e) => setCellValue(e.target.value)}
                          onBlur={() => handleCellSave(student.id, assignment.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCellSave(student.id, assignment.id);
                            } else if (e.key === 'Escape') {
                              handleCellCancel();
                            }
                          }}
                          className="w-20 h-8 text-center text-sm border-divider focus:border-primary/50"
                          autoFocus
                        />
                      ) : (
                        <div
                          className={cn(
                            "cursor-pointer hover:bg-surface/50 rounded px-2 py-1 transition-airy",
                            gradeInfo.className
                          )}
                          onClick={() => handleCellClick(student.id, assignment.id, gradeInfo.value)}
                        >
                          {gradeInfo.display}
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* Actions */}
                <td className="p-4 text-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleStudentActions(student)}
                    className="hover:bg-surface/50 transition-airy"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assignment Creation Modal */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-2xl bg-background border-divider">
          <DialogHeader>
            <DialogTitle className="text-h2 text-foreground">Create New Assignment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-body font-medium text-foreground">Assignment Name</Label>
                <Input
                  value={newAssignment.name}
                  onChange={(e) => setNewAssignment({...newAssignment, name: e.target.value})}
                  placeholder="Enter assignment name"
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-body font-medium text-foreground">Type</Label>
                <Select value={newAssignment.type} onValueChange={(value) => setNewAssignment({...newAssignment, type: value})}>
                  <SelectTrigger className="border-divider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="homework">Homework</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="discussion">Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-body font-medium text-foreground">Description</Label>
              <Textarea
                value={newAssignment.description}
                onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                placeholder="Describe the assignment"
                rows={3}
                className="border-divider focus:border-primary/50"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-body font-medium text-foreground">Points Possible</Label>
                <Input
                  type="number"
                  value={newAssignment.points_possible}
                  onChange={(e) => setNewAssignment({...newAssignment, points_possible: Number(e.target.value)})}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-body font-medium text-foreground">Due Date</Label>
                <Input
                  type="datetime-local"
                  value={newAssignment.due_date}
                  onChange={(e) => setNewAssignment({...newAssignment, due_date: e.target.value})}
                  className="border-divider focus:border-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-body font-medium text-foreground">Category</Label>
                <Input
                  value={newAssignment.category}
                  onChange={(e) => setNewAssignment({...newAssignment, category: e.target.value})}
                  placeholder="e.g. Assessments"
                  className="border-divider focus:border-primary/50"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setAssignmentDialogOpen(false)}
                className="border-divider hover:bg-surface/80"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveAssignment}
                className="bg-brand-gradient hover:opacity-90 transition-airy"
              >
                Create Assignment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Actions Modal */}
      <Dialog open={studentActionsOpen} onOpenChange={setStudentActionsOpen}>
        <DialogContent className="bg-background border-divider">
          <DialogHeader>
            <DialogTitle className="text-h2 text-foreground">
              Student Actions - {selectedStudentForActions?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="justify-start h-12 border-divider hover:bg-surface/80">
                <Eye className="w-4 h-4 mr-3" />
                View Details
              </Button>
              <Button variant="outline" className="justify-start h-12 border-divider hover:bg-surface/80">
                <MessageSquare className="w-4 h-4 mr-3" />
                Send Message
              </Button>
              <Button variant="outline" className="justify-start h-12 border-divider hover:bg-surface/80">
                <Mail className="w-4 h-4 mr-3" />
                Email Student
              </Button>
              <Button variant="outline" className="justify-start h-12 border-divider hover:bg-surface/80">
                <Phone className="w-4 h-4 mr-3" />
                Contact Parent
              </Button>
              <Button variant="outline" className="justify-start h-12 border-divider hover:bg-surface/80">
                <FileText className="w-4 h-4 mr-3" />
                Grade Report
              </Button>
              <Button variant="outline" className="justify-start h-12 border-divider hover:bg-surface/80">
                <Settings className="w-4 h-4 mr-3" />
                Adjustments
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 