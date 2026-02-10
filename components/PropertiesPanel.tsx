import React, { useState, useEffect, useRef } from 'react';
import { SelectedElementInfo, ElementStyles } from '../types';

interface PropertiesPanelProps {
  selectedInfo: SelectedElementInfo;
  onStyleChange: (prop: keyof ElementStyles, value: string) => void;
  onClassChange: (className: string) => void;
  onIdChange: (id: string) => void;
  onTextChange: (text: string) => void;
  onEditInnerHTML: (html: string) => void;
}

const sectionTitle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  color: '#6b7280',
  marginBottom: '8px',
  marginTop: '16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: '#252a40',
  border: '1px solid #3a3f5c',
  borderRadius: '4px',
  color: '#c8cdd8',
  fontSize: '12px',
  fontFamily: 'JetBrains Mono, monospace',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#8890a4',
  marginBottom: '2px',
  display: 'block',
};

const spacingLabels: Record<string, string> = {
  marginTop: 'T',
  marginRight: 'R',
  marginBottom: 'B',
  marginLeft: 'L',
  paddingTop: 'T',
  paddingRight: 'R',
  paddingBottom: 'B',
  paddingLeft: 'L',
};

// === DeferredInput ===
// Holds local state while focused. Commits only on blur or Enter.
// This lets the user type intermediate values like "0.", "10p", etc.

function DeferredInput({ value, onCommit, style, arrowStep, placeholder }: {
  value: string;
  onCommit: (val: string) => void;
  style?: React.CSSProperties;
  arrowStep?: boolean;
  placeholder?: string;
}) {
  const [localVal, setLocalVal] = useState(value);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from prop when not focused
  useEffect(() => {
    if (!focused) setLocalVal(value);
  }, [value, focused]);

  const commit = () => {
    if (localVal !== value) {
      onCommit(localVal);
    }
  };

  return (
    <input
      ref={inputRef}
      style={style || inputStyle}
      value={focused ? localVal : value}
      placeholder={placeholder}
      onChange={e => setLocalVal(e.target.value)}
      onFocus={() => {
        setFocused(true);
        setLocalVal(value);
      }}
      onBlur={() => {
        commit();
        setFocused(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          commit();
          inputRef.current?.blur();
        }
        if (arrowStep && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          const src = focused ? localVal : value;
          const current = parseFloat(src) || 0;
          const delta = e.key === 'ArrowUp' ? 1 : -1;
          const unit = src.replace(/[\d.\-+]/g, '') || 'px';
          const next = `${current + delta}${unit}`;
          setLocalVal(next);
          onCommit(next);
        }
      }}
    />
  );
}

function DeferredTextarea({ value, onCommit, style, placeholder }: {
  value: string;
  onCommit: (val: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [localVal, setLocalVal] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setLocalVal(value);
  }, [value, focused]);

  return (
    <textarea
      style={style}
      value={focused ? localVal : value}
      placeholder={placeholder}
      onChange={e => setLocalVal(e.target.value)}
      onFocus={() => { setFocused(true); setLocalVal(value); }}
      onBlur={() => {
        if (localVal !== value) onCommit(localVal);
        setFocused(false);
      }}
    />
  );
}

// === SpacingGrid ===

