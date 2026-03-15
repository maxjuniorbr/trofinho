import { useState, useCallback } from 'react';
import { approveAssignment, rejectAssignment, type AssignmentWithChild } from '@lib/tasks';

type ActionState = 'rejecting' | 'processing' | null;

export function useAssignmentActions(onSuccess: () => Promise<void>) {
  const [actions, setActions] = useState<Record<string, ActionState>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imgStates, setImgStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

  const getAction = useCallback((id: string): ActionState => actions[id] ?? null, [actions]);
  const getNote = useCallback((id: string): string => notes[id] ?? '', [notes]);
  const getError = useCallback((id: string): string => errors[id] ?? '', [errors]);
  const getImgState = useCallback((id: string) => imgStates[id], [imgStates]);

  const startReject = useCallback((id: string) => {
    setActions((prev) => ({ ...prev, [id]: 'rejecting' }));
  }, []);

  const cancelReject = useCallback((id: string) => {
    setActions((prev) => ({ ...prev, [id]: null }));
  }, []);

  const changeNote = useCallback((id: string, value: string) => {
    setNotes((prev) => ({ ...prev, [id]: value }));
  }, []);

  const changeImgState = useCallback((id: string, state: 'loading' | 'loaded' | 'error') => {
    setImgStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const approve = useCallback(async (assignment: AssignmentWithChild) => {
    setActions((prev) => ({ ...prev, [assignment.id]: 'processing' }));
    setErrors((prev) => ({ ...prev, [assignment.id]: '' }));

    const { error } = await approveAssignment(assignment.id);
    if (error) {
      setErrors((prev) => ({ ...prev, [assignment.id]: error }));
      setActions((prev) => ({ ...prev, [assignment.id]: null }));
    } else {
      await onSuccess();
      setActions((prev) => ({ ...prev, [assignment.id]: null }));
    }
  }, [onSuccess]);

  const reject = useCallback(async (assignment: AssignmentWithChild) => {
    const note = notes[assignment.id] ?? '';
    if (!note.trim()) {
      setErrors((prev) => ({ ...prev, [assignment.id]: 'Informe o motivo da rejeição.' }));
      return;
    }

    setActions((prev) => ({ ...prev, [assignment.id]: 'processing' }));
    setErrors((prev) => ({ ...prev, [assignment.id]: '' }));

    const { error } = await rejectAssignment(assignment.id, note.trim());
    if (error) {
      setErrors((prev) => ({ ...prev, [assignment.id]: error }));
      setActions((prev) => ({ ...prev, [assignment.id]: null }));
    } else {
      await onSuccess();
      setActions((prev) => ({ ...prev, [assignment.id]: null }));
      setNotes((prev) => ({ ...prev, [assignment.id]: '' }));
    }
  }, [notes, onSuccess]);

  return {
    getAction,
    getNote,
    getError,
    getImgState,
    approve,
    reject,
    startReject,
    cancelReject,
    changeNote,
    changeImgState,
  };
}
