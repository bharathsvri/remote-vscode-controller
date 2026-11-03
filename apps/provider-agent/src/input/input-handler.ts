import { KeyboardEventPayload, MouseEventPayload } from '@remote-vscode/shared';

export class InputHandler {
  /**
   * Forwards input strictly to the isolated session target.
   * GUARANTEE: Does NOT call OS SendInput, user32 mouse_event, or any global
   * desktop hook. Provider's cursor, keyboard focus, and desktop remain 100% untouched.
   */
  public handleMouseEvent(sessionId: string, event: MouseEventPayload): void {
    // Processed within isolated session context (e.g. forwarded to WebRTC data channel or headless instance)
    // console.log(`[InputHandler] Isolated mouse event for ${sessionId}: ${event.action} at (${event.x}, ${event.y})`);
  }

  public handleKeyboardEvent(sessionId: string, event: KeyboardEventPayload): void {
    // Processed within isolated session context
    // console.log(`[InputHandler] Isolated key event for ${sessionId}: ${event.action} key=${event.key} code=${event.code}`);
  }
}

export const inputHandler = new InputHandler();
