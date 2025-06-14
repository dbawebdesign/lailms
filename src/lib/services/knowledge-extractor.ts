import { createSupabaseServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export interface ConceptMap {
  concepts: LearningConcept[];
  relationships: ConceptRelationship[];
  learningSequences: LearningSequence[];
  difficultyProgression: DifficultyLevel[];
}

export interface LearningConcept {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  keywords: string[];
  sourceChunks: string[];
  estimatedLearningTime: number; // in hours
}

export interface ConceptRelationship {
  fromConcept: string;
  toConcept: string;
  relationshipType: 'prerequisite' | 'builds_on' | 'related' | 'example_of';
  strength: number; // 0-1
}

export interface LearningSequence {
  id: string;
  title: string;
  concepts: string[];
  rationale: string;
  estimatedDuration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface DifficultyLevel {
  level: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  estimatedPercentage: number;
}

export interface CourseStructureSuggestion {
  suggestedModules: SuggestedModule[];
  overallStructure: {
    totalModules: number;
    estimatedWeeks: number;
    difficultyProgression: string;
    keyLearningPaths: string[];
  };
  alternativeStructures: AlternativeStructure[];
}

export interface SuggestedModule {
  title: string;
  description: string;
  concepts: string[];
  estimatedWeeks: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningObjectives: string[];
  suggestedLessons: SuggestedLesson[];
}

export interface SuggestedLesson {
  title: string;
  concepts: string[];
  contentType: 'lecture' | 'activity' | 'discussion' | 'reading' | 'lab';
  estimatedHours: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface AlternativeStructure {
  name: string;
  description: string;
  modules: number;
  weeks: number;
  approach: string;
  suitableFor: string[];
}

export class KnowledgeExtractor {
  private openai: OpenAI;
  private supabase: ReturnType<typeof createSupabaseServerClient>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabase = createSupabaseServerClient();
  }

  async extractKnowledgeStructure(baseClassId: string): Promise<ConceptMap> {
    // 1. Get all document chunks for analysis
    const chunks = await this.getDocumentChunks(baseClassId);
    
    // 2. Extract concepts from chunks
    const concepts = await this.extractConcepts(chunks);
    
    // 3. Analyze relationships between concepts
    const relationships = await this.analyzeConceptRelationships(concepts);
    
    // 4. Generate learning sequences
    const learningSequences = await this.generateLearningSequences(concepts, relationships);
    
    // 5. Analyze difficulty progression
    const difficultyProgression = this.analyzeDifficultyProgression(concepts);
    
    return {
      concepts,
      relationships,
      learningSequences,
      difficultyProgression
    };
  }

  async suggestCourseStructure(
    conceptMap: ConceptMap,
    targetWeeks: number = 12,
    targetAudience: 'beginner' | 'intermediate' | 'advanced' | 'mixed' = 'mixed'
  ): Promise<CourseStructureSuggestion> {
    const prompt = `
Analyze the following concept map and suggest an optimal course structure:

Concepts (${conceptMap.concepts.length}):
${conceptMap.concepts.slice(0, 10).map(c => `- ${c.title} (${c.difficulty}) - ${c.description}`).join('\n')}

Learning Sequences (${conceptMap.learningSequences.length}):
${conceptMap.learningSequences.slice(0, 5).map(s => `- ${s.title}: ${s.concepts.join(' → ')}`).join('\n')}

Target Parameters:
- Duration: ${targetWeeks} weeks
- Audience: ${targetAudience}
- Total Concepts: ${conceptMap.concepts.length}

Create a course structure that:
1. Follows logical learning progression
2. Balances module sizes appropriately
3. Considers difficulty progression
4. Maximizes learning effectiveness
5. Provides multiple structural alternatives

Return a JSON response with the following structure:
{
  "suggestedModules": [
    {
      "title": "Module Title",
      "description": "Module description",
      "concepts": ["concept1", "concept2"],
      "estimatedWeeks": 2,
      "difficulty": "beginner",
      "learningObjectives": ["objective1", "objective2"],
      "suggestedLessons": [
        {
          "title": "Lesson Title",
          "concepts": ["concept1"],
          "contentType": "lecture",
          "estimatedHours": 2,
          "difficulty": "beginner"
        }
      ]
    }
  ],
  "overallStructure": {
    "totalModules": 6,
    "estimatedWeeks": ${targetWeeks},
    "difficultyProgression": "gradual",
    "keyLearningPaths": ["path1", "path2"]
  },
  "alternativeStructures": [
    {
      "name": "Intensive Track",
      "description": "Faster-paced version",
      "modules": 4,
      "weeks": 8,
      "approach": "intensive",
      "suitableFor": ["experienced learners", "time-constrained"]
    }
  ]
}
`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert instructional designer specializing in course structure optimization. Create logical, pedagogically sound course structures."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    return JSON.parse(completion.choices[0]?.message?.content || '{}');
  }

  async optimizeLearningSequence(
    concepts: LearningConcept[],
    targetDifficulty: 'beginner' | 'intermediate' | 'advanced' = 'mixed'
  ): Promise<string[]> {
    // Create dependency graph
    const dependencyGraph = this.buildDependencyGraph(concepts);
    
    // Apply topological sorting for prerequisite ordering
    const baseSequence = this.topologicalSort(dependencyGraph);
    
    // Apply difficulty-based optimization
    const optimizedSequence = this.optimizeByDifficulty(baseSequence, concepts, targetDifficulty);
    
    return optimizedSequence;
  }

  private async getDocumentChunks(baseClassId: string) {
    const { data: chunks, error } = await this.supabase
      .from('document_chunks')
      .select(`
        id,
        content,
        chunk_summary,
        section_identifier,
        metadata,
        documents!inner(base_class_id, file_name)
      `)
      .eq('documents.base_class_id', baseClassId)
      .limit(100); // Limit for performance

    if (error) throw new Error(`Failed to fetch chunks: ${error.message}`);
    return chunks || [];
  }

  private async extractConcepts(chunks: any[]): Promise<LearningConcept[]> {
    // Group chunks for batch processing
    const chunkBatches = this.chunkArray(chunks, 10);
    const allConcepts: LearningConcept[] = [];

    for (const batch of chunkBatches) {
      const batchConcepts = await this.extractConceptsFromBatch(batch);
      allConcepts.push(...batchConcepts);
    }

    // Deduplicate and merge similar concepts
    return this.deduplicateConcepts(allConcepts);
  }

  private async extractConceptsFromBatch(chunks: any[]): Promise<LearningConcept[]> {
    const prompt = `
Analyze the following content chunks and extract key learning concepts:

${chunks.map((chunk, index) => `
Chunk ${index + 1}:
Summary: ${chunk.chunk_summary || 'No summary'}
Content: ${chunk.content.substring(0, 500)}
`).join('\n')}

For each concept, determine:
1. Title and description
2. Category/domain
3. Difficulty level
4. Prerequisites
5. Key keywords
6. Estimated learning time

Return JSON format:
{
  "concepts": [
    {
      "title": "Concept Title",
      "description": "Clear description",
      "category": "category",
      "difficulty": "beginner|intermediate|advanced",
      "prerequisites": ["prereq1", "prereq2"],
      "keywords": ["keyword1", "keyword2"],
      "estimatedLearningTime": 2
    }
  ]
}
`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting learning concepts from educational content. Focus on identifying discrete, teachable concepts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{"concepts": []}');
    
    return result.concepts.map((concept: any, index: number) => ({
      id: `concept-${Date.now()}-${index}`,
      title: concept.title,
      description: concept.description,
      category: concept.category,
      difficulty: concept.difficulty,
      prerequisites: concept.prerequisites || [],
      keywords: concept.keywords || [],
      sourceChunks: chunks.map(c => c.id),
      estimatedLearningTime: concept.estimatedLearningTime || 1
    }));
  }

  private async analyzeConceptRelationships(concepts: LearningConcept[]): Promise<ConceptRelationship[]> {
    if (concepts.length === 0) return [];

    const prompt = `
Analyze relationships between these learning concepts:

${concepts.map((c, i) => `${i + 1}. ${c.title} (${c.difficulty}) - ${c.description}`).join('\n')}

Identify relationships such as:
- Prerequisites (A must be learned before B)
- Builds on (B extends/builds upon A)
- Related (A and B are related topics)
- Example of (A is an example/instance of B)

Return JSON format:
{
  "relationships": [
    {
      "fromConcept": "concept-title-1",
      "toConcept": "concept-title-2", 
      "relationshipType": "prerequisite",
      "strength": 0.8
    }
  ]
}
`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing learning dependencies and concept relationships in educational content."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{"relationships": []}');
    return result.relationships || [];
  }

  private async generateLearningSequences(
    concepts: LearningConcept[], 
    relationships: ConceptRelationship[]
  ): Promise<LearningSequence[]> {
    // Group concepts by category and difficulty
    const categories = this.groupConceptsByCategory(concepts);
    const sequences: LearningSequence[] = [];

    for (const [category, categoryConcepts] of Object.entries(categories)) {
      const categorySequence = await this.createSequenceForCategory(
        category, 
        categoryConcepts, 
        relationships
      );
      sequences.push(categorySequence);
    }

    return sequences;
  }

  private groupConceptsByCategory(concepts: LearningConcept[]): Record<string, LearningConcept[]> {
    return concepts.reduce((groups, concept) => {
      const category = concept.category || 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(concept);
      return groups;
    }, {} as Record<string, LearningConcept[]>);
  }

  private async createSequenceForCategory(
    category: string,
    concepts: LearningConcept[],
    relationships: ConceptRelationship[]
  ): Promise<LearningSequence> {
    // Sort concepts by difficulty and dependencies
    const sortedConcepts = this.sortConceptsByDependencies(concepts, relationships);
    
    return {
      id: `sequence-${category.toLowerCase().replace(/\s+/g, '-')}`,
      title: `${category} Learning Path`,
      concepts: sortedConcepts.map(c => c.id),
      rationale: `Progressive learning path for ${category} concepts, ordered by difficulty and dependencies`,
      estimatedDuration: sortedConcepts.reduce((total, c) => total + c.estimatedLearningTime, 0),
      difficulty: this.determineSequenceDifficulty(sortedConcepts)
    };
  }

  private sortConceptsByDependencies(
    concepts: LearningConcept[], 
    relationships: ConceptRelationship[]
  ): LearningConcept[] {
    // Simple sorting by difficulty for now - can be enhanced with actual dependency analysis
    const difficultyOrder = { 'beginner': 0, 'intermediate': 1, 'advanced': 2 };
    
    return concepts.sort((a, b) => {
      const diffA = difficultyOrder[a.difficulty];
      const diffB = difficultyOrder[b.difficulty];
      if (diffA !== diffB) return diffA - diffB;
      return a.title.localeCompare(b.title);
    });
  }

  private determineSequenceDifficulty(concepts: LearningConcept[]): 'beginner' | 'intermediate' | 'advanced' {
    const difficulties = concepts.map(c => c.difficulty);
    const counts = {
      beginner: difficulties.filter(d => d === 'beginner').length,
      intermediate: difficulties.filter(d => d === 'intermediate').length,
      advanced: difficulties.filter(d => d === 'advanced').length
    };

    if (counts.advanced > 0) return 'advanced';
    if (counts.intermediate > counts.beginner) return 'intermediate';
    return 'beginner';
  }

  private analyzeDifficultyProgression(concepts: LearningConcept[]): DifficultyLevel[] {
    const totalConcepts = concepts.length;
    if (totalConcepts === 0) return [];

    const difficultyGroups = {
      beginner: concepts.filter(c => c.difficulty === 'beginner'),
      intermediate: concepts.filter(c => c.difficulty === 'intermediate'),
      advanced: concepts.filter(c => c.difficulty === 'advanced')
    };

    return Object.entries(difficultyGroups).map(([level, conceptList]) => ({
      level: level as 'beginner' | 'intermediate' | 'advanced',
      concepts: conceptList.map(c => c.id),
      estimatedPercentage: Math.round((conceptList.length / totalConcepts) * 100)
    }));
  }

  private deduplicateConcepts(concepts: LearningConcept[]): LearningConcept[] {
    const seen = new Set<string>();
    const deduplicated: LearningConcept[] = [];

    for (const concept of concepts) {
      const key = concept.title.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(concept);
      }
    }

    return deduplicated;
  }

  private buildDependencyGraph(concepts: LearningConcept[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const concept of concepts) {
      if (!graph.has(concept.id)) {
        graph.set(concept.id, []);
      }
      
      for (const prereq of concept.prerequisites) {
        const prereqConcept = concepts.find(c => c.title.toLowerCase() === prereq.toLowerCase());
        if (prereqConcept) {
          if (!graph.has(prereqConcept.id)) {
            graph.set(prereqConcept.id, []);
          }
          graph.get(prereqConcept.id)!.push(concept.id);
        }
      }
    }
    
    return graph;
  }

  private topologicalSort(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const dfs = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);
      
      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
      
      result.unshift(node);
    };
    
    for (const node of graph.keys()) {
      dfs(node);
    }
    
    return result;
  }

  private optimizeByDifficulty(
    sequence: string[], 
    concepts: LearningConcept[], 
    targetDifficulty: string
  ): string[] {
    const conceptMap = new Map(concepts.map(c => [c.id, c]));
    
    return sequence.sort((a, b) => {
      const conceptA = conceptMap.get(a);
      const conceptB = conceptMap.get(b);
      
      if (!conceptA || !conceptB) return 0;
      
      const difficultyOrder = { 'beginner': 0, 'intermediate': 1, 'advanced': 2 };
      return difficultyOrder[conceptA.difficulty] - difficultyOrder[conceptB.difficulty];
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const knowledgeExtractor = new KnowledgeExtractor(); 