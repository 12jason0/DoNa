"use client";

import { NavermapsProvider } from "react-naver-maps";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LocaleProvider } from "@/context/LocaleContext";
import { VersionProvider } from "@/providers/VersionProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";

    return (
        <ThemeProvider>
            <LocaleProvider>
            <AuthProvider>
                <VersionProvider>
                    <NavermapsProvider ncpClientId={clientId}>{children}</NavermapsProvider>
                </VersionProvider>
            </AuthProvider>
            </LocaleProvider>
        </ThemeProvider>
    );
}
