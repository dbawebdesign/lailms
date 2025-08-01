import { brainbytesGenerationService } from '../brainbytes-generation-service';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: `[INTRO MUSIC - 5 seconds]

LUNA: Welcome to Brain Bytes, where we explore amazing ideas in bite-sized pieces! I'm Luna, and today we're diving into test lesson concepts.

Today we'll learn about key concepts from the lesson. This is educational content that helps students understand important ideas.

LUNA: That's a wrap on today's Brain Bytes! Remember, learning is an adventure, and every concept you master today builds the foundation for tomorrow's discoveries. Keep being curious, and I'll see you next time!

[OUTRO MUSIC - 3 seconds]`
              }
            }
          ]
        })
      }
    },
    audio: {
      speech: {
        create: jest.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
        })
      }
    }
  }));
});

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    remove: jest.fn(),
    getPublicUrl: jest.fn()
  }
};

describe('BrainbytesGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.single.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.delete.mockReturnThis();
  });

  describe('generateLessonBrainbytes', () => {
    const mockUser = { id: 'test-user-id' };
    const mockLessonId = 'test-lesson-id';

    it('should successfully generate brainbytes for a lesson', async () => {
      // Mock no existing assets
      mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });
      
      // Mock lesson fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          title: 'Test Lesson',
          description: 'Test lesson description'
        },
        error: null
      });
      
      // Mock sections fetch
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          {
            title: 'Section 1',
            content: { type: 'doc', content: [{ type: 'text', text: 'Section 1 content' }] },
            section_type: 'content',
            order_index: 1
          }
        ],
        error: null
      });
      
      // Mock storage upload
      mockSupabase.storage.upload.mockResolvedValueOnce({
        data: { path: 'test-path.mp3' },
        error: null
      });
      
      // Mock public URL
      mockSupabase.storage.getPublicUrl.mockReturnValueOnce({
        data: { publicUrl: 'https://test.com/audio.mp3' }
      });
      
      // Mock database insert
      mockSupabase.select.mockResolvedValueOnce({
        data: {
          id: 'test-asset-id',
          title: 'Brain Bytes Podcast',
          file_url: 'https://test.com/audio.mp3',
          duration: 60,
          status: 'completed',
          created_at: new Date().toISOString()
        },
        error: null
      });

      const result = await brainbytesGenerationService.generateLessonBrainbytes(
        mockSupabase,
        mockLessonId,
        mockUser,
        {
          regenerate: false,
          internal: true,
          gradeLevel: 'middle_school'
        }
      );

      expect(result.success).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset.type).toBe('podcast');
    });

    it('should handle existing brainbytes without regeneration', async () => {
      // Mock existing assets
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ id: 'existing-asset' }],
        error: null
      });

      const result = await brainbytesGenerationService.generateLessonBrainbytes(
        mockSupabase,
        mockLessonId,
        mockUser,
        {
          regenerate: false,
          internal: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should handle lesson not found error with retry', async () => {
      // Mock no existing assets
      mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });
      
      // Mock lesson not found error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Lesson not found' }
      });

      const result = await brainbytesGenerationService.generateLessonBrainbytes(
        mockSupabase,
        mockLessonId,
        mockUser,
        {
          regenerate: false,
          internal: true,
          maxRetries: 1,
          retryDelay: 100
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Lesson not found');
    });

    it('should clean script for TTS properly', async () => {
      // Mock no existing assets
      mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });
      
      // Mock lesson fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          title: 'Test Lesson',
          description: 'Test lesson description'
        },
        error: null
      });
      
      // Mock sections fetch
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          {
            title: 'Section 1',
            content: 'Simple text content',
            section_type: 'content',
            order_index: 1
          }
        ],
        error: null
      });
      
      // Mock storage upload
      mockSupabase.storage.upload.mockResolvedValueOnce({
        data: { path: 'test-path.mp3' },
        error: null
      });
      
      // Mock public URL
      mockSupabase.storage.getPublicUrl.mockReturnValueOnce({
        data: { publicUrl: 'https://test.com/audio.mp3' }
      });
      
      // Mock database insert
      mockSupabase.select.mockResolvedValueOnce({
        data: {
          id: 'test-asset-id',
          title: 'Brain Bytes Podcast',
          file_url: 'https://test.com/audio.mp3',
          duration: 60,
          status: 'completed',
          created_at: new Date().toISOString()
        },
        error: null
      });

      const result = await brainbytesGenerationService.generateLessonBrainbytes(
        mockSupabase,
        mockLessonId,
        mockUser,
        {
          regenerate: false,
          internal: true
        }
      );

      expect(result.success).toBe(true);
      
      // Verify that the TTS was called with cleaned script (no [INTRO MUSIC] etc.)
      const mockTTS = require('openai')().audio.speech.create;
      expect(mockTTS).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.not.stringMatching(/\[.*?\]|LUNA:/)
        })
      );
    });

    it('should handle regeneration by deleting existing assets', async () => {
      // Mock existing assets
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ id: 'existing-asset', file_path: 'old-audio.mp3' }],
        error: null
      });
      
      // Mock storage remove
      mockSupabase.storage.remove.mockResolvedValueOnce({ error: null });
      
      // Mock database delete
      mockSupabase.delete.mockResolvedValueOnce({ error: null });
      
      // Mock lesson fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          title: 'Test Lesson',
          description: 'Test lesson description'
        },
        error: null
      });
      
      // Mock sections fetch
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          {
            title: 'Section 1',
            content: 'Simple text content',
            section_type: 'content',
            order_index: 1
          }
        ],
        error: null
      });
      
      // Mock storage upload
      mockSupabase.storage.upload.mockResolvedValueOnce({
        data: { path: 'test-path.mp3' },
        error: null
      });
      
      // Mock public URL
      mockSupabase.storage.getPublicUrl.mockReturnValueOnce({
        data: { publicUrl: 'https://test.com/audio.mp3' }
      });
      
      // Mock database insert
      mockSupabase.select.mockResolvedValueOnce({
        data: {
          id: 'test-asset-id',
          title: 'Brain Bytes Podcast',
          file_url: 'https://test.com/audio.mp3',
          duration: 60,
          status: 'completed',
          created_at: new Date().toISOString()
        },
        error: null
      });

      const result = await brainbytesGenerationService.generateLessonBrainbytes(
        mockSupabase,
        mockLessonId,
        mockUser,
        {
          regenerate: true,
          internal: true
        }
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.storage.remove).toHaveBeenCalledWith(['old-audio.mp3']);
      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });
});