import React, { useState } from 'react';
import { Eye, PenLine } from 'lucide-react';

interface MarkdownNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  textareaId?: string;
  previewClassName?: string;
  defaultTab?: 'write' | 'preview';
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={idx} className="italic text-slate-200">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export function renderSafeMarkdown(markdown: string): React.ReactNode {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return <p className="text-xs text-slate-500 italic">Nothing to preview yet.</p>;
  }

  const lines = markdown.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    const Tag = isOrdered ? 'ol' : 'ul';
    elements.push(
      <Tag
        key={`${keyPrefix}-list`}
        className={`${isOrdered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 text-xs text-slate-200`}
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInlineMarkdown(item.text)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (bulletMatch) {
      if (listItems.length > 0 && listItems[0].ordered) flushList(`line-${idx}`);
      listItems.push({ ordered: false, text: bulletMatch[1] });
      return;
    }
    if (orderedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) flushList(`line-${idx}`);
      listItems.push({ ordered: true, text: orderedMatch[1] });
      return;
    }

    flushList(`line-${idx}`);

    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${idx}`} className="text-xs font-bold text-white mt-2">
          {renderInlineMarkdown(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${idx}`} className="text-sm font-bold text-white mt-2">
          {renderInlineMarkdown(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${idx}`} className="text-base font-bold text-white mt-2">
          {renderInlineMarkdown(line.slice(2))}
        </h2>
      );
      return;
    }
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          className="border-l-2 border-indigo-500/60 pl-3 text-xs text-slate-300 italic"
        >
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      return;
    }

    elements.push(
      <p key={`p-${idx}`} className="text-xs text-slate-200 leading-relaxed">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushList('end');
  return <div className="space-y-1.5">{elements}</div>;
}

export const MarkdownNotesEditor: React.FC<MarkdownNotesEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write notes using Markdown (**bold**, *italic*, - lists, `code`)...',
  rows = 4,
  readOnly = false,
  textareaId,
  previewClassName = 'min-h-[84px] max-h-60',
  defaultTab = 'write',
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>(
    readOnly ? 'preview' : defaultTab
  );
  const effectiveTab = readOnly ? 'preview' : activeTab;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 overflow-hidden">
      {!readOnly && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              data-testid="markdown-tab-write"
              onClick={() => setActiveTab('write')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${effectiveTab === 'write'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <PenLine className="h-3 w-3" />
              <span>Write</span>
            </button>
            <button
              type="button"
              data-testid="markdown-tab-preview"
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${effectiveTab === 'preview'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Eye className="h-3 w-3" />
              <span>Preview</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            Markdown supported
          </span>
        </div>
      )}

      {effectiveTab === 'write' ? (
        <textarea
          id={textareaId}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
        />
      ) : (
        <div
          data-testid="markdown-preview-pane"
          className={`p-3 overflow-y-auto ${previewClassName}`}
        >
          {renderSafeMarkdown(value)}
        </div>
      )}
    </div>
  );
};
