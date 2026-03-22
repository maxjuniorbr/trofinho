import { useEffect, useState } from 'react';

type UseTransientMessageOptions = Readonly<{
  durationMs?: number;
  resetKey?: number | string | null;
}>;

const DEFAULT_DURATION_MS = 4000;

export function useTransientMessage(
  message: string | null,
  options: UseTransientMessageOptions = {},
) {
  const { durationMs = DEFAULT_DURATION_MS, resetKey = null } = options;
  const [visibleMessage, setVisibleMessage] = useState<string | null>(message);

  useEffect(() => {
    if (!message) {
      setVisibleMessage(null);
      return;
    }

    setVisibleMessage(message);

    const timeoutId = globalThis.setTimeout(() => {
      setVisibleMessage((currentMessage) => {
        return currentMessage === message ? null : currentMessage;
      });
    }, durationMs);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [durationMs, message, resetKey]);

  return visibleMessage;
}
