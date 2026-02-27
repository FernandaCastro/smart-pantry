import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { TranslationKey } from '../../i18n';

interface AIScreenProps {
  isLoading: boolean;
  aiSuggestions: string;
  t: (key: TranslationKey) => string;
  onBack: () => void;
}

const applyPattern = (
  nodes: React.ReactNode[],
  pattern: RegExp,
  renderMatch: (match: RegExpExecArray, key: string) => React.ReactNode
): React.ReactNode[] => {
  const result: React.ReactNode[] = [];

  nodes.forEach((node, index) => {
    if (typeof node !== 'string') {
      result.push(node);
      return;
    }

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const localPattern = new RegExp(pattern.source, pattern.flags);

    while ((match = localPattern.exec(node)) !== null) {
      if (match.index > lastIndex) {
        result.push(node.slice(lastIndex, match.index));
      }

      result.push(renderMatch(match, `${index}-${match.index}`));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < node.length) {
      result.push(node.slice(lastIndex));
    }
  });

  return result;
};

const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  let nodes: React.ReactNode[] = [text];

  // React não possui componente nativo para Markdown: priorizamos um parser leve local.
  nodes = applyPattern(nodes, /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, key) => (
    <a key={`link-${key}`} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--sp-violet-600)] underline break-all">
      {match[1]}
    </a>
  ));

  nodes = applyPattern(nodes, /`([^`]+)`/g, (match, key) => (
    <code key={`code-${key}`} className="rounded bg-[var(--sp-violet-50)] px-1 py-0.5 font-mono text-xs text-[var(--sp-violet-700)]">
      {match[1]}
    </code>
  ));

  nodes = applyPattern(nodes, /\*\*([^*]+)\*\*/g, (match, key) => <strong key={`strong-${key}`}>{match[1]}</strong>);
  nodes = applyPattern(nodes, /\*([^*]+)\*/g, (match, key) => <em key={`em-${key}`}>{match[1]}</em>);

  return nodes;
};

const renderMarkdown = (markdown: string): React.ReactNode => {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    const Tag = listType;
    blocks.push(
      <Tag key={`list-${blocks.length}`} className={`my-2 ml-5 space-y-1 ${listType === 'ul' ? 'list-disc' : 'list-decimal'}`}>
        {listItems}
      </Tag>
    );
    listType = null;
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushList();
      if (inCodeBlock) {
        blocks.push(
          <pre key={`pre-${index}`} className="my-2 overflow-x-auto rounded-xl bg-[var(--sp-gray-900)] p-3 text-xs text-[var(--sp-white)]">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (unorderedMatch || orderedMatch) {
      const currentType: 'ul' | 'ol' = unorderedMatch ? 'ul' : 'ol';
      if (listType && listType !== currentType) {
        flushList();
      }
      listType = currentType;
      const content = unorderedMatch ? unorderedMatch[1] : orderedMatch![1];
      listItems.push(<li key={`li-${index}`}>{renderInlineMarkdown(content)}</li>);
      return;
    }

    flushList();

    if (!trimmed) {
      blocks.push(<div key={`spacer-${index}`} className="h-2" />);
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      const headingClass = level === 1 ? 'text-lg font-bold' : level === 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
      blocks.push(
        <div key={`h-${index}`} className={`mt-2 ${headingClass}`}>
          {renderInlineMarkdown(title)}
        </div>
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="my-1">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushList();

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push(
      <pre key="pre-unclosed" className="my-2 overflow-x-auto rounded-xl bg-[var(--sp-gray-900)] p-3 text-xs text-[var(--sp-white)]">
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
  }

  return blocks;
};

export const AIScreen: React.FC<AIScreenProps> = ({ isLoading, aiSuggestions, t, onBack }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[var(--sp-violet-600)]"><Sparkles size={24} /><h2 className="text-xl font-bold">{t('aiTitle')}</h2></div>
      <div className="bg-[var(--sp-white)] border-2 border-[var(--sp-violet-50)] p-6 rounded-[2.5rem] shadow-sm leading-relaxed text-[var(--sp-gray-700)] prose text-sm">
        {isLoading ? <Loader2 className="animate-spin text-[var(--sp-violet-500)] mx-auto" /> : <div>{renderMarkdown(aiSuggestions || 'Nenhuma sugestão disponível.')}</div>}
      </div>
      <button onClick={onBack} className="w-full py-4 border-2 border-[var(--sp-violet-500)] text-[var(--sp-violet-500)] font-bold rounded-2xl">{t('back')}</button>
    </div>
  );
};
