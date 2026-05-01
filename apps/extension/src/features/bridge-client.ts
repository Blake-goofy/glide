import {
  createMessageId,
  glideProtocol,
  type GlideBridgeMessage,
  type UserActionProcedureName,
  type UserActionResponse,
} from '@blakebecker/glide-shared';

const requestTimeoutMs = 5000;

export function callBridgeUserAction(action: UserActionProcedureName, changeValue = 'INIT', internalId?: string): Promise<UserActionResponse> {
  const id = createMessageId('feature');

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener(glideProtocol.bridgeToContentEvent, handleMessage);
      reject(new Error(`${action} timed out`));
    }, requestTimeoutMs);

    function handleMessage(event: Event): void {
      const message = (event as CustomEvent<GlideBridgeMessage>).detail;

      if (!message || message.id !== id) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener(glideProtocol.bridgeToContentEvent, handleMessage);

      if (!message.ok) {
        reject(new Error(message.error));
        return;
      }

      resolve(message.payload);
    }

    window.addEventListener(glideProtocol.bridgeToContentEvent, handleMessage);
    window.dispatchEvent(
      new CustomEvent(glideProtocol.contentToBridgeEvent, {
        detail: {
          id,
          payload: {
            action,
            changeValue,
            internalId,
          },
          source: glideProtocol.sourceContent,
          type: 'glide.userAction',
        },
      }),
    );
  });
}