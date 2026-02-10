import React, { useState, useEffect, useRef } from 'react';
import { SelectedElementInfo, ElementStyles } from '../types';
import {
  SPACING_TOKENS, matchSpacingToken, getTokenPx,
  TYPOGRAPHY_ROLES, getTypographyRole,
  GRID_DESKTOP_COLS, getGridNotation, parseGridColumn,
} from '../designSystem';

interface PropertiesPanelProps {
  selectedInfo: SelectedElementInfo;
  onStyleChange: (prop: keyof ElementStyles, value: string) => void;
  onClassChange: (className: string) => void;
  onIdChange: (id: string) => void;
  onTextChange: (text: string) => void;
  onEditInnerHTML: (html: string) => void;
  onTagChange: (newTag: string) => void;
  onEnableGrid: () => void;
}

// ===== Styles =====

const sectionTitle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.8px', color: '#6b7280', marginBottom: '8px', marginTop: '16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', background: '#252a40',
  border: '1px solid #3a3f5c', borderRadius: '4px', color: '#c8cdd8',
  fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: '#8890a4', marginBottom: '2px', display: 'block',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', appearance: 'auto' as any,
};

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 8px', fontSize: '10px', fontWeight: active ? 700 : 500,
  fontFamily: 'JetBrains Mono, monospace',
  background: active ? '#3b82f6' : '#252a40',
  color: active ? '#fff' : '#8890a4',
  border: `1px solid ${active ? '#3b82f6' : '#3a3f5c'}`,
  borderRadius: '4px', cursor: 'pointer',
  transition: 'all 0.12s',
});

const gridBoxStyle = (filled: boolean): React.CSSProperties => ({
  flex: 1, height: '28px', borderRadius: '4px',
  background: filled ? '#3b82f6' : '#252a40',
  border: `1px solid ${filled ? '#60a5fa' : '#3a3f5c'}`,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '10px', color: filled ? '#fff' : '#6b7280',
  transition: 'all 0.15s',
  fontFamily: 'JetBrains Mono, monospace',
});

// ===== Deferred Input =====

function DeferredInput({ value, onCommit, style, arrowStep, placeholder }: {
  value: string; onCommit: (val: string) => void;
  style?: React.CSSProperties; arrowStep?: boolean; placeholder?: string;
}) {
  const [localVal, setLocalVal] = useState(value);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!focused) setLocalVal(value); }, [value, focused]);
  const commit = () => { if (localVal !== value) onCommit(localVal); };
  return (
    <input
      ref={inputRef} style={style || inputStyle}
      value={focused ? localVal : value} placeholder={placeholder}
      onChange={e => setLocalVal(e.target.value)}
      onFocus={() => { setFocused(true); setLocalVal(value); }}
      onBlur={() => { commit(); setFocused(false); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { commit(); inputRef.current?.blur(); }
        if (arrowStep && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          const src = focused ? localVal : value;
          const current = parseFloat(src) || 0;
          const delta = e.key === 'ArrowUp' ? 1 : -1;
          const unit = src.replace(/[\d.\-+]/g, '') || 'px';
          const next = `${current + delta}${unit}`;
          setLocalVal(next); onCommit(next);
        }
      }}
    />
  );
}

function DeferredTextarea({ value, onCommit, style, placeholder }: {
  value: string; onCommit: (val: string) => void;
  style?: React.CSSProperties; placeholder?: string;
}) {
  const [localVal, setLocalVal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocalVal(value); }, [value, focused]);
  return (
    <textarea
      style={style} value={focused ? localVal : value} placeholder={placeholder}
      onChange={e => setLocalVal(e.target.value)}
      onFocus={() => { setFocused(true); setLocalVal(value); }}
      onBlur={() => { if (localVal !== value) onCommit(localVal); setFocused(false); }}
    />
  );
}

// ===== Token Spacing Selector =====

