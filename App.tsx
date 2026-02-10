import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FileTreePanel } from './components/FileTreePanel';
import { SelectedElementInfo, ElementStyles, ProjectFile } from './types';

// ===== Path utilities =====

function resolvePath(basePath: string, relativePath: string): string {
  relativePath = relativePath.replace(/^\.\//, '');
  if (!basePath) return relativePath;
  const baseParts = basePath.split('/');
  const relParts = relativePath.split('/');
  const result = [...baseParts];
  for (const part of relParts) {
    if (part === '..') {
      result.pop();
    } else if (part !== '.') {
      result.push(part);
    }
  }
  return result.join('/');
}

function processCssUrls(css: string, cssPath: string, blobUrls: Record<string, string>): string {
  const cssDir = cssPath.includes('/') ? cssPath.substring(0, cssPath.lastIndexOf('/')) : '';
  return css.replace(/url\(\s*['"]?([^'");\s]+)['"]?\s*\)/g, (match, url) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) {
      return match;
    }
    const resolved = resolvePath(cssDir, url);
    if (blobUrls[resolved]) {
      return `url('${blobUrls[resolved]}')`;
    }
    return match;
  });
}

// ===== HTML processing =====

function processHtmlForEditor(
  html: string,
  htmlPath: string,
  cssContents: Record<string, string>,
  blobUrls: Record<string, string>,
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const htmlDir = htmlPath.includes('/') ? htmlPath.substring(0, htmlPath.lastIndexOf('/')) : '';

  // Replace local <link rel="stylesheet"> with <style data-editor-href>
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      continue;
    }
    const resolved = resolvePath(htmlDir, href);
    if (cssContents[resolved] !== undefined) {
      const style = doc.createElement('style');
      style.setAttribute('data-editor-href', href);
      style.setAttribute('data-editor-resolved-path', resolved);
      style.textContent = processCssUrls(cssContents[resolved], resolved, blobUrls);
      link.parentElement?.replaceChild(style, link);
    }
  }

  // Replace relative src with blob URLs
  doc.querySelectorAll('[src]').forEach(el => {
    const src = el.getAttribute('src');
    if (!src || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//') || src.startsWith('data:') || src.startsWith('blob:')) {
      return;
    }
    const resolved = resolvePath(htmlDir, src);
    if (blobUrls[resolved]) {
      el.setAttribute('data-editor-original-src', src);
      el.setAttribute('src', blobUrls[resolved]);
    }
  });

  // Replace relative href on images/assets (not links)
  doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => {
    const href = el.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('data:')) return;
    const resolved = resolvePath(htmlDir, href);
    if (blobUrls[resolved]) {
      el.setAttribute('data-editor-original-href', href);
      el.setAttribute('href', blobUrls[resolved]);
    }
  });

  // Resolve url() in inline style attributes
  doc.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style');
    if (style && style.includes('url(')) {
      const dummyPath = htmlDir ? htmlDir + '/_' : '_';
      const processed = processCssUrls(style, dummyPath, blobUrls);
      if (processed !== style) {
        el.setAttribute('data-editor-original-style', style);
        el.setAttribute('style', processed);
      }
    }
  });

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

// ===== DOM utilities =====

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
    const sameTag = Array.from(parent.children).filter(s => s.tagName === current!.tagName);
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
    gridColumnStart: el.style.gridColumnStart || cs.gridColumnStart,
    gridColumnEnd: el.style.gridColumnEnd || cs.gridColumnEnd,
  };
}

