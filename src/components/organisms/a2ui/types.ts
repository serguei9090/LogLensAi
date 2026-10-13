export interface A2UIComponent {
  type: string;
  text?: string;
  label?: string;
  children?: A2UIComponent[];
  props?: Record<string, unknown>;
  action?: {
    type: string;
    [key: string]: unknown;
  };
}

export interface A2UIRendererProps {
  payload: unknown;
  onAction?: (action: unknown) => void;
}
