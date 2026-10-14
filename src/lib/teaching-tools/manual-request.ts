import type { TeachingTool } from '@/types/teachingTools';

// These two endpoints accept flat payloads; the other existing tools accept formData.
const FLAT_PAYLOAD_TOOLS = new Set(['brain-bytes', 'mindmap-generator']);

export function manualToolRequest(tool: Pick<TeachingTool, 'id' | 'apiEndpoint'>, formData: Record<string, unknown>) {
  return {
    url: tool.apiEndpoint,
    body: FLAT_PAYLOAD_TOOLS.has(tool.id) ? formData : { formData, mode: 'manual' },
  };
}
