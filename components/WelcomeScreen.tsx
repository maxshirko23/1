import React from 'react';

interface WelcomeScreenProps {
  onOpenFile: () => void;
}

export function WelcomeScreen({ onOpenFile }: WelcomeScreenProps) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#13162b',
      color: '#c8cdd8',
      zIndex: 10,
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '480px',
        padding: '40px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'inline-block' }}>
            <polyline points="16,18 22,12 16,6" />
            <polyline points="8,6 2,12 8,18" />
          </svg>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#e0e4eb' }}>
          Simple HTML Editor
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px', lineHeight: '1.6' }}>
          Open an HTML file to start editing visually.<br />
          Drag elements, adjust spacing, duplicate blocks, and more.
        </p>
        <button
          onClick={onOpenFile}
          style={{
            padding: '12px 32px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}
        >
          Open HTML File
        </button>
        <div style={{ marginTop: '32px', fontSize: '12px', color: '#4b5563', lineHeight: '1.8' }}>
          <strong style={{ color: '#6b7280' }}>Keyboard shortcuts:</strong><br />
          Ctrl+O — Open file &nbsp;|&nbsp; Ctrl+S — Save<br />
          Ctrl+D — Duplicate &nbsp;|&nbsp; Delete — Remove element<br />
          Ctrl+Z — Undo &nbsp;|&nbsp; Ctrl+Shift+Z — Redo<br />
          Alt+Arrow Up/Down — Reorder elements<br />
          Hold Shift + Drag — Free-move element
        </div>
      </div>
    </div>
  );
}
