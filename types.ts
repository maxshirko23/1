export interface ElementStyles {
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  width: string;
  height: string;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  display: string;
  position: string;
  textAlign: string;
  borderRadius: string;
  opacity: string;
}

export interface SelectedElementInfo {
  tagName: string;
  path: string;
  className: string;
  id: string;
  textContent: string;
  innerHTML: string;
  hasChildren: boolean;
  styles: ElementStyles;
}

export interface ProjectFile {
  name: string;
  path: string;
  type: 'html' | 'css' | 'js' | 'image' | 'font' | 'other';
  content: string;
  blobUrl?: string;
  file: File;
}

export type EditorTool = 'select' | 'move';

export const STYLE_KEYS: (keyof ElementStyles)[] = [
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'width', 'height', 'backgroundColor', 'color', 'fontSize',
  'fontWeight', 'display', 'position', 'textAlign', 'borderRadius', 'opacity',
];
