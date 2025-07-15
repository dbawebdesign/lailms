import { createClient } from './client';

/**
 * Returns a public URL for a video in the 'guide-videos' bucket, or returns the input if it's a YouTube URL.
 * @param videoUrl The storage path or YouTube URL
 */
export function getPublicVideoUrl(videoUrl: string): string {
  if (!videoUrl) return '';
  // YouTube URL detection
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    return videoUrl;
  }
  // Supabase storage path
  const supabase = createClient();
  const { data } = supabase.storage.from('guide-videos').getPublicUrl(videoUrl);
  return data?.publicUrl || '';
} 