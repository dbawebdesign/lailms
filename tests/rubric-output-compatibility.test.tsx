import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { parseRubricContent } from '../src/lib/teaching-tools/rubric-parser';
import { RubricDisplay } from '../src/components/teach/tools/RubricDisplay';
jest.mock('../src/context/UIContext', () => ({ useUIContext: () => ({ setPanelVisible: jest.fn() }) }));
const current = `**Photosynthesis Project Rubric**
**Subject:** Synthetic photosynthesis | **Grade Level:** 5 | **Assessment Type:** Project

**Sunlight**
Exemplary|4|Complete sunlight explanation|Proficient|3|Good sunlight explanation|Developing|2|Partial explanation|Beginning|1|Needs improvement

**Inputs**
Exemplary|4|Identifies both inputs|Proficient|3|Identifies most inputs|Developing|2|Identifies one input|Beginning|1|Needs improvement`;
it('parses current unnumbered headings and explicit named scores', () => {
  const rubric = parseRubricContent(current);
  expect(rubric).toMatchObject({ subject: 'Synthetic photosynthesis', gradeLevel: '5', totalPoints: 8 });
  expect(rubric.criteria).toHaveLength(2);
  expect(rubric.criteria[0].levels).toHaveLength(4);
  expect(rubric.criteria[0].levels[0]).toEqual({ level: 'Exemplary', points: 4, description: 'Complete sunlight explanation' });
});
it('renders the generated criteria, real descriptions and total instead of an empty table', () => {
  render(<RubricDisplay content={current} onCopy={jest.fn()} copiedItems={new Set()} />);
  expect(screen.getByText('Sunlight')).toBeInTheDocument();
  expect(screen.getByText('Inputs')).toBeInTheDocument();
  expect(screen.getByText('Complete sunlight explanation')).toBeInTheDocument();
  expect(screen.getByText(/Total:\s*8\s*pts/)).toBeInTheDocument();
});
it('preserves numbered legacy description-only rubrics', () => {
  const rubric = parseRubricContent('**Legacy Rubric**\nSubject: Science\nGrade Level: 5\n**1. Content**\nComplete | Good | Partial | Beginning');
  expect(rubric.criteria[0].name).toBe('Content');
  expect(rubric.criteria[0].levels.map(level => level.points)).toEqual([4, 3, 2, 1]);
  expect(rubric.totalPoints).toBe(4);
});
it('preserves bold assessment titles that do not contain the word rubric', () => {
  const rubric = parseRubricContent('**Science Project Assessment**\nSubject: Science\n**1. Content**\nComplete | Good | Partial | Beginning');
  expect(rubric.title).toBe('Science Project Assessment');
  expect(rubric.criteria).toHaveLength(1);
});
it('preserves same-line legacy criteria and sums each criterion maximum', () => {
  const rubric = parseRubricContent('**Weighted Rubric**\n1. Content | Excellent|6|Strong|Good|3|Developing\n2. Process | Excellent|3|Strong|Good|1|Developing');
  expect(rubric.criteria.map(criterion => criterion.name)).toEqual(['Content', 'Process']);
  expect(rubric.totalPoints).toBe(9);
});
it('shows newly generated content when the existing view receives a new rubric', () => {
  const props = { onCopy: jest.fn(), copiedItems: new Set<string>() };
  const view = render(<RubricDisplay content={current} {...props} />);
  view.rerender(<RubricDisplay content={current.replace('**Sunlight**', '**Energy**')} {...props} />);
  expect(screen.getByText('Energy')).toBeInTheDocument();
  expect(screen.queryByText('Sunlight')).not.toBeInTheDocument();
});
