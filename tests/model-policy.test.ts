/** @jest-environment node */
import { AI_MODELS, textGenerationParams } from '../src/lib/ai/model-policy';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

it('keeps interactive Luna tools fast and compatible with Chat Completions', () => {
  expect(textGenerationParams('light', 20)).toEqual({
    model: 'gpt-6-luna', reasoning_effort: 'none', max_completion_tokens: 20,
  });
});
it('leaves completion space for intensive reasoning and preserves answer budgets', () => {
  expect(textGenerationParams('intensive', 16000)).toEqual({
    model: 'gpt-6.1-sol', reasoning_effort: 'medium', max_completion_tokens: 20096,
  });
});
it.each([0, -1, 1.5, NaN, Infinity, 120001])('rejects an invalid token budget %s', budget => {
  expect(() => textGenerationParams('intensive', budget)).toThrow('Invalid text output budget');
});
it('retains the embedding model compatible with existing vectors and current specialist models', () => {
  expect(AI_MODELS.embedding).toBe('text-embedding-3-small');
  expect(AI_MODELS.transcription).toBe('gpt-transcribe');
  expect(AI_MODELS.speech).toBe('gpt-4o-mini-tts');
});

function sources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
it('migrates actual SDK and raw-fetch text requests without leaving incompatible sampling parameters', () => {
  let requests = 0;
  const files = [...sources('src/app/api'), ...sources('src/lib/services'), ...sources('packages/functions/src')];
  for (const file of files) {
    if (/test|__tests__/.test(file)) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const walk = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const props = node.properties;
        const get = (name: string) => props.find(prop => (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) && prop.name.getText(source) === name);
        if (get('messages')) {
          const spread = props.find(prop => ts.isSpreadAssignment(prop) && prop.expression.getText(source).startsWith('textGenerationParams('));
          const model = get('model');
          if (spread || model) {
            expect({ file, legacy: ['max_tokens', 'temperature', 'top_p'].filter(name => !!get(name)) }).toEqual({ file, legacy: [] });
            expect(spread).toBeDefined();
            requests++;
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  expect(requests).toBeGreaterThan(35);
});
