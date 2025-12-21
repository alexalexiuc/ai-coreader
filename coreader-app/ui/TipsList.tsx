import { Section } from './Section';

const tips = [
  'Start with a smaller book to validate parsing + chapter detection.',
  'Use highlights as you read - they become your second brain for the book.',
  'If a book fails processing, check encoding (UTF-8) and try again.',
];

export function TipsList() {
  return (
    <Section
      header={{
        title: 'Tips',
        titleSize: 'lg',
      }}
      paddingClassName="p-5"
    >
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {tips.map((tip, i) => (
          <li
            key={i}
            className="relative pl-4 before:absolute before:top-2 before:left-0 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-400"
          >
            {tip}
          </li>
        ))}
      </ul>
    </Section>
  );
}
