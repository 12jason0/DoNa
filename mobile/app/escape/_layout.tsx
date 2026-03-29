import { Stack } from "expo-router";

export default function EscapeLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "none",
            }}
        />
    );
}
