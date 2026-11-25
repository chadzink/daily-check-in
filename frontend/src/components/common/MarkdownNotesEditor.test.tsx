import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownNotesEditor } from './MarkdownNotesEditor';

describe('MarkdownNotesEditor', () => {
  it('toggles between Write and Preview tabs and renders formatted Markdown', async () => {
    const user = userEvent.setup();
    render(
      <MarkdownNotesEditor
        value={'## Focus\n- Ship **PLAN-013**\n- Check `notes`'}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();

    await user.click(screen.getByTestId('markdown-tab-preview'));
    const preview = screen.getByTestId('markdown-preview-pane');
    expect(preview).toHaveTextContent('Focus');
    expect(preview.querySelector('strong')).toHaveTextContent('PLAN-013');
    expect(preview.querySelector('code')).toHaveTextContent('notes');
    expect(preview.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders read-only preview directly without Write tab', () => {
    render(
      <MarkdownNotesEditor
        value="**Read only** note"
        onChange={vi.fn()}
        readOnly={true}
      />
    );

    expect(screen.queryByTestId('markdown-tab-write')).not.toBeInTheDocument();
    expect(screen.getByTestId('markdown-preview-pane').querySelector('strong')).toHaveTextContent(
      'Read only'
    );
  });
});
