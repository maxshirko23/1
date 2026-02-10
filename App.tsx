import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { SelectedElementInfo, ElementStyles, STYLE_KEYS } from './types';

// ===== Utility functions =====

function getElementPath(el: HTMLElement, root: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== root && current.parentElement) {
    let tag = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`${tag}#${current.id}`);
      break;
    }
    const parent = current.parentElement;
    const siblings = Array.from(parent.children);
    const sameTag = siblings.filter(s => s.tagName === current!.tagName);
    if (sameTag.length > 1) {
      const idx = sameTag.indexOf(current) + 1;
      tag += `:nth-of-type(${idx})`;
    }
    parts.unshift(tag);
    current = parent;
  }
  return parts.join(' > ');
}

function getComputedStyles(el: HTMLElement): ElementStyles {
  const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
  return {
    marginTop: el.style.marginTop || cs.marginTop,
    marginRight: el.style.marginRight || cs.marginRight,
    marginBottom: el.style.marginBottom || cs.marginBottom,
    marginLeft: el.style.marginLeft || cs.marginLeft,
    paddingTop: el.style.paddingTop || cs.paddingTop,
    paddingRight: el.style.paddingRight || cs.paddingRight,
    paddingBottom: el.style.paddingBottom || cs.paddingBottom,
    paddingLeft: el.style.paddingLeft || cs.paddingLeft,
    width: el.style.width || cs.width,
    height: el.style.height || cs.height,
    backgroundColor: el.style.backgroundColor || cs.backgroundColor,
    color: el.style.color || cs.color,
    fontSize: el.style.fontSize || cs.fontSize,
    fontWeight: el.style.fontWeight || cs.fontWeight,
    display: el.style.display || cs.display,
    position: el.style.position || cs.position,
    textAlign: el.style.textAlign || cs.textAlign,
    borderRadius: el.style.borderRadius || cs.borderRadius,
    opacity: el.style.opacity || cs.opacity,
  };
}

