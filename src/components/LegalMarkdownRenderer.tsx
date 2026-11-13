/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  InlineMarkdownNode,
  LegalMarkdownListItem,
  parseLegalMarkdownBlocks,
} from '../utils/legalMarkdown';

interface LegalMarkdownRendererProps {
  content: string;
  variant?: 'default' | 'compact';
  className?: string;
}

function renderInlineNodes(nodes: InlineMarkdownNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.text}</React.Fragment>;
      case 'bold':
        return (
          <strong key={key} className="font-semibold text-zinc-950 dark:text-white">
            {renderInlineNodes(node.children, key)}
          </strong>
        );
      case 'italic':
        return (
          <em key={key} className="italic">
            {renderInlineNodes(node.children, key)}
          </em>
        );
      case 'code':
        return (
          <code
            key={key}
            className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[0.92em] text-zinc-800 dark:text-zinc-200"
          >
            {node.text}
          </code>
        );
    }
  });
}

function renderListItems(
  items: LegalMarkdownListItem[],
  ordered: boolean,
  isCompact: boolean,
  keyPrefix: string
): React.ReactNode {
  const ListTag = ordered ? 'ol' : 'ul';
  const listClass = ordered
    ? `list-decimal pl-5 ${isCompact ? 'space-y-1' : 'space-y-1.5'}`
    : `list-disc pl-5 ${isCompact ? 'space-y-1' : 'space-y-1.5'}`;

  return (
    <ListTag className={listClass}>
      {items.map((item, idx) => {
        const key = `${keyPrefix}-li-${idx}`;
        return (
          <li key={key} className="leading-relaxed">
            <span>{renderInlineNodes(item.children, key)}</span>
            {item.subItems && item.subItems.length > 0 && (
              <ul className="list-[circle] pl-5 mt-1 space-y-1">
                {item.subItems.map((sub, subIdx) => (
                  <li key={`${key}-sub-${subIdx}`} className="leading-relaxed">
                    {renderInlineNodes(sub.children, `${key}-sub-${subIdx}`)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ListTag>
  );
}

export const LegalMarkdownRenderer: React.FC<LegalMarkdownRendererProps> = ({
  content,
  variant = 'default',
  className = '',
}) => {
  const blocks = parseLegalMarkdownBlocks(content);
  const isCompact = variant === 'compact';

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div
      className={`${
        isCompact
          ? 'text-[11px] text-blue-950/80 dark:text-blue-200/80 leading-relaxed space-y-1.5'
          : 'text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-2.5'
      } ${className}`.trim()}
    >
      {blocks.map((block, idx) => {
        const key = `md-block-${idx}`;
        switch (block.type) {
          case 'heading': {
            if (block.level <= 2) {
              return (
                <h4
                  key={key}
                  className={`${
                    isCompact ? 'text-xs mt-2' : 'text-sm mt-3 first:mt-0'
                  } font-bold text-zinc-950 dark:text-white tracking-tight`}
                >
                  {renderInlineNodes(block.children, key)}
                </h4>
              );
            }
            return (
              <h5
                key={key}
                className={`${
                  isCompact ? 'text-[11px] mt-1.5' : 'text-xs mt-2.5 first:mt-0'
                } font-bold text-zinc-900 dark:text-zinc-100`}
              >
                {renderInlineNodes(block.children, key)}
              </h5>
            );
          }
          case 'paragraph':
            return (
              <p key={key} className="leading-relaxed">
                {renderInlineNodes(block.children, key)}
              </p>
            );
          case 'list':
            return (
              <React.Fragment key={key}>
                {renderListItems(block.items, block.ordered, isCompact, key)}
              </React.Fragment>
            );
          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="border-l-2 border-[#007FFF]/50 pl-3 py-0.5 text-zinc-600 dark:text-zinc-400 italic"
              >
                {renderInlineNodes(block.children, key)}
              </blockquote>
            );
          case 'hr':
            return (
              <hr
                key={key}
                className="border-t border-zinc-200 dark:border-zinc-800 my-2"
              />
            );
        }
      })}
    </div>
  );
};