function TokenSpacingRow({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void;
}) {
  const matched = matchSpacingToken(value);
  const px = Math.round(parseFloat(value) || 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
      <span style={{ width: '14px', fontSize: '10px', color: '#6b7280', textAlign: 'center', fontWeight: 600 }}>{label}</span>
      <select
        style={{ ...selectStyle, flex: 1, fontSize: '11px', padding: '4px 6px' }}
        value={matched}
        onChange={e => { if (e.target.value !== 'custom') onChange(getTokenPx(e.target.value)); }}
      >
        {SPACING_TOKENS.map(t => (
          <option key={t.name} value={t.name}>
            {t.label}{t.px > 0 ? ` (${t.px}px)` : ''} — {t.usage}
          </option>
        ))}
        {matched === 'custom' && (
          <option value="custom">~ {px}px (custom)</option>
        )}
      </select>
    </div>
  );
}

// ===== Typography Role Picker =====

function TypographyRolePicker({ currentTag, onChange }: {
  currentTag: string; onChange: (tag: string) => void;
}) {
  const role = getTypographyRole(currentTag);
  return (
    <div>
      <div style={sectionTitle}>Typography Role</div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
        {TYPOGRAPHY_ROLES.map(r => (
          <button
            key={r.tag}
            onClick={() => onChange(r.tag)}
            style={pillBtn(currentTag.toLowerCase() === r.tag)}
            title={r.description}
          >
            {r.label}
          </button>
        ))}
      </div>
      {role ? (
        <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
          {role.description}
        </div>
      ) : (
        <div style={{ fontSize: '10px', color: '#f59e0b' }}>
          Tag &lt;{currentTag}&gt; is not a DS typography role
        </div>
      )}
    </div>
  );
}

// ===== Grid Column Picker =====

