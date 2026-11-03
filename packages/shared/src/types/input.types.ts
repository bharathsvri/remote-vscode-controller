export type MouseAction = 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'wheel';
export type KeyboardAction = 'keydown' | 'keyup' | 'keypress';

export interface MouseEventPayload {
  action: MouseAction;
  x: number;
  y: number;
  button?: 'left' | 'middle' | 'right' | 0 | 1 | 2;
  deltaX?: number;
  deltaY?: number;
}

export interface KeyboardEventPayload {
  action: KeyboardAction;
  key: string;
  code: string;
  keyCode?: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface ClipboardPayload {
  text: string;
}
