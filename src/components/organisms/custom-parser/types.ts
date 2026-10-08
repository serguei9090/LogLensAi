export interface ParserMapping {
  start: number;
  end: number;
}

export interface ParserConfig {
  regex: string;
  mapping: {
    timestamp?: ParserMapping;
    level?: ParserMapping;
  };
}

export interface ActiveSelection {
  start: number;
  end: number;
  text: string;
  rect: DOMRect;
}

export interface CustomParserModalProps {
  readonly workspaceId: string;
  readonly sourceId: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved: (parserConfig: string) => void;
  readonly initialConfig?: string | null;
}
