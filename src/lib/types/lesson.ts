export interface PracticalExample {
  title: string;
  context: string;
  walkthrough: string;
  keyTakeaways: string[];
}

export interface CommonMisconception {
  misconception: string;
  correction: string;
  prevention: string;
}

export interface LessonContent {
  sectionTitle: string;
  introduction: string;
  conceptIntroduction: string;
  detailedExplanation: string;
  practicalExamples: PracticalExample[];
  commonMisconceptions: CommonMisconception[];
  realWorldConnections: string[];
  checkForUnderstanding: string[];
  expertInsights: string[];
  expertSummary: string;
  bridgeToNext: string;
} 