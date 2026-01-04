
export interface SectionProps {
  id: string;
  label: string;
  index: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
