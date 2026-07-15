import React from 'react';

/**
 * MarkdownMessage — a tiny, dependency-free renderer for the subset of Markdown
 * the AI Assistant emits: **bold**, *italic*, `code`, bullet/numbered lists, and
 * GFM pipe tables. Not a full Markdown engine — just enough to make replies
 * readable without pulling in a library. Tables scroll horizontally so long
 * values (e.g. task-ID UUIDs) never break the chat bubble.
 */

// Split a line into styled inline segments (bold / italic / code / text).
function renderInline(text, keyPrefix) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('**')) {
      parts.push(<strong key={key} className="font-bold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={key} className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono text-gray-800">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(<em key={key} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const isTableRow = (line) => line.trim().startsWith('|') && line.includes('|');
const isTableSeparator = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
const splitCells = (line) =>
  line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

export default function MarkdownMessage({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Table: a row followed by a |---| separator ──────────────────────
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitCells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={key++} className="my-1.5 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {header.map((h, hi) => (
                  <th key={hi} className="px-2.5 py-1.5 text-left font-bold text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    {renderInline(h, `th-${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-gray-100 last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 text-gray-700 align-top whitespace-nowrap">
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // ── Bullet list ─────────────────────────────────────────────────────
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-0.5 my-1">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ul-${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // ── Numbered list ───────────────────────────────────────────────────
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 space-y-0.5 my-1">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol-${key}-${ii}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // ── Blank line → spacing ────────────────────────────────────────────
    if (line.trim() === '') {
      blocks.push(<div key={key++} className="h-2" />);
      i += 1;
      continue;
    }

    // ── Paragraph ───────────────────────────────────────────────────────
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {renderInline(line, `p-${key}`)}
      </p>,
    );
    i += 1;
  }

  return <div className="space-y-0.5">{blocks}</div>;
}
