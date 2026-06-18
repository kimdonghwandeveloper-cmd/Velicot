export const TOOL_IDS = {
  SELECT: 'select',
  FREEHAND: 'fhpath',
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  PATH_EDIT: 'pathedit',
  TEXT: 'text',
} as const;

export type ToolId = (typeof TOOL_IDS)[keyof typeof TOOL_IDS];

export interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
}

export const TOOLS: ToolDef[] = [
  { id: TOOL_IDS.SELECT, label: 'Select', shortcut: 'S' },
  { id: TOOL_IDS.FREEHAND, label: 'Pen', shortcut: 'P' },
  { id: TOOL_IDS.RECT, label: 'Rectangle', shortcut: 'R' },
  { id: TOOL_IDS.ELLIPSE, label: 'Ellipse', shortcut: 'E' },
  { id: TOOL_IDS.PATH_EDIT, label: 'Path Edit', shortcut: 'N' },
  { id: TOOL_IDS.TEXT, label: 'Text', shortcut: 'T' },
];
