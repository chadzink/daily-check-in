import React, { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';

interface CopyButtonProps {
  textToCopy: string;
  label?: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  label = 'Copy Markdown',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for environments where clipboard API is restricted
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid="copy-standup-btn"
      className={`inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shadow-md ${
        copied
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/20'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'
      } ${className}`}
    >
      {copied ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-400 animate-in zoom-in" />
          <span data-testid="copied-confirmation">Copied to Clipboard!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
