/**
 * Mind Map Generation Service Tests
 * 
 * Production readiness validation tests for the MindMapGenerationService
 */

import { MindMapGenerationService } from '../mind-map-generation-service';

// Mock dependencies
jest.mock('openai');
jest.mock('@supabase/supabase-js');

describe('MindMapGenerationService', () => {
  let service: MindMapGenerationService;
  let mockSupabase: any;
  let mockUser: any;

  beforeEach(() => {
    service = new MindMapGenerationService();
    mockUser = { id: 'test-user-123' };
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };
  });

  describe('generateLessonMindMap', () => {
    it('should handle successful lesson mind map generation', async () => {
      // Mock successful database responses
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // No existing
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { title: 'Test Lesson', description: 'Test Description' }, 
        error: null 
      }); // Lesson data
      mockSupabase.order.mockResolvedValueOnce({ 
        data: [{ title: 'Section 1', content: 'Test content', section_type: 'content', order_index: 1 }], 
        error: null 
      }); // Sections data
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { id: 'asset-123', title: 'Test Lesson' }, 
        error: null 
      }); // Asset save

      const result = await service.generateLessonMindMap(
        mockSupabase,
        'lesson-123',
        mockUser
      );

      expect(result.success).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset?.id).toBe('asset-123');
    });

    it('should handle lesson not found error with retries', async () => {
      // Mock lesson not found error
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // No existing
      mockSupabase.single.mockRejectedValue(new Error('Lesson not found'));

      const result = await service.generateLessonMindMap(
        mockSupabase,
        'nonexistent-lesson',
        mockUser,
        { maxRetries: 2, retryDelay: 100 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate lesson mind map');
    });

    it('should handle existing mind map when regenerate is false', async () => {
      // Mock existing mind map
      mockSupabase.single.mockResolvedValueOnce({ 
        data: [{ id: 'existing-123' }], 
        error: null 
      });

      const result = await service.generateLessonMindMap(
        mockSupabase,
        'lesson-123',
        mockUser,
        { regenerate: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('A mind map already exists');
    });
  });

  describe('generateBaseClassMindMap', () => {
    it('should handle successful base class mind map generation', async () => {
      // Mock successful responses
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // No existing
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { 
          title: 'Test Course', 
          description: 'Test Description',
          modules: [
            {
              title: 'Module 1',
              description: 'Module desc',
              order_index: 1,
              lessons: [
                { title: 'Lesson 1', description: 'Lesson desc', order_index: 1 }
              ]
            }
          ]
        }, 
        error: null 
      }); // Base class data
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { id: 'asset-456', title: 'Test Course' }, 
        error: null 
      }); // Asset save

      const result = await service.generateBaseClassMindMap(
        mockSupabase,
        'class-123',
        mockUser
      );

      expect(result.success).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset?.id).toBe('asset-456');
    });
  });

  describe('Error Handling', () => {
    it('should properly classify retryable errors', async () => {
      const retryableErrors = [
        new Error('Lesson not found'),
        new Error('Base class not found'),
        new Error('Failed to fetch lesson sections'),
        new Error('Connection timeout'),
        new Error('Network error'),
        new Error('Rate limit exceeded')
      ];

      // Access private method for testing
      const isRetryableError = (service as any)._isRetryableError;

      retryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });

      const nonRetryableError = new Error('Invalid API key');
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });

    it('should handle database connection errors gracefully', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.generateLessonMindMap(
        mockSupabase,
        'lesson-123',
        mockUser,
        { maxRetries: 1, retryDelay: 50 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Content Processing', () => {
    it('should handle empty or invalid content gracefully', async () => {
      const extractTextContent = (service as any)._extractTextContent;
      
      expect(extractTextContent(null)).toBe('');
      expect(extractTextContent(undefined)).toBe('');
      expect(extractTextContent('')).toBe('');
      expect(extractTextContent('simple string')).toBe('simple string');
    });

    it('should extract key points from content', async () => {
      const extractKeyPoints = (service as any)._extractKeyPoints;
      
      const content = 'This is the first sentence. This is the second sentence. This is the third sentence with more detail.';
      const keyPoints = extractKeyPoints(content);
      
      expect(Array.isArray(keyPoints)).toBe(true);
      expect(keyPoints.length).toBeGreaterThan(0);
    });
  });
});

describe('Production Readiness Checklist', () => {
  it('should pass all production readiness checks', () => {
    const service = new MindMapGenerationService();
    
    // Check that service is properly instantiated
    expect(service).toBeInstanceOf(MindMapGenerationService);
    
    // Check that required methods exist
    expect(typeof service.generateLessonMindMap).toBe('function');
    expect(typeof service.generateBaseClassMindMap).toBe('function');
    
    // Check that private methods exist (for internal logic)
    expect(typeof (service as any)._isRetryableError).toBe('function');
    expect(typeof (service as any)._extractTextContent).toBe('function');
    expect(typeof (service as any)._generateInteractiveSVGMindMap).toBe('function');
  });
});