function SpacingGrid({ title, prefix, styles, onChange }: {
  title: string;
  prefix: 'margin' | 'padding';
  styles: ElementStyles;
  onChange: (prop: keyof ElementStyles, value: string) => void;
}) {
  const keys = [`${prefix}Top`, `${prefix}Right`, `${prefix}Bottom`, `${prefix}Left`] as (keyof ElementStyles)[];

  return (
    <div>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        {keys.map(key => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#6b7280', width: '12px', textAlign: 'center' }}>
              {spacingLabels[key]}
            </span>
            <DeferredInput
              value={styles[key]}
              onCommit={val => onChange(key, val)}
              style={{ ...inputStyle, width: '100%' }}
              arrowStep
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// === PropertiesPanel ===

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { selectedInfo, onStyleChange, onClassChange, onIdChange, onTextChange, onEditInnerHTML } = props;
  const [editingHtml, setEditingHtml] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');

  return (
    <div style={{
      width: '272px',
      minWidth: '272px',
      background: '#1b1f36',
      borderLeft: '1px solid #2a2f4a',
      overflowY: 'auto',
      padding: '12px',
      fontSize: '12px',
    }}>
      {/* Element info */}
      <div style={{
        background: '#252a40',
        borderRadius: '6px',
        padding: '10px',
        marginBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{
            background: '#3b82f6',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {selectedInfo.tagName}
          </span>
          {selectedInfo.id && (
            <span style={{ color: '#f59e0b', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              #{selectedInfo.id}
            </span>
          )}
        </div>

        <div style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>ID</label>
          <DeferredInput
            value={selectedInfo.id}
            onCommit={onIdChange}
            style={inputStyle}
            placeholder="element-id"
          />
        </div>
        <div>
          <label style={labelStyle}>Class</label>
          <DeferredInput
            value={selectedInfo.className}
            onCommit={onClassChange}
            style={inputStyle}
            placeholder="class names"
          />
        </div>
      </div>

      {/* Text content (for leaf elements) */}
      {!selectedInfo.hasChildren && (
        <div>
          <div style={sectionTitle}>Text Content</div>
          <DeferredTextarea
            value={selectedInfo.textContent}
            onCommit={onTextChange}
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' } as React.CSSProperties}
          />
        </div>
      )}

      {/* Inner HTML edit */}
      <div>
        <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Inner HTML</span>
          {!editingHtml ? (
            <button
              onClick={() => { setEditingHtml(true); setHtmlDraft(selectedInfo.innerHTML); }}
              style={{
                fontSize: '10px', background: '#252a40', border: '1px solid #3a3f5c',
                borderRadius: '3px', color: '#8890a4', padding: '2px 6px', cursor: 'pointer',
              }}
            >
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => { onEditInnerHTML(htmlDraft); setEditingHtml(false); }}
                style={{
                  fontSize: '10px', background: '#22c55e', border: 'none',
                  borderRadius: '3px', color: '#fff', padding: '2px 6px', cursor: 'pointer',
                }}
              >
                Apply
              </button>
              <button
                onClick={() => setEditingHtml(false)}
                style={{
                  fontSize: '10px', background: '#ef4444', border: 'none',
                  borderRadius: '3px', color: '#fff', padding: '2px 6px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
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

      {/* Spacing */}
      <SpacingGrid title="Margin" prefix="margin" styles={selectedInfo.styles} onChange={onStyleChange} />
      <SpacingGrid title="Padding" prefix="padding" styles={selectedInfo.styles} onChange={onStyleChange} />

      {/* Size */}
      <div style={sectionTitle}>Size</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Width</label>
          <DeferredInput value={selectedInfo.styles.width} onCommit={v => onStyleChange('width', v)} style={inputStyle} arrowStep />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Height</label>
          <DeferredInput value={selectedInfo.styles.height} onCommit={v => onStyleChange('height', v)} style={inputStyle} arrowStep />
        </div>
      </div>

      {/* Typography */}
      <div style={sectionTitle}>Typography</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Font Size</label>
          <DeferredInput value={selectedInfo.styles.fontSize} onCommit={v => onStyleChange('fontSize', v)} style={inputStyle} arrowStep />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Font Weight</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={selectedInfo.styles.fontWeight}
            onChange={e => onStyleChange('fontWeight', e.target.value)}
          >
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="400">400 (normal)</option>
            <option value="500">500</option>
            <option value="600">600</option>
            <option value="700">700 (bold)</option>
            <option value="800">800</option>
            <option value="900">900</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Text Align</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={selectedInfo.styles.textAlign}
            onChange={e => onStyleChange('textAlign', e.target.value)}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
            <option value="justify">justify</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Opacity</label>
          <DeferredInput value={selectedInfo.styles.opacity} onCommit={v => onStyleChange('opacity', v)} style={inputStyle} />
        </div>
      </div>

      {/* Colors */}
      <div style={sectionTitle}>Colors</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Background</label>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="color"
              value={toHexColor(selectedInfo.styles.backgroundColor)}
              onChange={e => onStyleChange('backgroundColor', e.target.value)}
              style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <DeferredInput
              value={selectedInfo.styles.backgroundColor}
              onCommit={v => onStyleChange('backgroundColor', v)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Text Color</label>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="color"
              value={toHexColor(selectedInfo.styles.color)}
              onChange={e => onStyleChange('color', e.target.value)}
              style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <DeferredInput
              value={selectedInfo.styles.color}
              onCommit={v => onStyleChange('color', v)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      </div>

      {/* Layout */}
      <div style={sectionTitle}>Layout</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Display</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={selectedInfo.styles.display}
            onChange={e => onStyleChange('display', e.target.value)}
          >
            <option value="block">block</option>
            <option value="inline">inline</option>
            <option value="inline-block">inline-block</option>
            <option value="flex">flex</option>
            <option value="inline-flex">inline-flex</option>
            <option value="grid">grid</option>
            <option value="none">none</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Position</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={selectedInfo.styles.position}
            onChange={e => onStyleChange('position', e.target.value)}
          >
            <option value="static">static</option>
            <option value="relative">relative</option>
            <option value="absolute">absolute</option>
            <option value="fixed">fixed</option>
            <option value="sticky">sticky</option>
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Border Radius</label>
        <DeferredInput value={selectedInfo.styles.borderRadius} onCommit={v => onStyleChange('borderRadius', v)} style={inputStyle} arrowStep />
      </div>
    </div>
  );
}

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
