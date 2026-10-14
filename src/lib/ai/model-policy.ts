// Pure shared policy: consumed by Next.js, the Node worker, and Edge Functions.
export const AI_MODELS = {
  intensive: 'gpt-6.1-sol',
  light: 'gpt-6-luna',
  embedding: 'text-embedding-3-small',
  transcription: 'gpt-transcribe',
  speech: 'gpt-4o-mini-tts',
} as const;

export type TextTaskTier = 'intensive' | 'light';

/** GPT-6 uses completion limits and reasoning settings, not legacy sampling options. */
export function textGenerationParams(tier: TextTaskTier, outputBudget = 8192) {
  if (!Number.isSafeInteger(outputBudget) || outputBudget < 1 || outputBudget > 120000) {
    throw new Error('Invalid text output budget');
  }
  return {
    model: AI_MODELS[tier],
    // Luna's none setting preserves fast chat and Chat Completions tool calling.
    reasoning_effort: tier === 'intensive' ? 'medium' as const : 'none' as const,
    // Completion tokens include reasoning. Keep space for the intensive task's answer.
    max_completion_tokens: outputBudget + (tier === 'intensive' ? 4096 : 0),
  };
}
