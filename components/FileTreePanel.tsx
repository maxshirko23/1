import React from 'react';
import { ProjectFile } from '../types';

interface FileTreePanelProps {
  files: ProjectFile[];
  activeHtmlPath: string;
  onSelectHtml: (path: string) => void;
  onClose: () => void;
}

const typeIcons: Record<string, string> = {
  html: '#ef4444',
  css: '#3b82f6',
  js: '#f59e0b',
  image: '#22c55e',
  font: '#a855f7',
  other: '#6b7280',
};

const typeLabels: Record<string, string> = {
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  image: 'Images',
  font: 'Fonts',
  other: 'Other',
};

export function FileTreePanel({ files, activeHtmlPath, onSelectHtml, onClose }: FileTreePanelProps) {
  const grouped: Record<string, ProjectFile[]> = {};
  for (const f of files) {
    if (!grouped[f.type]) grouped[f.type] = [];
    grouped[f.type].push(f);
  }

  const order: ProjectFile['type'][] = ['html', 'css', 'js', 'image', 'font', 'other'];

  return (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: '#1b1f36',
      borderRight: '1px solid #2a2f4a',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #2a2f4a',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6b7280' }}>
          Project Files
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 2px',
            lineHeight: 1,
          }}
          title="Close panel"
        >
          &times;
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {order.map(type => {
          const group = grouped[type];
          if (!group || group.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: typeIcons[type],
                padding: '4px 12px',
              }}>
                {typeLabels[type]} ({group.length})
              </div>
              {group.map(file => {
                const isActive = file.type === 'html' && file.path === activeHtmlPath;
                const isClickable = file.type === 'html';
                return (
                  <div
                    key={file.path}
                    onClick={() => isClickable && onSelectHtml(file.path)}
                    style={{
                      padding: '4px 12px 4px 20px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: isActive ? '#fff' : '#8890a4',
                      background: isActive ? '#252a40' : 'transparent',
                      cursor: isClickable ? 'pointer' : 'default',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    title={file.path}
                    onMouseEnter={e => {
                      if (!isActive && isClickable) (e.currentTarget.style.background = '#1e2340');
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget.style.background = 'transparent');
                    }}
                  >
                    {file.path}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #2a2f4a',
        fontSize: '10px',
        color: '#4b5563',
      }}>
        {files.length} files
      </div>
    </div>
  );
}
