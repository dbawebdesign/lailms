import OpenAI from 'openai';
import { APIError } from 'openai/error';
import { encode } from 'gpt-tokenizer';
import pLimit from 'p-limit';
import { Database } from '@learnologyai/types';

type Question = Partial<Database['public']['Tables']['questions']['Row']>;
type QuestionType = Database['public']['Enums']['question_type'];

const limit = pLimit(5); // Allow up to 5 concurrent requests

export class QuestionGenerationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 3, // Automatically retry up to 3 times
    });
  }

  async generateQuestionsFromContent(
    content: string,
    count: number,
    questionTypes: QuestionType[],
    baseClassId: string,
    tags: string[]
  ): Promise<Partial<Question>[]> {
    const prompt = this.buildPrompt(content, count, questionTypes);

    try {
      const response = await limit(() => 
        this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert educational assessment creator.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        })
      );

      if (!response) {
        throw new Error('API call was limited and returned no response.');
      }
      
      const messageContent = response.choices[0].message?.content;
      if (!messageContent) {
        throw new Error("Received empty message content from OpenAI.");
      }
      
      console.log(`OpenAI response tokens (estimate): ${this.countTokens(messageContent)}`);
      
      const rawQuestions = this.parseResponse(messageContent);
      return this.formatQuestions(rawQuestions, baseClassId, tags);
    } catch (error) {
      if (error instanceof APIError) {
        console.error(`OpenAI API Error: ${error.status} ${error.name}`, {
          headers: error.headers,
          error: error.error
        });
      } else {
        console.error('Error generating questions:', error);
      }
      
      // Re-throw a generic error to the caller
      throw new Error('Failed to generate questions using AI');
    }
  }

  private preprocessContent(content: string): string {
    // Remove markdown images and links
    let cleanedContent = content.replace(/!\[.*?\]\(.*?\)/g, '');
    cleanedContent = cleanedContent.replace(/\[(.*?)\]\(.*?\)/g, '$1');

    // Remove markdown headings, bold, italics, etc.
    cleanedContent = cleanedContent.replace(/[#*_`]/g, '');

    // Normalize whitespace
    cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
    
    return cleanedContent;
  }

  private buildPrompt(content: string, count: number, questionTypes: QuestionType[]): string {
    const questionTypeExamples: Record<QuestionType, any> = {
      multiple_choice: {
        question_text: "What is the capital of France?",
        options: [
          { text: "Berlin", value: "berlin" },
          { text: "Madrid", value: "madrid" },
          { text: "Paris", value: "paris" },
          { text: "Rome", value: "rome" }
        ],
        correct_answer: "paris"
      },
      true_false: {
        question_text: "The earth is flat.",
        correct_answer: "false"
      },
      short_answer: {
        question_text: "Who wrote 'To Kill a Mockingbird'?",
        correct_answer: "Harper Lee"
      },
      long_answer: {
        question_text: "Discuss the main themes in '1984' by George Orwell.",
        correct_answer: "A discussion covering themes like totalitarianism, surveillance, and propaganda."
      },
      coding: {
        question_text: "Write a Python function `add(a, b)` that returns the sum of two numbers.",
        correct_answer: "def add(a, b):\\n  return a + b"
      }
    };

    const requestedQuestionExamples = questionTypes.map(type => ({
      type,
      ...questionTypeExamples[type]
    }));

    const processedContent = this.preprocessContent(content);

    const prompt = `
You are an expert educational assessment creator. Your task is to generate high-quality assessment questions based on the provided content.

### CONTENT TO ANALYZE ###
\`\`\`
${processedContent}
\`\`\`

### REQUIREMENTS ###
1.  **Generate Questions**: Create exactly ${count} questions.
2.  **Question Types**: The questions should be of the following types: ${questionTypes.join(', ')}.
3.  **JSON Output**: The output MUST be a valid JSON array of question objects. Do not include any text or formatting outside of the JSON array.
4.  **High Quality**: Questions should be clear, unambiguous, and directly relevant to the provided content.

### JSON OUTPUT STRUCTURE ###
Each question object in the JSON array must have the following structure:
-   \`question_text\`: (string) The full text of the question.
-   \`question_type\`: (string) One of the requested types: ${questionTypes.map(t => `'${t}'`).join(' | ')}.
-   \`options\`: (array of objects) Required for 'multiple_choice'. Each object must have 'text' and 'value' properties.
-   \`correct_answer\`: (string) The value of the correct option for 'multiple_choice', 'true' or 'false' for 'true_false', or a sample correct text answer for 'short_answer' and 'essay'.

### EXAMPLES OF JSON OBJECTS ###
Here are examples for the requested question types. Follow this structure precisely.
\`\`\`json
${JSON.stringify(requestedQuestionExamples, null, 2)}
\`\`\`

Now, based on the content provided, generate ${count} questions in the specified JSON format.
`;
    const finalPrompt = prompt.trim();
    console.log(`Prompt tokens (estimate): ${this.countTokens(finalPrompt)}`);
    return finalPrompt;
  }

  private parseResponse(responseText: string): any[] {
    try {
      // The AI might wrap the JSON in a markdown code block.
      // Let's remove the fences if they exist.
      const cleanedResponse = responseText.replace(/^```json\s*|```$/g, '');
      const parsed = JSON.parse(cleanedResponse);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      // If it's not an array, something went wrong with the generation.
      console.warn('AI response was valid JSON but not an array:', parsed);
      return [];

    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error);
      // Here you could implement more robust fallback parsing,
      // but for now, we'll return an empty array.
      return [];
    }
  }

  private countTokens(text: string): number {
    return encode(text).length;
  }

  private formatQuestions(rawQuestions: any[], baseClassId: string, tags: string[]): Partial<Question>[] {
    const formatted: Partial<Question>[] = [];

    for (const raw of rawQuestions) {
      if (!raw.question_text || !raw.question_type || !raw.correct_answer) {
        console.warn('Skipping malformed question object from AI:', raw);
        continue;
      }

      const question: Partial<Question> = {
        question_text: raw.question_text,
        question_type: raw.question_type,
        correct_answer: String(raw.correct_answer),
        options: raw.options || [],
        base_class_id: baseClassId,
        tags: tags,
      };

      formatted.push(question);
    }

    return formatted;
  }
} 