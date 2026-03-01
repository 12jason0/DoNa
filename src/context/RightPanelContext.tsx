"use client";

import React, { createContext, useContext, RefObject } from "react";

interface RightPanelContextType {
    containerRef: RefObject<HTMLDivElement | null>;
    containInPanel: boolean;
}

const RightPanelContext = createContext<RightPanelContextType | undefined>(undefined);

export function RightPanelProvider({
    children,
    containerRef,
    containInPanel,
}: {
    children: React.ReactNode;
    containerRef: RefObject<HTMLDivElement | null>;
    containInPanel: boolean;
}) {
    return (
        <RightPanelContext.Provider value={{ containerRef, containInPanel }}>
            {children}
        </RightPanelContext.Provider>
    );
}

export function useRightPanel() {
    const ctx = useContext(RightPanelContext);
    return ctx;
}
