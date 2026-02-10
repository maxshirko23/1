import React from 'react';

interface ToolbarProps {
  isFileLoaded: boolean;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showSource: boolean;
  showFileTree: boolean;
  zoom: number;
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onSaveAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSource: () => void;
  onToggleFileTree: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  fileName: string;
  hasProject: boolean;
  viewportMode: 'desktop' | 'tablet' | 'mobile';
  onViewportChange: (mode: 'desktop' | 'tablet' | 'mobile') => void;
}

const btnBase: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #3a3f5c',
  borderRadius: '4px',
  background: '#252a40',
  color: '#c8cdd8',
  cursor: 'pointer',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s, border-color 0.15s',
};

const btnDisabled: React.CSSProperties = {
  ...btnBase,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: '#3b82f6',
  borderColor: '#3b82f6',
  color: '#fff',
};

const btnSmall: React.CSSProperties = {
  ...btnBase,
  padding: '6px 8px',
  fontSize: '12px',
  color: '#8890a4',
};

const separator: React.CSSProperties = {
  width: '1px',
  height: '24px',
  background: '#3a3f5c',
  margin: '0 4px',
};

export function Toolbar(props: ToolbarProps) {
  const {
    isFileLoaded, hasSelection, canUndo, canRedo, showSource, showFileTree, zoom,
    onOpenFolder, onOpenFile, onSaveAll, onUndo, onRedo, onDuplicate, onDelete,
    onMoveUp, onMoveDown, onToggleSource, onToggleFileTree, onZoomIn, onZoomOut, onZoomReset,
    fileName, hasProject, viewportMode, onViewportChange,
  } = props;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '6px 12px',
      background: '#1b1f36',
      borderBottom: '1px solid #2a2f4a',
      gap: '6px',
      flexWrap: 'wrap',
      minHeight: '44px',
    }}>
      {/* File operations */}
      <button style={btnBase} onClick={onOpenFolder} title="Open project folder (Ctrl+O)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
        Open Folder
      </button>
      <button style={btnSmall} onClick={onOpenFile} title="Open single HTML file">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        File
      </button>
      <button style={isFileLoaded ? btnBase : btnDisabled} onClick={onSaveAll} title="Save all files (Ctrl+S)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
        Save
      </button>

      <div style={separator} />

      {/* File tree toggle */}
      {hasProject && (
        <>
          <button style={showFileTree ? btnActive : btnBase} onClick={onToggleFileTree} title="Toggle file tree">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Files
          </button>
          <div style={separator} />
        </>
      )}

      {/* Undo/Redo */}
      <button style={canUndo ? btnBase : btnDisabled} onClick={onUndo} title="Undo (Ctrl+Z)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 105.68-9.72L1 10"/></svg>
      </button>
      <button style={canRedo ? btnBase : btnDisabled} onClick={onRedo} title="Redo (Ctrl+Shift+Z)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 11-5.68-9.72L23 10"/></svg>
      </button>

      <div style={separator} />

      {/* Element operations */}
      <button style={hasSelection ? btnBase : btnDisabled} onClick={onMoveUp} title="Move element up (Alt+Up)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18,15 12,9 6,15"/></svg>
      </button>
      <button style={hasSelection ? btnBase : btnDisabled} onClick={onMoveDown} title="Move element down (Alt+Down)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
      </button>
      <button style={hasSelection ? btnBase : btnDisabled} onClick={onDuplicate} title="Duplicate element (Ctrl+D)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Duplicate
      </button>
      <button style={hasSelection ? btnBase : btnDisabled} onClick={onDelete} title="Delete element (Delete)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        Delete
      </button>

      <div style={separator} />

      {/* Zoom */}
      <button style={isFileLoaded ? btnBase : btnDisabled} onClick={onZoomOut} title="Zoom out">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <span style={{ fontSize: '12px', color: '#8890a4', minWidth: '40px', textAlign: 'center', cursor: 'pointer' }} onClick={onZoomReset}>
        {zoom}%
      </span>
      <button style={isFileLoaded ? btnBase : btnDisabled} onClick={onZoomIn} title="Zoom in">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>

      <div style={separator} />

      {/* Source toggle */}
      <button style={showSource ? btnActive : (isFileLoaded ? btnBase : btnDisabled)} onClick={onToggleSource} title="Toggle source code panel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg>
        Source
      </button>

      {isFileLoaded && (
        <>
          <div style={separator} />
          {/* Viewport switcher */}
          <button
            style={viewportMode === 'desktop' ? btnActive : btnBase}
            onClick={() => onViewportChange('desktop')}
            title="Desktop view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </button>
          <button
            style={viewportMode === 'tablet' ? btnActive : btnBase}
            onClick={() => onViewportChange('tablet')}
            title="Tablet view (768×1024)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
          </button>
          <button
            style={viewportMode === 'mobile' ? btnActive : btnBase}
            onClick={() => onViewportChange('mobile')}
            title="Mobile view (375×812)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
          </button>
        </>
      )}

      {/* File name */}
      <div style={{ flex: 1 }} />
      {fileName && (
        <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
          {fileName}
        </span>
      )}
    </div>
  );
}
