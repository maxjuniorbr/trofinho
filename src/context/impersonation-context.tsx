import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface ImpersonationState {
    childId: string;
    childName: string;
}

interface ImpersonationContextValue {
    impersonating: ImpersonationState | null;
    startImpersonation: (state: ImpersonationState) => void;
    stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

type ImpersonationProviderProps = Readonly<{
    children: React.ReactNode;
}>;

export function ImpersonationProvider({ children }: ImpersonationProviderProps) {
    const [impersonating, setImpersonating] = useState<ImpersonationState | null>(null);

    const startImpersonation = useCallback((state: ImpersonationState) => {
        setImpersonating(state);
    }, []);

    const stopImpersonation = useCallback(() => {
        setImpersonating(null);
    }, []);

    const value = useMemo<ImpersonationContextValue>(
        () => ({ impersonating, startImpersonation, stopImpersonation }),
        [impersonating, startImpersonation, stopImpersonation],
    );

    return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

export function useImpersonation(): ImpersonationContextValue {
    const ctx = useContext(ImpersonationContext);
    if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
    return ctx;
}
