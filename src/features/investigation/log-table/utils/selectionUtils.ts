export interface SelectionDetails {
  text: string;
  x: number;
  y: number;
  field: string;
  logText: string;
  sourceId: string;
}

export function findFieldAndSource(anchorNode: Node | null): {
  field: string;
  sourceId: string;
} {
  let field = "raw_text";
  let sourceId = "";
  let node = anchorNode;
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.field) {
        field = el.dataset.field;
      }
      if (el.dataset.sourceId) {
        sourceId = el.dataset.sourceId;
      }
      if (field !== "raw_text" && sourceId) {
        break;
      }
    }
    node = node.parentNode;
  }
  return { field, sourceId };
}

export function getSelectionDetails(selection: Selection): SelectionDetails | null {
  if (selection.isCollapsed) {
    return null;
  }
  const text = selection.toString().trim();
  if (!text) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const { field, sourceId } = findFieldAndSource(selection.anchorNode);
  const logText = selection.anchorNode?.parentElement?.innerText || "";

  return {
    text,
    x: rect.left + rect.width / 2,
    y: rect.bottom + globalThis.scrollY + 10,
    field,
    logText,
    sourceId,
  };
}
