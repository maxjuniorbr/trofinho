export type NavigationFeedbackKey =
  | 'admin-task-list'
  | 'admin-prize-list';

export type NavigationFeedback = Readonly<{
  id: number;
  message: string;
}>;

const feedbackStore = new Map<NavigationFeedbackKey, NavigationFeedback>();
let nextFeedbackId = 0;

export function setNavigationFeedback(
  key: NavigationFeedbackKey,
  message: string,
): void {
  nextFeedbackId += 1;
  feedbackStore.set(key, {
    id: nextFeedbackId,
    message,
  });
}

export function consumeNavigationFeedback(
  key: NavigationFeedbackKey,
): NavigationFeedback | null {
  const feedback = feedbackStore.get(key) ?? null;

  if (feedback) {
    feedbackStore.delete(key);
  }

  return feedback;
}
