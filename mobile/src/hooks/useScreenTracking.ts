import { useEffect } from "react";
import { usePathname } from "expo-router";
import { posthog } from "../lib/posthog";

export function useScreenTracking() {
    const pathname = usePathname();

    useEffect(() => {
        posthog.capture("$screen_view", { screen_name: pathname });
    }, [pathname]);
}
