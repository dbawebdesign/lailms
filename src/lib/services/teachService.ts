import type { LessonSection } from '@/types/lesson';
import type { LessonSectionVersion } from '@/types/teach';

const API_BASE_PATH = '/api/teach';

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
    console.error('API Error:', response.status, errorData);
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// --- Lesson Sections ---

export async function getLessonSections(lessonId: string): Promise<LessonSection[]> {
  const response = await fetch(`${API_BASE_PATH}/lessons/${lessonId}/sections`);
  return handleResponse<LessonSection[]>(response);
}

export async function addLessonSection(
  lessonId: string,
  data: {
    title: string;
    content?: any; // Tiptap JSON
    section_type?: string;
    order_index?: number;
  }
): Promise<LessonSection> {
  const response = await fetch(`${API_BASE_PATH}/lessons/${lessonId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<LessonSection>(response);
}

export async function getLessonSection(sectionId: string): Promise<LessonSection> {
  const response = await fetch(`${API_BASE_PATH}/sections/${sectionId}`);
  return handleResponse<LessonSection>(response);
}

export async function updateLessonSection(
  sectionId: string,
  data: Partial<Omit<LessonSection, 'id' | 'lesson_id' | 'created_at' | 'created_by'>> // Allow updating relevant fields
): Promise<LessonSection> {
  const response = await fetch(`${API_BASE_PATH}/sections/${sectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<LessonSection>(response);
}

export async function deleteLessonSection(sectionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_PATH}/sections/${sectionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
    console.error('API Error:', response.status, errorData);
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }
  // DELETE typically returns 200/204 with no body or a success message
  // If there's a specific JSON message like { message: "Success" }, handleResponse could be used.
  // For now, assuming no critical JSON body on successful delete.
}

// --- Lesson Section Versions ---

export async function getSectionVersions(sectionId: string): Promise<LessonSectionVersion[]> {
  const response = await fetch(`${API_BASE_PATH}/sections/${sectionId}/versions`);
  return handleResponse<LessonSectionVersion[]>(response);
}

export async function getVersion(versionId: string): Promise<LessonSectionVersion> {
  const response = await fetch(`${API_BASE_PATH}/versions/${versionId}`);
  return handleResponse<LessonSectionVersion>(response);
}

export async function revertToVersion(versionId: string): Promise<{ message: string; updatedSection: LessonSection }> {
  const response = await fetch(`${API_BASE_PATH}/versions/${versionId}`, {
    method: 'POST', // As defined in the API route for reverting
    headers: { 'Content-Type': 'application/json' },
    // No body needed for this specific revert operation as versionId is in the URL
  });
  return handleResponse<{ message: string; updatedSection: LessonSection }>(response);
} 