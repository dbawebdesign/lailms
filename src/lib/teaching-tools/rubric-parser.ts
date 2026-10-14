export interface RubricLevel { level: string; points: number; description: string }
export interface RubricCriterion { name: string; levels: RubricLevel[] }
export interface ParsedRubric {
  title: string;
  criteria: RubricCriterion[];
  totalPoints: number;
  subject?: string;
  gradeLevel?: string;
}

const metadataLine = (line: string) => /^(?:subject|grade(?:\s+level)?|assessment\s+type|total(?:\s+points)?|performance\s+levels|scoring\s+guide)\s*:/i.test(line.replace(/\*\*/g, '').replace(/^#+\s*/, ''));
const headerName = (line: string) => {
  const bold = line.match(/^\*\*(.*?)\*\*$/);
  const numbered = line.match(/^\d+\.?\s+(.+)$/);
  return (bold?.[1] ?? numbered?.[1])?.replace(/^\d+\.?\s*/, '').trim();
};

function levelsFromLine(line: string): RubricLevel[] {
  const parts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(part => part.trim());
  // Current API format: LevelName|Points|Description, repeated for each level.
  if (parts.length >= 3 && parts.length % 3 === 0
    && parts.every((part, index) => index % 3 !== 1 || /^\d+(?:\.\d+)?$/.test(part))) {
    return Array.from({ length: parts.length / 3 }, (_, index) => ({
      level: parts[index * 3], points: Number(parts[index * 3 + 1]), description: parts[index * 3 + 2],
    }));
  }
  // Older saved rubrics have only descriptions, with descending implicit scores.
  const descriptions = parts.filter(Boolean);
  const names = ['Exemplary', 'Proficient', 'Developing', 'Beginning'];
  return descriptions.map((description, index) => ({
    level: names[index] ?? `Level ${descriptions.length - index}`,
    points: descriptions.length - index,
    description,
  }));
}

export function parseRubricContent(content: string): ParsedRubric {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  const titleLine = lines.find(line => /rubric/i.test(line) && !line.includes('|') && !metadataLine(line))
    ?? lines.find((line, index) => /^\*\*[^*]+\*\*$/.test(line) && !/^\*\*\d+\./.test(line)
      && !metadataLine(line) && (!lines[index + 1]?.includes('|') || metadataLine(lines[index + 1])));
  const title = titleLine?.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim() || 'Assessment Rubric';
  const plain = content.replace(/\*\*/g, '');
  const subject = plain.match(/subject:\s*([^|\n]+)/i)?.[1].trim() || '';
  const gradeLevel = plain.match(/grade(?:\s+level)?:\s*([^|\n]+)/i)?.[1].trim() || '';
  const criteria: RubricCriterion[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === titleLine || metadataLine(line) || line.startsWith('---') || line.startsWith('#')) continue;
    const inline = line.match(/^(?:\*\*)?\d+\.?\s*(.+?)\s*\|(.+)$/);
    if (inline) {
      criteria.push({ name: inline[1].replace(/\*\*/g, '').trim(), levels: levelsFromLine(inline[2]) });
      continue;
    }
    const name = headerName(line);
    if (!name) continue;
    for (let next = index + 1; next < lines.length; next++) {
      const candidate = lines[next];
      if (metadataLine(candidate) || headerName(candidate) || candidate.startsWith('#')) break;
      if (candidate.includes('|')) {
        criteria.push({ name, levels: levelsFromLine(candidate) });
        index = next;
        break;
      }
    }
  }
  return { title, subject, gradeLevel, criteria,
    totalPoints: criteria.reduce((total, criterion) => total + Math.max(0, ...criterion.levels.map(level => level.points)), 0),
  };
}