function serializeDocument(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  // Remove editor artifacts
  const editorStyle = clone.querySelector('#__editor_styles__');
  if (editorStyle) editorStyle.remove();
  // Remove editor classes
  clone.querySelectorAll('[class]').forEach(el => {
    const classes = el.className.toString().split(' ').filter(
      c => !c.startsWith('__editor_')
    );
    if (classes.length === 0 || (classes.length === 1 && classes[0] === '')) {
      el.removeAttribute('class');
    } else {
      el.setAttribute('class', classes.join(' '));
    }
  });
  // Remove data attributes we added
  clone.querySelectorAll('[data-editor-selected]').forEach(el => {
    el.removeAttribute('data-editor-selected');
  });
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ''}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ''}>\n`
    : '<!DOCTYPE html>\n';
  return doctype + clone.outerHTML;
}

function isEditable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const skip = ['html', 'head', 'meta', 'link', 'script', 'style', 'title', 'br', 'hr'];
  return !skip.includes(tag);
}

// ===== Main App =====

function App() {
  // --- State ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedInfo, setSelectedInfo] = useState<SelectedElementInfo | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [zoom, setZoom] = useState(100);
  const [isDragging, setIsDragging] = useState(false);

  // --- Refs ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedElRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const historyRef = useRef(history);
  const historyIdxRef = useRef(historyIdx);

  // Keep refs in sync
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIdxRef.current = historyIdx; }, [historyIdx]);

  // --- History ---
  const pushHistory = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const html = serializeDocument(doc);
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    const newHistory = [...h.slice(0, idx + 1), html];
    // Limit history to 50 entries
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  }, []);

  const undo = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    const html = historyRef.current[newIdx];
    setHistoryIdx(newIdx);
    loadHtmlIntoIframe(html, false);
  }, []);

  const redo = useCallback(() => {
    const idx = historyIdxRef.current;
    const h = historyRef.current;
    if (idx >= h.length - 1) return;
    const newIdx = idx + 1;
    const html = h[newIdx];
    setHistoryIdx(newIdx);
    loadHtmlIntoIframe(html, false);
  }, []);

  // --- Element info extraction ---
  const extractElementInfo = useCallback((el: HTMLElement): SelectedElementInfo => {
    const doc = iframeRef.current?.contentDocument;
    const root = doc?.body || el;
    return {
      tagName: el.tagName.toLowerCase(),
      path: getElementPath(el, root),
      className: (el.className.toString() || '').split(' ').filter(c => !c.startsWith('__editor_')).join(' '),
      id: el.id || '',
      textContent: el.children.length === 0 ? (el.textContent || '') : '',
      innerHTML: el.innerHTML,
      hasChildren: el.children.length > 0,
      styles: getComputedStyles(el),
    };
  }, []);

  // --- Select element ---
  const selectElement = useCallback((el: HTMLElement | null) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    // Clear previous selection
    doc.querySelectorAll('[data-editor-selected]').forEach(e => {
      e.removeAttribute('data-editor-selected');
      e.classList.remove('__editor_selected__');
    });
    selectedElRef.current = null;

    if (!el || !isEditable(el)) {
      setSelectedInfo(null);
      return;
    }

    el.setAttribute('data-editor-selected', 'true');
    el.classList.add('__editor_selected__');
    selectedElRef.current = el;
    setSelectedInfo(extractElementInfo(el));
  }, [extractElementInfo]);

  // --- Refresh selected element info ---
  const refreshSelectedInfo = useCallback(() => {
    const el = selectedElRef.current;
    if (el && el.isConnected) {
      setSelectedInfo(extractElementInfo(el));
    } else {
      setSelectedInfo(null);
      selectedElRef.current = null;
    }
  }, [extractElementInfo]);

  // --- Load HTML into iframe ---
  const loadHtmlIntoIframe = useCallback((html: string, addToHistory = true) => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Clean up previous interaction
    if (interactionCleanupRef.current) {
      interactionCleanupRef.current();
      interactionCleanupRef.current = null;
    }

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for resources to load
    const setupTimer = setTimeout(() => {
      setupIframeInteraction(doc);
      if (addToHistory) {
        pushHistory();
      }
      selectElement(null);
      setIsLoaded(true);
    }, 150);

    return () => clearTimeout(setupTimer);
  }, []);

  // --- Setup iframe interaction ---
  const setupIframeInteraction = useCallback((doc: Document) => {
    // Inject editor styles
    let styleEl = doc.getElementById('__editor_styles__');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = '__editor_styles__';
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .__editor_hover__ {
        outline: 2px dashed rgba(59,130,246,0.6) !important;
        outline-offset: 1px !important;
        cursor: pointer !important;
      }
      .__editor_selected__ {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 1px !important;
      }
      .__editor_drag_ghost__ {
        opacity: 0.4 !important;
        outline: 2px dashed #f59e0b !important;
      }
      .__editor_drop_indicator__ {
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: #3b82f6;
        pointer-events: none;
        z-index: 99999;
        border-radius: 2px;
        box-shadow: 0 0 6px rgba(59,130,246,0.5);
      }
      .__editor_drag_active__ * {
        cursor: grabbing !important;
      }
    `;

    let hoveredEl: HTMLElement | null = null;
    let dragState = {
      active: false,
      el: null as HTMLElement | null,
      startX: 0,
      startY: 0,
      shiftHeld: false,
      origMarginTop: 0,
      origMarginLeft: 0,
      indicator: null as HTMLElement | null,
      insertBefore: null as HTMLElement | null,
    };

    // --- Mouse handlers ---
    const onMouseOver = (e: MouseEvent) => {
      if (dragState.active) return;
      const target = e.target as HTMLElement;
      if (!isEditable(target)) return;
      if (hoveredEl) hoveredEl.classList.remove('__editor_hover__');
      target.classList.add('__editor_hover__');
      hoveredEl = target;
    };

    const onMouseOut = (e: MouseEvent) => {
      if (dragState.active) return;
      const target = e.target as HTMLElement;
      target.classList.remove('__editor_hover__');
      if (hoveredEl === target) hoveredEl = null;
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragState.active) return;
      const target = e.target as HTMLElement;
      if (target === doc.body || target === doc.documentElement) {
        selectElement(null);
      } else {
        selectElement(target);
      }
    };

    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as HTMLElement;
      if (target.children.length === 0 && isEditable(target)) {
        // Enable contentEditable for text editing
        target.contentEditable = 'true';
        target.focus();
        target.classList.remove('__editor_hover__');
        const onBlur = () => {
          target.contentEditable = 'false';
          target.removeEventListener('blur', onBlur);
          pushHistory();
          refreshSelectedInfo();
        };
        target.addEventListener('blur', onBlur);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!selectedElRef.current || target.contentEditable === 'true') return;

      // Only initiate drag if clicking on the selected element
      const sel = selectedElRef.current;
      if (!sel.contains(target) && sel !== target) return;

      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.el = sel;
      dragState.shiftHeld = e.shiftKey;

      const cs = doc.defaultView!.getComputedStyle(sel);
      dragState.origMarginTop = parseFloat(cs.marginTop) || 0;
      dragState.origMarginLeft = parseFloat(cs.marginLeft) || 0;

      const onMouseMoveDoc = (me: MouseEvent) => {
        const dx = me.clientX - dragState.startX;
        const dy = me.clientY - dragState.startY;
        if (!dragState.active && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          dragState.active = true;
          doc.body.classList.add('__editor_drag_active__');
          if (dragState.el) dragState.el.classList.add('__editor_drag_ghost__');
          setIsDragging(true);
        }
        if (!dragState.active || !dragState.el) return;

        if (me.shiftKey || dragState.shiftHeld) {
          // Free-move mode: adjust margins
          dragState.el.style.marginTop = (dragState.origMarginTop + dy) + 'px';
          dragState.el.style.marginLeft = (dragState.origMarginLeft + dx) + 'px';
        } else {
          // Reorder mode: show drop indicator
          const parent = dragState.el.parentElement;
          if (!parent) return;
          const siblings = Array.from(parent.children).filter(
            c => c !== dragState.el && !c.classList.contains('__editor_drop_indicator__')
          );

          // Remove old indicator
          if (dragState.indicator) {
            dragState.indicator.remove();
            dragState.indicator = null;
          }

          // Find insertion point
          let insertBefore: HTMLElement | null = null;
          for (const sib of siblings) {
            const rect = sib.getBoundingClientRect();
            if (me.clientY < rect.top + rect.height / 2) {
              insertBefore = sib as HTMLElement;
              break;
            }
          }

          // Create indicator
          const indicator = doc.createElement('div');
          indicator.className = '__editor_drop_indicator__';

          if (insertBefore) {
            parent.insertBefore(indicator, insertBefore);
          } else {
            parent.appendChild(indicator);
          }
          dragState.indicator = indicator;
          dragState.insertBefore = insertBefore;
        }
      };

      const onMouseUpDoc = () => {
        doc.removeEventListener('mousemove', onMouseMoveDoc);
        doc.removeEventListener('mouseup', onMouseUpDoc);

        if (dragState.active && dragState.el) {
          dragState.el.classList.remove('__editor_drag_ghost__');
          doc.body.classList.remove('__editor_drag_active__');

          if (!dragState.shiftHeld && !(e.shiftKey)) {
            // Reorder: move element
            const parent = dragState.el.parentElement;
            if (parent && dragState.indicator) {
              if (dragState.insertBefore) {
                parent.insertBefore(dragState.el, dragState.insertBefore);
              } else {
                // Insert at end, but before the indicator
                parent.insertBefore(dragState.el, dragState.indicator);
              }
            }
          }

          // Remove indicator
          if (dragState.indicator) {
            dragState.indicator.remove();
            dragState.indicator = null;
          }

          pushHistory();
          refreshSelectedInfo();
        }

        dragState.active = false;
        dragState.el = null;
        dragState.insertBefore = null;
        setIsDragging(false);
      };

      doc.addEventListener('mousemove', onMouseMoveDoc);
      doc.addEventListener('mouseup', onMouseUpDoc);
    };

    // Prevent navigation
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        e.preventDefault();
      }
    };

    // Submit prevention
    const onSubmit = (e: Event) => {
      e.preventDefault();
    };

    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('dblclick', onDblClick, true);
    doc.addEventListener('mousedown', onMouseDown, true);
    doc.addEventListener('click', onClickCapture, false);
    doc.addEventListener('submit', onSubmit, true);

    // Cleanup function
    interactionCleanupRef.current = () => {
      doc.removeEventListener('mouseover', onMouseOver, true);
      doc.removeEventListener('mouseout', onMouseOut, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('dblclick', onDblClick, true);
      doc.removeEventListener('mousedown', onMouseDown, true);
      doc.removeEventListener('click', onClickCapture, false);
      doc.removeEventListener('submit', onSubmit, true);
    };
  }, [selectElement, pushHistory, refreshSelectedInfo]);

  // --- File operations ---
  const openFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = ev.target?.result as string;
      setHistory([]);
      setHistoryIdx(-1);
      loadHtmlIntoIframe(html, true);
      setSourceCode(html);
    };
    reader.readAsText(file);
    // Reset input so same file can be opened again
    e.target.value = '';
  }, [loadHtmlIntoIframe]);

  const saveFile = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const html = serializeDocument(doc);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'edited.html';
    a.click();
    URL.revokeObjectURL(url);
  }, [fileName]);

  // --- Element operations ---
  const duplicateSelected = useCallback(() => {
    const el = selectedElRef.current;
    if (!el || !el.parentElement) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-editor-selected');
    clone.classList.remove('__editor_selected__');
    if (clone.id) clone.id = clone.id + '-copy';
    el.parentElement.insertBefore(clone, el.nextSibling);
    pushHistory();
    selectElement(clone);
  }, [pushHistory, selectElement]);

  const deleteSelected = useCallback(() => {
    const el = selectedElRef.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    const next = el.nextElementSibling || el.previousElementSibling;
    parent.removeChild(el);
    pushHistory();
    if (next && isEditable(next as HTMLElement)) {
      selectElement(next as HTMLElement);
    } else {
      selectElement(null);
    }
  }, [pushHistory, selectElement]);

  const moveSelected = useCallback((direction: 'up' | 'down') => {
    const el = selectedElRef.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    if (direction === 'up') {
      const prev = el.previousElementSibling;
      if (prev) {
        parent.insertBefore(el, prev);
        pushHistory();
        refreshSelectedInfo();
      }
    } else {
      const next = el.nextElementSibling;
      if (next) {
        parent.insertBefore(el, next.nextSibling);
        pushHistory();
        refreshSelectedInfo();
      }
    }
  }, [pushHistory, refreshSelectedInfo]);

  // --- Style updates ---
  const updateStyle = useCallback((prop: keyof ElementStyles, value: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    (el.style as any)[prop] = value;
    refreshSelectedInfo();
  }, [refreshSelectedInfo]);

  const updateStyleAndSave = useCallback((prop: keyof ElementStyles, value: string) => {
    updateStyle(prop, value);
    // Debounce history push
    clearTimeout((updateStyleAndSave as any)._timer);
    (updateStyleAndSave as any)._timer = setTimeout(() => {
      pushHistory();
    }, 500);
  }, [updateStyle, pushHistory]);

  const updateClass = useCallback((className: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    // Preserve editor classes
    const editorClasses = (el.className.toString() || '').split(' ').filter(c => c.startsWith('__editor_'));
    const userClasses = className.split(' ').filter(c => c.trim());
    el.className = [...userClasses, ...editorClasses].join(' ');
    refreshSelectedInfo();
    pushHistory();
  }, [refreshSelectedInfo, pushHistory]);

  const updateId = useCallback((id: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    el.id = id;
    refreshSelectedInfo();
    pushHistory();
  }, [refreshSelectedInfo, pushHistory]);

  const updateText = useCallback((text: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    el.textContent = text;
    refreshSelectedInfo();
    clearTimeout((updateText as any)._timer);
    (updateText as any)._timer = setTimeout(() => pushHistory(), 500);
  }, [refreshSelectedInfo, pushHistory]);

  const editInnerHTML = useCallback((html: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    el.innerHTML = html;
    pushHistory();
    refreshSelectedInfo();
  }, [pushHistory, refreshSelectedInfo]);

  // --- Source code sync ---
  const syncSourceFromIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    setSourceCode(serializeDocument(doc));
  }, []);

  const applySourceToIframe = useCallback((html: string) => {
    setSourceCode(html);
    loadHtmlIntoIframe(html, true);
  }, [loadHtmlIntoIframe]);

  const toggleSource = useCallback(() => {
    if (!showSource) {
      syncSourceFromIframe();
    }
    setShowSource(s => !s);
  }, [showSource, syncSourceFromIframe]);

  // --- Zoom ---
  const zoomIn = useCallback(() => setZoom(z => Math.min(z + 10, 200)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 10, 30)), []);
  const zoomReset = useCallback(() => setZoom(100), []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'o') {
        e.preventDefault();
        openFile();
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        saveFile();
      } else if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === 'Delete' && !e.ctrlKey && !e.shiftKey) {
        if (selectedElRef.current) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelected('up');
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelected('down');
      } else if (e.key === 'Escape') {
        selectElement(null);
      }
    };

    window.addEventListener('keydown', handler);

    // Also listen in iframe
    const iframeHandler = () => {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        doc.addEventListener('keydown', handler);
      }
    };
    // Delay to ensure iframe is ready
    const t = setTimeout(iframeHandler, 500);

    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(t);
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        doc.removeEventListener('keydown', handler);
      }
    };
  }, [openFile, saveFile, undo, redo, duplicateSelected, deleteSelected, moveSelected, selectElement]);

  // --- Render ---
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#13162b',
      color: '#c8cdd8',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      <Toolbar
        isFileLoaded={isLoaded}
        hasSelection={!!selectedInfo}
        canUndo={historyIdx > 0}
        canRedo={historyIdx < history.length - 1}
        showSource={showSource}
        zoom={zoom}
        onOpenFile={openFile}
        onSaveFile={saveFile}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onMoveUp={() => moveSelected('up')}
        onMoveDown={() => moveSelected('down')}
        onToggleSource={toggleSource}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        fileName={fileName}
      />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          background: isLoaded ? '#e5e7eb' : '#13162b',
        }}>
          {/* Checkerboard / grid background */}
          {isLoaded && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              opacity: 0.3,
              pointerEvents: 'none',
              zIndex: 0,
            }} />
          )}

          <iframe
            ref={iframeRef}
            style={{
              width: `${10000 / zoom}%`,
              height: `${10000 / zoom}%`,
              border: 'none',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              position: 'relative',
              zIndex: 1,
              background: '#fff',
              display: isLoaded ? 'block' : 'none',
            }}
            sandbox="allow-same-origin allow-scripts"
            title="Editor Canvas"
          />

          {!isLoaded && <WelcomeScreen onOpenFile={openFile} />}

          {/* Drag status indicator */}
          {isDragging && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#3b82f6',
              color: '#fff',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              zIndex: 100,
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              Hold Shift for free-move mode
            </div>
          )}
        </div>

        {/* Properties Panel */}
        {selectedInfo && isLoaded && (
          <PropertiesPanel
            selectedInfo={selectedInfo}
            onStyleChange={updateStyleAndSave}
            onClassChange={updateClass}
            onIdChange={updateId}
            onTextChange={updateText}
            onEditInnerHTML={editInnerHTML}
          />
        )}
      </div>

      {/* Source panel */}
      {showSource && isLoaded && (
        <div style={{
          height: '240px',
          minHeight: '100px',
          background: '#0d1117',
          borderTop: '1px solid #2a2f4a',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            background: '#161b22',
            borderBottom: '1px solid #21262d',
          }}>
            <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: 500 }}>HTML Source</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={syncSourceFromIframe}
                style={{
                  fontSize: '11px',
                  background: '#21262d',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                  color: '#c9d1d9',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
              <button
                onClick={() => applySourceToIframe(sourceCode)}
                style={{
                  fontSize: '11px',
                  background: '#238636',
                  border: '1px solid #2ea043',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                Apply Changes
              </button>
            </div>
          </div>
          <textarea
            value={sourceCode}
            onChange={e => setSourceCode(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              background: '#0d1117',
              color: '#c9d1d9',
              border: 'none',
              outline: 'none',
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              lineHeight: '1.5',
              resize: 'none',
              tabSize: 2,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
