import { Stack } from "expo-router";

export default function CourseSubLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "none",
            }}
        />
    );
}
