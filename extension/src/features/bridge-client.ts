import {
  createMessageId,
  glideProtocol,
  type GlideBridgeMessage,
  type UserActionProcedureName,
  type UserActionResponse,
} from '@blakebecker/glide-shared';

const requestTimeoutMs = 5000;

type BridgeRequestMessage =
  | {
      type: 'glide.toast';
      payload: {
        kind: 'error' | 'success';
        message: string;
      };
    }
  | {
      type: 'glide.userAction';
      payload: {
        action: UserActionProcedureName;
        changeValue?: string;
        internalId?: string;
      };
    };

export function callBridgeUserAction(action: UserActionProcedureName, changeValue = 'INIT', internalId?: string): Promise<UserActionResponse> {
  return sendBridgeRequest<UserActionResponse>({
    payload: {
      action,
      changeValue,
      ...(internalId ? { internalId } : {}),
    },
    type: 'glide.userAction',
  }, 'glide.userAction');
}

export function showBridgeToast(message: string, kind: 'error' | 'success'): Promise<boolean> {
  return sendBridgeRequest<{ shown: boolean }>({
    payload: {
      kind,
      message,
    },
    type: 'glide.toast',
  }, 'glide.toast').then((payload) => payload.shown);
}

function sendBridgeRequest<TPayload>(message: BridgeRequestMessage, timeoutLabel: BridgeRequestMessage['type']): Promise<TPayload> {
  const id = createMessageId('feature');

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener(glideProtocol.bridgeToContentEvent, handleMessage);
      reject(new Error(`${timeoutLabel} timed out`));
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

      resolve(message.payload as TPayload);
    }

    window.addEventListener(glideProtocol.bridgeToContentEvent, handleMessage);
    window.dispatchEvent(
      new CustomEvent(glideProtocol.contentToBridgeEvent, {
        detail: {
          id,
          ...message,
          source: glideProtocol.sourceContent,
        },
      }),
    );
  });
}