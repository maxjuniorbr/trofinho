import { describe, it, expect } from 'vitest';
import { setNavigationFeedback, consumeNavigationFeedback } from './navigation-feedback';

describe('navigation-feedback', () => {
  describe('setNavigationFeedback', () => {
    it('stores feedback that can be consumed', () => {
      setNavigationFeedback('admin-task-list', 'Tarefa criada.');

      const result = consumeNavigationFeedback('admin-task-list');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Tarefa criada.');
    });

    it('assigns incrementing ids', () => {
      setNavigationFeedback('admin-task-list', 'First');
      const first = consumeNavigationFeedback('admin-task-list');

      setNavigationFeedback('admin-task-list', 'Second');
      const second = consumeNavigationFeedback('admin-task-list');

      expect(second!.id).toBeGreaterThan(first!.id);
    });

    it('overwrites previous feedback for the same key', () => {
      setNavigationFeedback('admin-task-list', 'Old');
      setNavigationFeedback('admin-task-list', 'New');

      const result = consumeNavigationFeedback('admin-task-list');
      expect(result!.message).toBe('New');
    });
  });

  describe('consumeNavigationFeedback', () => {
    it('returns null when no feedback exists', () => {
      expect(consumeNavigationFeedback('admin-prize-list')).toBeNull();
    });

    it('removes feedback after consuming', () => {
      setNavigationFeedback('admin-prize-list', 'Premio criado.');

      const first = consumeNavigationFeedback('admin-prize-list');
      expect(first).not.toBeNull();

      const second = consumeNavigationFeedback('admin-prize-list');
      expect(second).toBeNull();
    });

    it('does not affect other keys', () => {
      setNavigationFeedback('admin-task-list', 'Task msg');
      setNavigationFeedback('admin-prize-list', 'Prize msg');

      consumeNavigationFeedback('admin-task-list');

      const prize = consumeNavigationFeedback('admin-prize-list');
      expect(prize!.message).toBe('Prize msg');
    });
  });
});