function GridColumnPicker({ styles, isInGrid, onStyleChange, onEnableGrid }: {
  styles: ElementStyles; isInGrid: boolean;
  onStyleChange: (prop: keyof ElementStyles, value: string) => void;
  onEnableGrid: () => void;
}) {
  const { start, span } = parseGridColumn(styles.gridColumnStart, styles.gridColumnEnd);
  const maxCols = GRID_DESKTOP_COLS;

  const setGrid = (newStart: number, newSpan: number) => {
    const s = Math.max(1, Math.min(newStart, maxCols));
    const sp = Math.max(1, Math.min(newSpan, maxCols - s + 1));
    onStyleChange('gridColumnStart', String(s));
    onStyleChange('gridColumnEnd', String(s + sp));
  };

  return (
    <div>
      <div style={sectionTitle}>Grid Column (4-col system)</div>
      {!isInGrid && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: '#f59e0b', marginBottom: '6px' }}>
            Parent is not a grid container
          </div>
          <button
            onClick={onEnableGrid}
            style={{
              width: '100%', padding: '6px', fontSize: '11px', fontWeight: 600,
              background: '#1a3a2a', border: '1px solid #22c55e', borderRadius: '4px',
              color: '#22c55e', cursor: 'pointer',
            }}
          >
            Enable 4-Column Grid on Parent
          </button>
        </div>
      )}
      {/* Visual column boxes */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
        {Array.from({ length: maxCols }, (_, i) => i + 1).map(col => {
          const filled = isInGrid && col >= start && col < start + span;
          return (
            <div
              key={col}
              onClick={() => {
                if (col >= start + span) {
                  // Extend span to include this column
                  setGrid(start, col - start + 1);
                } else if (col < start) {
                  // New start
                  setGrid(col, 1);
                } else if (col === start && span > 1) {
                  // Shrink from left
                  setGrid(start + 1, span - 1);
                } else if (col === start + span - 1 && span > 1) {
                  // Shrink from right
                  setGrid(start, span - 1);
                }
              }}
              style={gridBoxStyle(filled)}
            >
              {col}
            </div>
          );
        })}
      </div>
      {/* Dropdowns */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Start</label>
          <select style={selectStyle} value={start} onChange={e => setGrid(Number(e.target.value), span)}>
            {Array.from({ length: maxCols }, (_, i) => i + 1).map(c => (
              <option key={c} value={c}>Col {c}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Span</label>
          <select style={selectStyle} value={span} onChange={e => setGrid(start, Number(e.target.value))}>
            {Array.from({ length: maxCols - start + 1 }, (_, i) => i + 1).map(s => (
              <option key={s} value={s}>{s} col{s > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Notation */}
      <div style={{
        fontSize: '10px', color: '#8890a4', fontFamily: 'JetBrains Mono, monospace',
        background: '#252a40', padding: '4px 8px', borderRadius: '4px', textAlign: 'center',
      }}>
        {getGridNotation(start, span, maxCols)}
        {span === maxCols && ' (full width)'}
      </div>
    </div>
  );
}

// ===== Main Panel =====

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { selectedInfo, onStyleChange, onClassChange, onIdChange, onTextChange, onEditInnerHTML, onTagChange, onEnableGrid } = props;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingHtml, setEditingHtml] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');

  const s = selectedInfo.styles;

  return (
    <div style={{
      width: '288px', minWidth: '288px', background: '#1b1f36',
      borderLeft: '1px solid #2a2f4a', overflowY: 'auto', padding: '12px', fontSize: '12px',
    }}>
      {/* === Element Info === */}
      <div style={{ background: '#252a40', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{
            background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '3px',
            fontSize: '11px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
          }}>
            {selectedInfo.tagName}
          </span>
          {selectedInfo.id && (
            <span style={{ color: '#f59e0b', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              #{selectedInfo.id}
            </span>
          )}
          {selectedInfo.isInGrid && (
            <span style={{ color: '#22c55e', fontSize: '9px', fontWeight: 600, letterSpacing: '0.5px' }}>GRID</span>
          )}
        </div>
        <div style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>ID</label>
          <DeferredInput value={selectedInfo.id} onCommit={onIdChange} style={inputStyle} placeholder="element-id" />
        </div>
        <div>
          <label style={labelStyle}>Class</label>
          <DeferredInput value={selectedInfo.className} onCommit={onClassChange} style={inputStyle} placeholder="class names" />
        </div>
      </div>

      {/* === Text Content (leaf elements) === */}
      {!selectedInfo.hasChildren && (
        <div>
          <div style={sectionTitle}>Text Content</div>
          <DeferredTextarea
            value={selectedInfo.textContent}
            onCommit={onTextChange}
            style={{ ...inputStyle, minHeight: '50px', resize: 'vertical' } as React.CSSProperties}
          />
        </div>
      )}

      {/* === Typography Role === */}
      <TypographyRolePicker currentTag={selectedInfo.tagName} onChange={onTagChange} />

      {/* === Grid Column === */}
      <GridColumnPicker
        styles={s}
        isInGrid={selectedInfo.isInGrid}
        onStyleChange={onStyleChange}
        onEnableGrid={onEnableGrid}
      />

      {/* === Margin (Token-based) === */}
      <div style={sectionTitle}>Margin</div>
      <TokenSpacingRow label="T" value={s.marginTop} onChange={v => onStyleChange('marginTop', v)} />
      <TokenSpacingRow label="R" value={s.marginRight} onChange={v => onStyleChange('marginRight', v)} />
      <TokenSpacingRow label="B" value={s.marginBottom} onChange={v => onStyleChange('marginBottom', v)} />
      <TokenSpacingRow label="L" value={s.marginLeft} onChange={v => onStyleChange('marginLeft', v)} />

      {/* === Padding (Token-based) === */}
      <div style={sectionTitle}>Padding</div>
      <TokenSpacingRow label="T" value={s.paddingTop} onChange={v => onStyleChange('paddingTop', v)} />
      <TokenSpacingRow label="R" value={s.paddingRight} onChange={v => onStyleChange('paddingRight', v)} />
      <TokenSpacingRow label="B" value={s.paddingBottom} onChange={v => onStyleChange('paddingBottom', v)} />
      <TokenSpacingRow label="L" value={s.paddingLeft} onChange={v => onStyleChange('paddingLeft', v)} />

      {/* === Colors === */}
      <div style={sectionTitle}>Colors</div>
      <div style={{ marginBottom: '6px' }}>
        <label style={labelStyle}>Background</label>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="color" value={toHexColor(s.backgroundColor)}
            onChange={e => onStyleChange('backgroundColor', e.target.value)}
            style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          />
          <DeferredInput value={s.backgroundColor} onCommit={v => onStyleChange('backgroundColor', v)} style={{ ...inputStyle, flex: 1 }} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Text Color</label>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="color" value={toHexColor(s.color)}
            onChange={e => onStyleChange('color', e.target.value)}
            style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          />
          <DeferredInput value={s.color} onCommit={v => onStyleChange('color', v)} style={{ ...inputStyle, flex: 1 }} />
        </div>
      </div>

      {/* === Appearance === */}
      <div style={sectionTitle}>Appearance</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Border Radius</label>
          <DeferredInput value={s.borderRadius} onCommit={v => onStyleChange('borderRadius', v)} style={inputStyle} arrowStep />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Opacity</label>
          <DeferredInput value={s.opacity} onCommit={v => onStyleChange('opacity', v)} style={inputStyle} />
        </div>
      </div>

      {/* === Advanced (Toggle) === */}
      <div
        style={{ ...sectionTitle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', userSelect: 'none' }}
        onClick={() => setShowAdvanced(v => !v)}
      >
        <span style={{ fontSize: '8px', transition: 'transform 0.15s', transform: showAdvanced ? 'rotate(90deg)' : 'none' }}>
          {'\u25B6'}
        </span>
        Advanced CSS
      </div>
      {showAdvanced && (
        <div style={{ background: '#252a40', borderRadius: '6px', padding: '10px' }}>
          {/* Size */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Width</label>
              <DeferredInput value={s.width} onCommit={v => onStyleChange('width', v)} style={inputStyle} arrowStep />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Height</label>
              <DeferredInput value={s.height} onCommit={v => onStyleChange('height', v)} style={inputStyle} arrowStep />
            </div>
          </div>
          {/* Typography */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Font Size</label>
              <DeferredInput value={s.fontSize} onCommit={v => onStyleChange('fontSize', v)} style={inputStyle} arrowStep />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Font Weight</label>
              <select style={selectStyle} value={s.fontWeight} onChange={e => onStyleChange('fontWeight', e.target.value)}>
                <option value="100">100</option><option value="200">200</option>
                <option value="300">300</option><option value="400">400 (normal)</option>
                <option value="500">500</option><option value="600">600</option>
                <option value="700">700 (bold)</option><option value="800">800</option>
                <option value="900">900</option>
              </select>
            </div>
          </div>
          {/* Layout */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Display</label>
              <select style={selectStyle} value={s.display} onChange={e => onStyleChange('display', e.target.value)}>
                <option value="block">block</option><option value="inline">inline</option>
                <option value="inline-block">inline-block</option><option value="flex">flex</option>
                <option value="inline-flex">inline-flex</option><option value="grid">grid</option>
                <option value="none">none</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Position</label>
              <select style={selectStyle} value={s.position} onChange={e => onStyleChange('position', e.target.value)}>
                <option value="static">static</option><option value="relative">relative</option>
                <option value="absolute">absolute</option><option value="fixed">fixed</option>
                <option value="sticky">sticky</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Text Align</label>
            <select style={selectStyle} value={s.textAlign} onChange={e => onStyleChange('textAlign', e.target.value)}>
              <option value="left">left</option><option value="center">center</option>
              <option value="right">right</option><option value="justify">justify</option>
            </select>
          </div>
        </div>
      )}

      {/* === Inner HTML Edit === */}
      <div>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Inner HTML</span>
          {!editingHtml ? (
            <button
              onClick={() => { setEditingHtml(true); setHtmlDraft(selectedInfo.innerHTML); }}
              style={{ fontSize: '10px', background: '#252a40', border: '1px solid #3a3f5c', borderRadius: '3px', color: '#8890a4', padding: '2px 6px', cursor: 'pointer' }}
            >Edit</button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => { onEditInnerHTML(htmlDraft); setEditingHtml(false); }}
                style={{ fontSize: '10px', background: '#22c55e', border: 'none', borderRadius: '3px', color: '#fff', padding: '2px 6px', cursor: 'pointer' }}
              >Apply</button>
              <button
                onClick={() => setEditingHtml(false)}
                style={{ fontSize: '10px', background: '#ef4444', border: 'none', borderRadius: '3px', color: '#fff', padding: '2px 6px', cursor: 'pointer' }}
              >Cancel</button>
            </div>
          )}
        </div>
        {editingHtml && (
          <textarea
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' } as React.CSSProperties}
            value={htmlDraft}
            onChange={e => setHtmlDraft(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

// ===== Helpers =====

function toHexColor(color: string): string {
  if (color.startsWith('#')) return color;
  if (color.startsWith('rgb')) {
    const match = color.match(/(\d+)/g);
    if (match && match.length >= 3) {
      const [r, g, b] = match.map(Number);
      return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    }
  }
  return '#000000';
}
