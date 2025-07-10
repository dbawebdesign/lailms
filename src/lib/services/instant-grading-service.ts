import { NewSchemaQuestion, NewSchemaQuestionType } from '@/components/assessments/v2/types/newSchemaTypes';

export interface InstantFeedback {
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  feedback: string;
  explanation?: string;
  confidence: number; // 0.0 to 1.0
}

export class InstantGradingService {
  /**
   * Grade an answer instantly for objective question types
   * Returns null for subjective questions that need AI grading
   */
  static gradeAnswer(question: NewSchemaQuestion, studentAnswer: any): InstantFeedback | null {
    const maxPoints = question.points || 1;
    
    switch (question.question_type as NewSchemaQuestionType) {
      case 'multiple_choice':
        return this.gradeMultipleChoice(question, studentAnswer, maxPoints);
      
      case 'true_false':
        return this.gradeTrueFalse(question, studentAnswer, maxPoints);
      
      case 'matching':
        return this.gradeMatching(question, studentAnswer, maxPoints);
      
      case 'short_answer':
      case 'essay':
        // These require AI grading - return null to indicate no instant feedback
        return null;
      
      default:
        return null;
    }
  }

  private static gradeMultipleChoice(
    question: NewSchemaQuestion, 
    studentAnswer: string, 
    maxPoints: number
  ): InstantFeedback {
    const answerKey = question.answer_key || {};
    // Check both locations for correct answer
    const correctAnswer = question.correct_answer || answerKey.correct_answer || answerKey.correct_option;
    
    // Handle both old format (option text) and new format (letter)
    let userAnswer = studentAnswer;
    const options = question.options || answerKey.options || [];
    
    // If student answer is a letter (A, B, C, D), convert to option text
    if (studentAnswer && studentAnswer.match(/^[A-Z]$/)) {
      const optionIndex = studentAnswer.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      if (optionIndex >= 0 && optionIndex < options.length) {
        userAnswer = options[optionIndex];
      }
    }
    
    const isCorrect = correctAnswer === userAnswer;
    const pointsEarned = isCorrect ? maxPoints : 0;
    
    // Get feedback from answer key explanations
    let feedback = '';
    if (answerKey.explanations && typeof answerKey.explanations === 'object') {
      // Try to find explanation for the selected answer
      if (answerKey.explanations[userAnswer]) {
        feedback = answerKey.explanations[userAnswer];
      } else if (answerKey.explanations[studentAnswer]) {
        feedback = answerKey.explanations[studentAnswer];
      } else if (isCorrect) {
        feedback = 'Correct! Well done.';
      } else {
        feedback = 'Incorrect. Please review the material.';
      }
    } else {
      feedback = isCorrect ? 'Correct! Well done.' : 'Incorrect. Please review the material.';
    }
    
    return {
      isCorrect,
      pointsEarned,
      maxPoints,
      feedback,
      explanation: question.explanation,
      confidence: 1.0
    };
  }

  private static gradeTrueFalse(
    question: NewSchemaQuestion, 
    studentAnswer: boolean | string, 
    maxPoints: number
  ): InstantFeedback {
    const answerKey = question.answer_key || {};
    // For new schema, always use answer_key.correct_answer
    const correctAnswer = answerKey.correct_answer !== null && answerKey.correct_answer !== undefined 
      ? answerKey.correct_answer 
      : question.correct_answer;
    
    // DEBUG: Log the data types to identify the issue
    console.log('🐛 TRUE/FALSE GRADING DEBUG:');
    console.log('  Question ID:', question.id);
    console.log('  Student Answer (type):', typeof studentAnswer, studentAnswer);
    console.log('  Correct Answer (type):', typeof correctAnswer, correctAnswer);
    console.log('  Comparison Result:', correctAnswer === studentAnswer);
    
    // Handle both boolean and string inputs (convert string to boolean if needed)
    let normalizedStudentAnswer = studentAnswer;
    if (typeof studentAnswer === 'string') {
      normalizedStudentAnswer = studentAnswer.toLowerCase() === 'true';
      console.log('  Converted string to boolean:', normalizedStudentAnswer);
    }
    
    const isCorrect = correctAnswer === normalizedStudentAnswer;
    const pointsEarned = isCorrect ? maxPoints : 0;
    
    // Get feedback from answer key
    let feedback = '';
    if (answerKey.explanation) {
      feedback = answerKey.explanation;
    } else if (answerKey.true_explanation && answerKey.false_explanation) {
      feedback = correctAnswer ? answerKey.true_explanation : answerKey.false_explanation;
    } else {
      feedback = isCorrect ? 'Correct! Well done.' : 'Incorrect. Please review the material.';
    }
    
    return {
      isCorrect,
      pointsEarned,
      maxPoints,
      feedback,
      explanation: question.explanation,
      confidence: 1.0
    };
  }

  private static gradeMatching(
    question: NewSchemaQuestion, 
    studentAnswer: Record<string, string>, 
    maxPoints: number
  ): InstantFeedback {
    const answerKey = question.answer_key || {};
    const correctPairsArray = answerKey.pairs || [];
    
    // Convert pairs array to object for comparison
    const correctPairs: Record<string, string> = {};
    correctPairsArray.forEach((pair: any) => {
      correctPairs[pair.left] = pair.right;
    });
    
    let correctMatches = 0;
    const totalMatches = Object.keys(correctPairs).length;
    
    for (const [key, value] of Object.entries(correctPairs)) {
      if (studentAnswer[key] === value) {
        correctMatches++;
      }
    }
    
    const isCorrect = correctMatches === totalMatches;
    const pointsEarned = (correctMatches / totalMatches) * maxPoints;
    
    let feedback = '';
    if (isCorrect) {
      feedback = 'Excellent! All matches are correct.';
    } else {
      feedback = `You got ${correctMatches} out of ${totalMatches} matches correct. ${answerKey.explanation || 'Please review the material and try again.'}`;
    }
    
    return {
      isCorrect,
      pointsEarned,
      maxPoints,
      feedback,
      explanation: question.explanation,
      confidence: 1.0
    };
  }

  /**
   * Calculate total score from feedback results
   */
  static calculateTotalScore(feedbackResults: (InstantFeedback | null)[]): {
    totalPoints: number;
    earnedPoints: number;
    percentage: number;
  } {
    let totalPoints = 0;
    let earnedPoints = 0;
    
    feedbackResults.forEach(feedback => {
      if (feedback) {
        totalPoints += feedback.maxPoints;
        earnedPoints += feedback.pointsEarned;
      }
    });
    
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    
    return {
      totalPoints,
      earnedPoints,
      percentage: Math.round(percentage * 100) / 100 // Round to 2 decimal places
    };
  }
} 