function serializeDocument(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  // Remove editor injected elements
  clone.querySelector('#__editor_styles__')?.remove();
  clone.querySelectorAll('.__editor_drop_indicator__').forEach(e => e.remove());
  clone.querySelectorAll('.__editor_drag_label__').forEach(e => e.remove());
  // Restore <link> from <style data-editor-href>
  clone.querySelectorAll('style[data-editor-href]').forEach(style => {
    const href = style.getAttribute('data-editor-href')!;
    const link = doc.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    style.parentElement?.replaceChild(link, style);
  });
  // Restore original src
  clone.querySelectorAll('[data-editor-original-src]').forEach(el => {
    el.setAttribute('src', el.getAttribute('data-editor-original-src')!);
    el.removeAttribute('data-editor-original-src');
  });
  // Restore original href (favicons)
  clone.querySelectorAll('[data-editor-original-href]').forEach(el => {
    el.setAttribute('href', el.getAttribute('data-editor-original-href')!);
    el.removeAttribute('data-editor-original-href');
  });
  // Restore original inline styles
  clone.querySelectorAll('[data-editor-original-style]').forEach(el => {
    el.setAttribute('style', el.getAttribute('data-editor-original-style')!);
    el.removeAttribute('data-editor-original-style');
  });
  // Remove editor classes
  clone.querySelectorAll('[class]').forEach(el => {
    const classes = el.className.toString().split(' ').filter(c => !c.startsWith('__editor_'));
    if (classes.length === 0 || (classes.length === 1 && classes[0] === '')) {
      el.removeAttribute('class');
    } else {
      el.setAttribute('class', classes.join(' '));
    }
  });
  clone.querySelectorAll('[data-editor-selected]').forEach(el => {
    el.removeAttribute('data-editor-selected');
  });
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ''}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ''}>\n`
    : '<!DOCTYPE html>\n';
  return doctype + clone.outerHTML;
}

function isEditable(el: HTMLElement): boolean {
  const skip = ['html', 'head', 'meta', 'link', 'script', 'style', 'title', 'br', 'hr'];
  return !skip.includes(el.tagName.toLowerCase());
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function classifyFileType(ext: string): ProjectFile['type'] {
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'css') return 'css';
  if (['js', 'mjs'].includes(ext)) return 'js';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(ext)) return 'font';
  return 'other';
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

  // Project state
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeHtmlPath, setActiveHtmlPath] = useState('');
  const [cssContents, setCssContents] = useState<Record<string, string>>({});
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [showFileTree, setShowFileTree] = useState(false);
  const [sourceTab, setSourceTab] = useState<string>('html');
  const [saveStatus, setSaveStatus] = useState('');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // --- Refs ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedElRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const historyRef = useRef(history);
  const historyIdxRef = useRef(historyIdx);
  const blobUrlsRef = useRef<Record<string, string>>({});
  const cssContentsRef = useRef<Record<string, string>>({});
  const projectFilesRef = useRef<ProjectFile[]>([]);
  const activeHtmlPathRef = useRef('');
  const fileHandlesRef = useRef<Record<string, any>>({});
  const multiSelectedRef = useRef<Set<HTMLElement>>(new Set());
  const [selectionCount, setSelectionCount] = useState(0);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIdxRef.current = historyIdx; }, [historyIdx]);
  useEffect(() => { blobUrlsRef.current = blobUrls; }, [blobUrls]);
  useEffect(() => { cssContentsRef.current = cssContents; }, [cssContents]);
  useEffect(() => { projectFilesRef.current = projectFiles; }, [projectFiles]);
  useEffect(() => { activeHtmlPathRef.current = activeHtmlPath; }, [activeHtmlPath]);

  // --- History ---
  const pushHistory = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const html = serializeDocument(doc);
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    const newHistory = [...h.slice(0, idx + 1), html];
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  }, []);

  // --- Load processed HTML into iframe ---
  const loadProcessedHtml = useCallback((processedHtml: string, addToHistory = true) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (interactionCleanupRef.current) {
      interactionCleanupRef.current();
      interactionCleanupRef.current = null;
    }
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(processedHtml);
    doc.close();
    setTimeout(() => {
      setupIframeInteraction(doc);
      if (addToHistory) pushHistory();
      selectElement(null);
      setIsLoaded(true);
    }, 150);
  }, []);

  const undo = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    const cleanHtml = historyRef.current[newIdx];
    setHistoryIdx(newIdx);
    // Re-process for iframe (inline CSS + blob urls)
    const processed = processHtmlForEditor(cleanHtml, activeHtmlPathRef.current, cssContentsRef.current, blobUrlsRef.current);
    loadProcessedHtml(processed, false);
  }, [loadProcessedHtml]);

  const redo = useCallback(() => {
    const idx = historyIdxRef.current;
    const h = historyRef.current;
    if (idx >= h.length - 1) return;
    const newIdx = idx + 1;
    const cleanHtml = h[newIdx];
    setHistoryIdx(newIdx);
    const processed = processHtmlForEditor(cleanHtml, activeHtmlPathRef.current, cssContentsRef.current, blobUrlsRef.current);
    loadProcessedHtml(processed, false);
  }, [loadProcessedHtml]);

  // --- Element info ---
  const extractElementInfo = useCallback((el: HTMLElement): SelectedElementInfo => {
    const doc = iframeRef.current?.contentDocument;
    const root = doc?.body || el;
    const parent = el.parentElement;
    const parentCs = parent ? el.ownerDocument.defaultView!.getComputedStyle(parent) : null;
    const isInGrid = parentCs ? (parentCs.display === 'grid' || parentCs.display === 'inline-grid') : false;
    return {
      tagName: el.tagName.toLowerCase(),
      path: getElementPath(el, root),
      className: (el.className.toString() || '').split(' ').filter(c => !c.startsWith('__editor_')).join(' '),
      id: el.id || '',
      textContent: el.children.length === 0 ? (el.textContent || '') : '',
      innerHTML: el.innerHTML,
      hasChildren: el.children.length > 0,
      styles: getComputedStyles(el),
      isInGrid,
    };
  }, []);

  const selectElement = useCallback((el: HTMLElement | null, addToSelection = false) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const multi = multiSelectedRef.current;

    if (!el || !isEditable(el)) {
      // Clear all
      multi.forEach(e => { e.removeAttribute('data-editor-selected'); e.classList.remove('__editor_selected__'); });
      multi.clear();
      selectedElRef.current = null;
      setSelectedInfo(null);
      setSelectionCount(0);
      return;
    }

    if (addToSelection) {
      if (multi.has(el)) {
        // Toggle off
        multi.delete(el);
        el.removeAttribute('data-editor-selected');
        el.classList.remove('__editor_selected__');
        if (selectedElRef.current === el) {
          const remaining: HTMLElement[] = Array.from(multi);
          if (remaining.length > 0) {
            selectedElRef.current = remaining[remaining.length - 1];
            setSelectedInfo(extractElementInfo(selectedElRef.current));
          } else {
            selectedElRef.current = null;
            setSelectedInfo(null);
          }
        }
      } else {
        // Add to selection
        el.setAttribute('data-editor-selected', 'true');
        el.classList.add('__editor_selected__');
        multi.add(el);
        selectedElRef.current = el;
        setSelectedInfo(extractElementInfo(el));
      }
    } else {
      // Single select — clear others first
      multi.forEach(e => { e.removeAttribute('data-editor-selected'); e.classList.remove('__editor_selected__'); });
      multi.clear();
      el.setAttribute('data-editor-selected', 'true');
      el.classList.add('__editor_selected__');
      multi.add(el);
      selectedElRef.current = el;
      setSelectedInfo(extractElementInfo(el));
    }
    setSelectionCount(multi.size);
  }, [extractElementInfo]);

  const refreshSelectedInfo = useCallback(() => {
    // Clean up disconnected elements from multi-select
    const multi = multiSelectedRef.current;
    for (const e of Array.from(multi) as HTMLElement[]) {
      if (!e.isConnected) multi.delete(e);
    }
    setSelectionCount(multi.size);
    const el = selectedElRef.current;
    if (el && el.isConnected) setSelectedInfo(extractElementInfo(el));
    else {
      setSelectedInfo(null);
      selectedElRef.current = null;
      // Pick another primary if available
      const remaining: HTMLElement[] = Array.from(multi);
      if (remaining.length > 0) {
        selectedElRef.current = remaining[remaining.length - 1];
        setSelectedInfo(extractElementInfo(selectedElRef.current));
      }
    }
  }, [extractElementInfo]);

  // --- Setup iframe interaction ---
  const setupIframeInteraction = useCallback((doc: Document) => {
    let styleEl = doc.getElementById('__editor_styles__');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = '__editor_styles__';
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      .__editor_hover__ { outline: 2px dashed rgba(59,130,246,0.6) !important; outline-offset: 1px !important; cursor: pointer !important; }
      .__editor_selected__ { outline: 2px solid #3b82f6 !important; outline-offset: 1px !important; }
      .__editor_drag_ghost__ { opacity: 0.35 !important; pointer-events: none !important; outline: 2px dashed #f59e0b !important; }
      .__editor_drop_indicator__ { height: 4px; background: #22c55e; pointer-events: none; z-index: 99999; border-radius: 2px; box-shadow: 0 0 8px rgba(34,197,94,0.6); margin: -2px 4px; position: relative; }
      .__editor_drop_zone__ { outline: 1px dashed rgba(34,197,94,0.2) !important; outline-offset: -1px !important; }
      .__editor_drop_target__ { outline: 2px dashed #22c55e !important; outline-offset: -2px !important; background-color: rgba(34,197,94,0.04) !important; }
      .__editor_drag_active__ * { cursor: grabbing !important; }
      .__editor_drag_label__ { position: fixed; background: #1b1f36; color: #e0e4eb; font-size: 11px; font-family: 'Inter', sans-serif; padding: 5px 10px; border-radius: 6px; pointer-events: none; z-index: 100000; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid #3a3f5c; }
      .__editor_drag_label__ b { color: #22c55e; font-weight: 600; }
    `;

    const VOID_TAGS = new Set(['IMG', 'INPUT', 'BR', 'HR', 'META', 'LINK', 'AREA', 'BASE', 'COL', 'EMBED', 'SOURCE', 'TRACK', 'WBR']);
    const SKIP_TAGS = new Set(['HTML', 'HEAD', 'STYLE', 'SCRIPT', 'META', 'LINK', 'TITLE', 'NOSCRIPT']);

    function isContainer(el: HTMLElement): boolean {
      return !VOID_TAGS.has(el.tagName) && !SKIP_TAGS.has(el.tagName);
    }

    function isDescendantOfAny(el: HTMLElement, set: Set<HTMLElement>): boolean {
      let cur: HTMLElement | null = el;
      while (cur) {
        if (set.has(cur)) return true;
        cur = cur.parentElement;
      }
      return false;
    }

    function getElementLabel(el: HTMLElement): string {
      let label = el.tagName.toLowerCase();
      if (el.id) label += '#' + el.id;
      else {
        const cls = (el.className?.toString() || '').split(' ')
          .filter(c => c && !c.startsWith('__editor_')).slice(0, 2).join('.');
        if (cls) label += '.' + cls;
      }
      return label;
    }

    let hoveredEl: HTMLElement | null = null;
    let didDrag = false;

    const dragState = {
      active: false,
      startX: 0, startY: 0, shiftHeld: false,
      origMargins: [] as { el: HTMLElement; top: number; left: number }[],
      indicator: null as HTMLElement | null,
      targetContainer: null as HTMLElement | null,
      insertBefore: null as HTMLElement | null,
      dragLabel: null as HTMLElement | null,
      dropZones: [] as HTMLElement[],
    };

    // --- Hover ---
    const onMouseOver = (e: MouseEvent) => {
      if (dragState.active) return;
      const t = e.target as HTMLElement;
      if (!isEditable(t)) return;
      if (hoveredEl) hoveredEl.classList.remove('__editor_hover__');
      t.classList.add('__editor_hover__');
      hoveredEl = t;
    };
    const onMouseOut = (e: MouseEvent) => {
      if (dragState.active) return;
      const t = e.target as HTMLElement;
      t.classList.remove('__editor_hover__');
      if (hoveredEl === t) hoveredEl = null;
    };

    // --- Click (with multi-select support) ---
    const onClick = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (didDrag) { didDrag = false; return; }
      const t = e.target as HTMLElement;
      if (t === doc.body || t === doc.documentElement) {
        selectElement(null);
      } else {
        selectElement(t, e.ctrlKey || e.metaKey);
      }
    };

    // --- Double-click for inline text editing ---
    const onDblClick = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.target as HTMLElement;
      if (t.children.length === 0 && isEditable(t)) {
        t.contentEditable = 'true'; t.focus();
        t.classList.remove('__editor_hover__');
        const onBlur = () => { t.contentEditable = 'false'; t.removeEventListener('blur', onBlur); pushHistory(); refreshSelectedInfo(); };
        t.addEventListener('blur', onBlur);
      }
    };

    // --- Drag (cross-container + free-move + multi-element) ---
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.contentEditable === 'true') return;

      const multi = multiSelectedRef.current;
      if (multi.size === 0) return;

      // Check if clicking on a selected element or its child
      let clickedOnSelected = false;
      let cur: HTMLElement | null = t;
      while (cur) {
        if (multi.has(cur)) { clickedOnSelected = true; break; }
        cur = cur.parentElement;
      }
      if (!clickedOnSelected) return;

      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.shiftHeld = e.shiftKey;

      // Store original margins for free-move mode
      dragState.origMargins = (Array.from(multi) as HTMLElement[]).map(el => {
        const cs = doc.defaultView!.getComputedStyle(el);
        return { el, top: parseFloat(cs.marginTop) || 0, left: parseFloat(cs.marginLeft) || 0 };
      });

      function cleanupDrag() {
        if (dragState.indicator) { dragState.indicator.remove(); dragState.indicator = null; }
        if (dragState.targetContainer) { dragState.targetContainer.classList.remove('__editor_drop_target__'); dragState.targetContainer = null; }
        if (dragState.dragLabel) { dragState.dragLabel.remove(); dragState.dragLabel = null; }
        dragState.dropZones.forEach(el => el.classList.remove('__editor_drop_zone__'));
        dragState.dropZones = [];
        dragState.insertBefore = null;
      }

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - dragState.startX;
        const dy = me.clientY - dragState.startY;

        // Activate drag after threshold
        if (!dragState.active && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          dragState.active = true;
          didDrag = true;
          doc.body.classList.add('__editor_drag_active__');
          multi.forEach(el => el.classList.add('__editor_drag_ghost__'));
          setIsDragging(true);

          // Mark valid drop zone containers (not free-move mode)
          if (!me.shiftKey && !dragState.shiftHeld) {
            const allEls = doc.body.querySelectorAll('*');
            allEls.forEach(el => {
              const htmlEl = el as HTMLElement;
              if (isContainer(htmlEl) && !multi.has(htmlEl) && !isDescendantOfAny(htmlEl, multi) && htmlEl.offsetParent !== null) {
                htmlEl.classList.add('__editor_drop_zone__');
                dragState.dropZones.push(htmlEl);
              }
            });
            // Body is always a drop zone
            if (!doc.body.classList.contains('__editor_drop_zone__')) {
              doc.body.classList.add('__editor_drop_zone__');
              dragState.dropZones.push(doc.body);
            }
          }
        }

        if (!dragState.active) return;

        if (me.shiftKey || dragState.shiftHeld) {
          // Free-move mode: adjust margins on all selected
          cleanupDrag();
          for (const { el, top, left } of dragState.origMargins) {
            el.style.marginTop = (top + dy) + 'px';
            el.style.marginLeft = (left + dx) + 'px';
          }
        } else {
          // Cross-container drag mode
          // Use elementFromPoint (ghosted elements have pointer-events: none)
          const targetEl = doc.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null;
          if (!targetEl || targetEl === doc.documentElement) {
            cleanupDrag();
            return;
          }

          // Find nearest valid container
          let container: HTMLElement | null = targetEl;
          while (container && container !== doc.documentElement) {
            if (isContainer(container) && !multi.has(container) && !isDescendantOfAny(container, multi)) break;
            container = container.parentElement;
          }
          if (!container || container === doc.documentElement) container = doc.body;

          // Update container highlight
          if (dragState.targetContainer !== container) {
            if (dragState.targetContainer) dragState.targetContainer.classList.remove('__editor_drop_target__');
            container.classList.add('__editor_drop_target__');
            dragState.targetContainer = container;
          }

          // Compute insertion position among container's children
          const children = Array.from(container.children).filter(c =>
            !c.classList.contains('__editor_drop_indicator__') &&
            !c.classList.contains('__editor_drag_label__') &&
            !multi.has(c as HTMLElement)
          );

          let insertBefore: HTMLElement | null = null;
          for (const child of children) {
            const rect = child.getBoundingClientRect();
            if (me.clientY < rect.top + rect.height / 2) {
              insertBefore = child as HTMLElement;
              break;
            }
          }

          // Show/update insertion indicator
          if (dragState.indicator) dragState.indicator.remove();
          const indicator = doc.createElement('div');
          indicator.className = '__editor_drop_indicator__';
          if (insertBefore) container.insertBefore(indicator, insertBefore);
          else container.appendChild(indicator);
          dragState.indicator = indicator;
          dragState.insertBefore = insertBefore;

          // Floating label showing target
          if (!dragState.dragLabel) {
            dragState.dragLabel = doc.createElement('div');
            dragState.dragLabel.className = '__editor_drag_label__';
            doc.body.appendChild(dragState.dragLabel);
          }
          const containerLabel = getElementLabel(container);
          const posLabel = insertBefore ? `before <b>${getElementLabel(insertBefore)}</b>` : '<b>end</b>';
          const countStr = multi.size > 1 ? `(${multi.size}) ` : '';
          dragState.dragLabel.innerHTML = `${countStr}\u2192 <b>${containerLabel}</b> &bull; ${posLabel}`;
          dragState.dragLabel.style.left = (me.clientX + 18) + 'px';
          dragState.dragLabel.style.top = (me.clientY - 14) + 'px';
        }
      };

      const onUp = () => {
        doc.removeEventListener('mousemove', onMove);
        doc.removeEventListener('mouseup', onUp);

        if (dragState.active) {
          multi.forEach(el => el.classList.remove('__editor_drag_ghost__'));
          doc.body.classList.remove('__editor_drag_active__');

          // Perform the move if in container-drag mode
          if (!dragState.shiftHeld && dragState.targetContainer) {
            const container = dragState.targetContainer;
            const beforeEl = dragState.insertBefore;

            // Sort selected by DOM order to maintain relative order
            const sorted = (Array.from(multi) as HTMLElement[]).sort((a, b) => {
              const pos = a.compareDocumentPosition(b);
              return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });

            for (const el of sorted) {
              if (beforeEl) container.insertBefore(el, beforeEl);
              else container.appendChild(el);
            }
          }

          cleanupDrag();
          pushHistory();
          refreshSelectedInfo();
        }

        dragState.active = false;
        setIsDragging(false);
      };

      doc.addEventListener('mousemove', onMove);
      doc.addEventListener('mouseup', onUp);
    };

    const onClickCapture = (e: MouseEvent) => { if ((e.target as HTMLElement).tagName === 'A') e.preventDefault(); };
    const onSubmit = (e: Event) => { e.preventDefault(); };

    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('dblclick', onDblClick, true);
    doc.addEventListener('mousedown', onMouseDown, true);
    doc.addEventListener('click', onClickCapture, false);
    doc.addEventListener('submit', onSubmit, true);

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

  // ===== FILE OPERATIONS =====

  // --- Open single file (no CSS support) ---
  const openFile = useCallback(async () => {
    // Try File System Access API for write-back support
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'HTML files', accept: { 'text/html': ['.html', '.htm'] } }],
        });
        const file: File = await handle.getFile();
        fileHandlesRef.current = { [file.name]: handle };
        setFileName(file.name);
        setProjectFiles([]); setActiveHtmlPath(file.name);
        activeHtmlPathRef.current = file.name;
        setCssContents({}); setBlobUrls({});
        setShowFileTree(false); setSourceTab('html');
        const html = await file.text();
        setHistory([]); setHistoryIdx(-1);
        setSourceCode(html);
        loadProcessedHtml(html, true);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return; // user cancelled
      }
    }
    fileInputRef.current?.click();
  }, [loadProcessedHtml]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setProjectFiles([]); setActiveHtmlPath('');
    setCssContents({}); setBlobUrls({});
    setShowFileTree(false); setSourceTab('html');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = (ev.target?.result ?? '') as string;
      setHistory([]); setHistoryIdx(-1);
      setSourceCode(html);
      loadProcessedHtml(html, true);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadProcessedHtml]);

  // --- Open folder (with CSS + image support) ---
  const openFolder = useCallback(async () => {
    // Try File System Access API for write-back support
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        await openFolderFromHandle(dirHandle);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return; // user cancelled
      }
    }
    folderInputRef.current?.click();
  }, []);

  const handleFolderChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Revoke old blob URLs
    Object.values(blobUrlsRef.current).forEach((url: string) => URL.revokeObjectURL(url));

    const newFiles: ProjectFile[] = [];
    const newBlobUrls: Record<string, string> = {};
    const newCssContents: Record<string, string> = {};
    const readPromises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Strip root folder name from path
      const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
      if (!relativePath) continue;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const type = classifyFileType(ext);

      const pf: ProjectFile = { name: file.name, path: relativePath, type, content: '', file };

      if (type === 'html' || type === 'css' || type === 'js') {
        readPromises.push(
          file.text().then(text => {
            pf.content = text;
            if (type === 'css') newCssContents[relativePath] = text;
          })
        );
      } else if (type === 'image' || type === 'font') {
        const blobUrl = URL.createObjectURL(file);
        pf.blobUrl = blobUrl;
        newBlobUrls[relativePath] = blobUrl;
      }
      newFiles.push(pf);
    }

    await Promise.all(readPromises);

    // Sort: html first, then css, js, images, fonts, other
    const typeOrder: Record<string, number> = { html: 0, css: 1, js: 2, image: 3, font: 4, other: 5 };
    newFiles.sort((a, b) => (typeOrder[a.type] - typeOrder[b.type]) || a.path.localeCompare(b.path));

    setProjectFiles(newFiles);
    projectFilesRef.current = newFiles;
    setBlobUrls(newBlobUrls);
    blobUrlsRef.current = newBlobUrls;
    setCssContents(newCssContents);
    cssContentsRef.current = newCssContents;
    setShowFileTree(true);
    setSourceTab('html');

    // Find first HTML file (prefer index.html)
    const htmlFiles = newFiles.filter(f => f.type === 'html');
    const firstHtml = htmlFiles.find(f => f.name === 'index.html') || htmlFiles[0];
    if (firstHtml) {
      loadProjectHtml(firstHtml.path, firstHtml.content, newCssContents, newBlobUrls);
    }

    fileHandlesRef.current = {};
    e.target.value = '';
  }, []);

  // --- Open folder via File System Access API (gives write-back) ---
  const openFolderFromHandle = useCallback(async (dirHandle: any) => {
    Object.values(blobUrlsRef.current).forEach((url: string) => URL.revokeObjectURL(url));

    const newFiles: ProjectFile[] = [];
    const newBlobUrls: Record<string, string> = {};
    const newCssContents: Record<string, string> = {};
    const newHandles: Record<string, any> = {};

    async function readDir(handle: any, basePath: string) {
      for await (const entry of handle.values()) {
        const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        if (entry.kind === 'file') {
          const file: File = await entry.getFile();
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const type = classifyFileType(ext);
          const pf: ProjectFile = { name: file.name, path: entryPath, type, content: '', file };

          if (type === 'html' || type === 'css' || type === 'js') {
            pf.content = await file.text();
            if (type === 'css') newCssContents[entryPath] = pf.content;
          } else if (type === 'image' || type === 'font') {
            const blobUrl = URL.createObjectURL(file);
            pf.blobUrl = blobUrl;
            newBlobUrls[entryPath] = blobUrl;
          }
          newFiles.push(pf);
          newHandles[entryPath] = entry;
        } else if (entry.kind === 'directory') {
          await readDir(entry, entryPath);
        }
      }
    }

    await readDir(dirHandle, '');

    const typeOrder: Record<string, number> = { html: 0, css: 1, js: 2, image: 3, font: 4, other: 5 };
    newFiles.sort((a, b) => (typeOrder[a.type] - typeOrder[b.type]) || a.path.localeCompare(b.path));

    setProjectFiles(newFiles);
    projectFilesRef.current = newFiles;
    setBlobUrls(newBlobUrls);
    blobUrlsRef.current = newBlobUrls;
    setCssContents(newCssContents);
    cssContentsRef.current = newCssContents;
    setShowFileTree(true);
    setSourceTab('html');
    fileHandlesRef.current = newHandles;

    const htmlFiles = newFiles.filter(f => f.type === 'html');
    const firstHtml = htmlFiles.find(f => f.name === 'index.html') || htmlFiles[0];
    if (firstHtml) {
      loadProjectHtml(firstHtml.path, firstHtml.content, newCssContents, newBlobUrls);
    }
  }, []);

  const loadProjectHtml = useCallback((htmlPath: string, rawHtml: string, css: Record<string, string>, blobs: Record<string, string>) => {
    setActiveHtmlPath(htmlPath);
    activeHtmlPathRef.current = htmlPath;
    setFileName(htmlPath);
    setHistory([]); setHistoryIdx(-1);
    setSourceCode(rawHtml);
    const processed = processHtmlForEditor(rawHtml, htmlPath, css, blobs);
    loadProcessedHtml(processed, true);
  }, [loadProcessedHtml]);

  // Switch to a different HTML file in the project
  const switchHtmlFile = useCallback((htmlPath: string) => {
    const file = projectFilesRef.current.find(f => f.path === htmlPath);
    if (!file) return;
    loadProjectHtml(htmlPath, file.content, cssContentsRef.current, blobUrlsRef.current);
  }, [loadProjectHtml]);

  // --- Save (overwrite original files if we have handles, else download) ---
  const saveAll = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const handles = fileHandlesRef.current;
    const hasHandles = Object.keys(handles).length > 0;
    const htmlPath = activeHtmlPathRef.current;
    const html = serializeDocument(doc);
    let savedCount = 0;

    try {
      // Save HTML
      if (hasHandles && handles[htmlPath]) {
        const writable = await handles[htmlPath].createWritable();
        await writable.write(html);
        await writable.close();
        savedCount++;
      } else {
        downloadFile(html, htmlPath?.split('/').pop() || fileName || 'index.html', 'text/html');
        savedCount++;
      }

      // Save each CSS file
      for (const cssPath of Object.keys(cssContentsRef.current)) {
        const content = cssContentsRef.current[cssPath];
        if (hasHandles && handles[cssPath]) {
          const writable = await handles[cssPath].createWritable();
          await writable.write(content);
          await writable.close();
          savedCount++;
        } else {
          downloadFile(content, cssPath.split('/').pop() || 'style.css', 'text/css');
          savedCount++;
        }
      }

      if (hasHandles) {
        setSaveStatus(`Saved ${savedCount} file${savedCount > 1 ? 's' : ''}`);
      } else {
        setSaveStatus(`Downloaded ${savedCount} file${savedCount > 1 ? 's' : ''}`);
      }
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err: any) {
      setSaveStatus(`Error: ${err.message || 'save failed'}`);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  }, [fileName]);

  // --- Element operations ---
  const duplicateSelected = useCallback(() => {
    const multi = multiSelectedRef.current;
    if (multi.size === 0) return;
    // Sort by DOM order
    const sorted = (Array.from(multi) as HTMLElement[]).sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    const clones: HTMLElement[] = [];
    for (const el of sorted) {
      if (!el.parentElement) continue;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-editor-selected');
      clone.classList.remove('__editor_selected__');
      if (clone.id) clone.id = clone.id + '-copy';
      el.parentElement.insertBefore(clone, el.nextSibling);
      clones.push(clone);
    }
    pushHistory();
    // Select the clones
    selectElement(null);
    for (const clone of clones) selectElement(clone, true);
  }, [pushHistory, selectElement]);

  const deleteSelected = useCallback(() => {
    const multi = multiSelectedRef.current;
    if (multi.size === 0) return;
    const elements: HTMLElement[] = Array.from(multi);
    let nextFocus: Element | null = null;
    for (const el of elements) {
      if (!el.parentElement) continue;
      if (!nextFocus) nextFocus = el.nextElementSibling || el.previousElementSibling;
      el.parentElement.removeChild(el);
    }
    multi.clear();
    setSelectionCount(0);
    pushHistory();
    if (nextFocus && nextFocus.isConnected && isEditable(nextFocus as HTMLElement)) selectElement(nextFocus as HTMLElement);
    else selectElement(null);
  }, [pushHistory, selectElement]);

  const moveSelected = useCallback((direction: 'up' | 'down') => {
    const multi = multiSelectedRef.current;
    if (multi.size === 0) return;
    // Sort by DOM order
    const sorted = (Array.from(multi) as HTMLElement[]).sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    let moved = false;
    if (direction === 'up') {
      for (const el of sorted) {
        if (!el.parentElement) continue;
        const prev = el.previousElementSibling;
        if (prev && !multi.has(prev as HTMLElement)) {
          el.parentElement.insertBefore(el, prev);
          moved = true;
        }
      }
    } else {
      // Reverse order for moving down
      for (const el of sorted.reverse()) {
        if (!el.parentElement) continue;
        const next = el.nextElementSibling;
        if (next && !multi.has(next as HTMLElement)) {
          el.parentElement.insertBefore(el, next.nextSibling);
          moved = true;
        }
      }
    }
    if (moved) { pushHistory(); refreshSelectedInfo(); }
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
    clearTimeout((updateStyleAndSave as any)._timer);
    (updateStyleAndSave as any)._timer = setTimeout(() => pushHistory(), 500);
  }, [updateStyle, pushHistory]);

  const updateClass = useCallback((className: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    const editorClasses = (el.className.toString() || '').split(' ').filter(c => c.startsWith('__editor_'));
    const userClasses = className.split(' ').filter(c => c.trim());
    el.className = [...userClasses, ...editorClasses].join(' ');
    refreshSelectedInfo(); pushHistory();
  }, [refreshSelectedInfo, pushHistory]);

  const updateId = useCallback((id: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    el.id = id; refreshSelectedInfo(); pushHistory();
  }, [refreshSelectedInfo, pushHistory]);

  const updateText = useCallback((text: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    el.textContent = text; refreshSelectedInfo();
    clearTimeout((updateText as any)._timer);
    (updateText as any)._timer = setTimeout(() => pushHistory(), 500);
  }, [refreshSelectedInfo, pushHistory]);

  const editInnerHTML = useCallback((html: string) => {
    const el = selectedElRef.current;
    if (!el) return;
    el.innerHTML = html; pushHistory(); refreshSelectedInfo();
  }, [pushHistory, refreshSelectedInfo]);

  // --- Tag change (for typography role switching) ---
  const changeTag = useCallback((newTag: string) => {
    const el = selectedElRef.current;
    if (!el || !el.parentElement) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    if (el.tagName.toLowerCase() === newTag.toLowerCase()) return;
    const newEl = doc.createElement(newTag);
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      newEl.setAttribute(attr.name, attr.value);
    }
    while (el.firstChild) newEl.appendChild(el.firstChild);
    el.parentElement.replaceChild(newEl, el);
    // Update multi-select set
    const multi = multiSelectedRef.current;
    if (multi.has(el)) { multi.delete(el); multi.add(newEl); }
    pushHistory();
    selectElement(newEl);
  }, [pushHistory, selectElement]);

  // --- Clear all styles from selected element(s) ---
  const clearElementStyles = useCallback(() => {
    const multi = multiSelectedRef.current;
    if (multi.size === 0) return;
    const elements: HTMLElement[] = Array.from(multi);
    for (const el of elements) {
      el.removeAttribute('style');
    }
    pushHistory();
    refreshSelectedInfo();
  }, [pushHistory, refreshSelectedInfo]);

  // --- Enable grid on parent ---
  const enableGridOnParent = useCallback(() => {
    const el = selectedElRef.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    parent.style.display = 'grid';
    parent.style.gridTemplateColumns = 'repeat(4, 1fr)';
    parent.style.gap = '16px';
    pushHistory();
    refreshSelectedInfo();
  }, [pushHistory, refreshSelectedInfo]);

  // --- Source code sync ---
  const syncSourceFromIframe = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    setSourceCode(serializeDocument(doc));
    // Also extract current CSS from iframe
    const newCss: Record<string, string> = {};
    doc.querySelectorAll('style[data-editor-resolved-path]').forEach(style => {
      const resolvedPath = style.getAttribute('data-editor-resolved-path')!;
      // We need the clean CSS (without blob URLs). Reverse blob URLs back to relative paths.
      let cssText = style.textContent || '';
      // Reverse blob URLs: find blob URLs in the text and replace back
      Object.entries(blobUrlsRef.current).forEach(([path, blobUrl]) => {
        if (cssText.includes(blobUrl)) {
          // Figure out relative path from CSS file to the asset
          const cssDir = resolvedPath.includes('/') ? resolvedPath.substring(0, resolvedPath.lastIndexOf('/')) : '';
          const relPath = makeRelativePath(cssDir, path);
          cssText = cssText.split(blobUrl).join(relPath);
        }
      });
      newCss[resolvedPath] = cssText;
    });
    if (Object.keys(newCss).length > 0) {
      setCssContents(newCss);
      cssContentsRef.current = newCss;
    }
  }, []);

  const applySourceToIframe = useCallback((html: string) => {
    setSourceCode(html);
    const processed = processHtmlForEditor(html, activeHtmlPathRef.current, cssContentsRef.current, blobUrlsRef.current);
    loadProcessedHtml(processed, true);
  }, [loadProcessedHtml]);

  // --- CSS editing in source panel ---
  const updateCssInIframe = useCallback((cssPath: string, newContent: string) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const styleEl = doc.querySelector(`style[data-editor-resolved-path="${cssPath}"]`);
    if (styleEl) {
      styleEl.textContent = processCssUrls(newContent, cssPath, blobUrlsRef.current);
    }
    setCssContents(prev => ({ ...prev, [cssPath]: newContent }));
    cssContentsRef.current[cssPath] = newContent;
  }, []);

  const toggleSource = useCallback(() => {
    if (!showSource) syncSourceFromIframe();
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
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

      // Always intercept open/save regardless of focus
      if (ctrl && e.key === 'o') { e.preventDefault(); openFolder(); return; }
      if (ctrl && e.key === 's') { e.preventDefault(); saveAll(); return; }

      // Don't intercept undo/redo/delete when user is typing in an input or textarea
      if (isTyping) return;

      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (ctrl && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (ctrl && e.key === 'y') { e.preventDefault(); redo(); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (e.key === 'Delete' && !e.ctrlKey && !e.shiftKey && selectedElRef.current) { e.preventDefault(); deleteSelected(); }
      else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); moveSelected('up'); }
      else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); moveSelected('down'); }
      else if (e.key === 'Escape') selectElement(null);
      else if (ctrl && e.key === 'a') {
        // Select all editable elements in iframe body
        e.preventDefault();
        const doc = iframeRef.current?.contentDocument;
        if (doc) {
          selectElement(null);
          const all = doc.body.querySelectorAll('*');
          all.forEach(el => {
            if (isEditable(el as HTMLElement) && (el as HTMLElement).offsetParent !== null) {
              selectElement(el as HTMLElement, true);
            }
          });
        }
      }
    };
    window.addEventListener('keydown', handler);
    const t = setTimeout(() => {
      const doc = iframeRef.current?.contentDocument;
      if (doc) doc.addEventListener('keydown', handler);
    }, 500);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(t);
      try { iframeRef.current?.contentDocument?.removeEventListener('keydown', handler); } catch {}
    };
  }, [openFolder, saveAll, undo, redo, duplicateSelected, deleteSelected, moveSelected, selectElement]);

  // --- CSS tab paths for source panel ---
  const cssPaths = Object.keys(cssContents);

  // --- Render ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#13162b', color: '#c8cdd8', fontFamily: 'Inter, sans-serif' }}>
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept=".html,.htm" style={{ display: 'none' }} onChange={handleFileChange} />
      <input ref={folderInputRef} type="file" style={{ display: 'none' }} onChange={handleFolderChange}
        {...{ webkitdirectory: '', directory: '', multiple: true } as any}
      />

      {/* Toolbar */}
      <Toolbar
        isFileLoaded={isLoaded}
        hasSelection={!!selectedInfo}
        canUndo={historyIdx > 0}
        canRedo={historyIdx < history.length - 1}
        showSource={showSource}
        showFileTree={showFileTree}
        zoom={zoom}
        onOpenFolder={openFolder}
        onOpenFile={openFile}
        onSaveAll={saveAll}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onMoveUp={() => moveSelected('up')}
        onMoveDown={() => moveSelected('down')}
        onToggleSource={toggleSource}
        onToggleFileTree={() => setShowFileTree(v => !v)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        fileName={fileName}
        hasProject={projectFiles.length > 0}
        viewportMode={viewportMode}
        onViewportChange={setViewportMode}
      />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* File tree */}
        {showFileTree && projectFiles.length > 0 && (
          <FileTreePanel
            files={projectFiles}
            activeHtmlPath={activeHtmlPath}
            onSelectHtml={switchHtmlFile}
            onClose={() => setShowFileTree(false)}
          />
        )}

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'auto', background: isLoaded ? '#e5e7eb' : '#13162b', display: 'flex', flexDirection: 'column', alignItems: viewportMode !== 'desktop' ? 'center' : 'stretch' }}>
          {isLoaded && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
              backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              opacity: 0.3, pointerEvents: 'none', zIndex: 0,
            }} />
          )}
          {/* Viewport frame */}
          {isLoaded && viewportMode !== 'desktop' && (
            <div style={{
              textAlign: 'center', padding: '8px 0 4px', fontSize: '11px', color: '#6b7280',
              fontFamily: 'JetBrains Mono, monospace', position: 'relative', zIndex: 2,
            }}>
              {viewportMode === 'tablet' ? '768 × 1024' : '375 × 812'}
            </div>
          )}
          <div style={{
            width: viewportMode === 'desktop' ? '100%' : viewportMode === 'tablet' ? '768px' : '375px',
            maxWidth: '100%',
            flex: viewportMode === 'desktop' ? 1 : undefined,
            height: viewportMode === 'desktop' ? '100%' : viewportMode === 'tablet' ? '1024px' : '812px',
            position: 'relative',
            boxShadow: viewportMode !== 'desktop' ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
            borderRadius: viewportMode !== 'desktop' ? '8px' : '0',
            overflow: 'hidden',
            background: '#fff',
            zIndex: 1,
            margin: viewportMode !== 'desktop' ? '0 auto 16px' : '0',
          }}>
            <iframe
              ref={iframeRef}
              style={{
                width: `${10000 / zoom}%`, height: `${10000 / zoom}%`,
                border: 'none', transform: `scale(${zoom / 100})`, transformOrigin: 'top left',
                position: 'relative', background: '#fff',
                display: isLoaded ? 'block' : 'none',
              }}
              sandbox="allow-same-origin allow-scripts"
              title="Editor Canvas"
            />
          </div>
          {!isLoaded && <WelcomeScreen onOpenFolder={openFolder} onOpenFile={openFile} />}

          {/* Drag hint overlay */}
          {isDragging && (
            <div style={{
              position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
              background: '#1b1f36', color: '#e0e4eb', padding: '6px 16px', borderRadius: '20px',
              fontSize: '12px', fontWeight: 500, zIndex: 100, pointerEvents: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)', border: '1px solid #3a3f5c',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              {selectionCount > 1 && (
                <span style={{ background: '#3b82f6', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 600 }}>
                  {selectionCount}
                </span>
              )}
              Drag to move &bull; Hold Shift for free-move
            </div>
          )}

          {/* Selection count indicator */}
          {!isDragging && selectionCount > 1 && isLoaded && (
            <div style={{
              position: 'absolute', top: '8px', right: '8px',
              background: '#3b82f6', color: '#fff', padding: '4px 12px', borderRadius: '12px',
              fontSize: '11px', fontWeight: 600, zIndex: 100, pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {selectionCount} selected &bull; Ctrl+Click to add/remove
            </div>
          )}

          {/* Save status */}
          {saveStatus && (
            <div style={{
              position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
              background: saveStatus.startsWith('Error') ? '#ef4444' : '#22c55e',
              color: '#fff', padding: '8px 20px', borderRadius: '20px',
              fontSize: '13px', fontWeight: 500, zIndex: 100, pointerEvents: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}>
              {saveStatus}
            </div>
          )}
        </div>

        {/* Properties panel */}
        {selectedInfo && isLoaded && (
          <PropertiesPanel
            selectedInfo={selectedInfo}
            onStyleChange={updateStyleAndSave}
            onClassChange={updateClass}
            onIdChange={updateId}
            onTextChange={updateText}
            onEditInnerHTML={editInnerHTML}
            onTagChange={changeTag}
            onEnableGrid={enableGridOnParent}
            onClearStyles={clearElementStyles}
            selectionCount={selectionCount}
          />
        )}
      </div>

      {/* Source panel with tabs */}
      {showSource && isLoaded && (
        <div style={{ height: '260px', minHeight: '100px', background: '#0d1117', borderTop: '1px solid #2a2f4a', display: 'flex', flexDirection: 'column' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#161b22', borderBottom: '1px solid #21262d', minHeight: '32px' }}>
            {/* HTML tab */}
            <SourceTab
              label={activeHtmlPath ? activeHtmlPath.split('/').pop()! : 'HTML'}
              active={sourceTab === 'html'}
              color="#ef4444"
              onClick={() => { setSourceTab('html'); syncSourceFromIframe(); }}
            />
            {/* CSS tabs */}
            {cssPaths.map(p => (
              <SourceTab
                key={p}
                label={p.split('/').pop()!}
                active={sourceTab === p}
                color="#3b82f6"
                onClick={() => setSourceTab(p)}
              />
            ))}

            <div style={{ flex: 1 }} />

            {sourceTab === 'html' && (
              <div style={{ display: 'flex', gap: '6px', padding: '0 8px' }}>
                <button onClick={syncSourceFromIframe} style={srcBtnStyle}> Refresh </button>
                <button onClick={() => applySourceToIframe(sourceCode)} style={{ ...srcBtnStyle, background: '#238636', borderColor: '#2ea043', color: '#fff' }}> Apply </button>
              </div>
            )}
            {sourceTab !== 'html' && (
              <div style={{ display: 'flex', gap: '6px', padding: '0 8px' }}>
                <button onClick={() => downloadFile(cssContents[sourceTab] || '', sourceTab.split('/').pop()!, 'text/css')} style={srcBtnStyle}> Save CSS </button>
              </div>
            )}
          </div>

          {/* Editor area */}
          {sourceTab === 'html' ? (
            <textarea
              value={sourceCode}
              onChange={e => setSourceCode(e.target.value)}
              spellCheck={false}
              style={srcTextareaStyle}
            />
          ) : (
            <textarea
              value={cssContents[sourceTab] || ''}
              onChange={e => updateCssInIframe(sourceTab, e.target.value)}
              spellCheck={false}
              style={srcTextareaStyle}
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- Helper components ---

function SourceTab({ label, active, color, onClick, ...rest }: { label: string; active: boolean; color: string; onClick: () => void; [key: string]: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
        background: active ? '#0d1117' : 'transparent',
        color: active ? '#e0e4eb' : '#8b949e',
        border: 'none',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'color 0.1s',
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </button>
  );
}

function makeRelativePath(fromDir: string, toPath: string): string {
  if (!fromDir) return toPath;
  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = toPath.split('/').filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }
  const ups = fromParts.length - common;
  const remaining = toParts.slice(common);
  return (ups > 0 ? '../'.repeat(ups) : './') + remaining.join('/');
}

const srcBtnStyle: React.CSSProperties = {
  fontSize: '11px', background: '#21262d', border: '1px solid #30363d',
  borderRadius: '4px', color: '#c9d1d9', padding: '2px 8px', cursor: 'pointer',
};

const srcTextareaStyle: React.CSSProperties = {
  flex: 1, background: '#0d1117', color: '#c9d1d9', border: 'none', outline: 'none',
  padding: '12px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
  lineHeight: '1.5', resize: 'none', tabSize: 2,
};

export default App;
