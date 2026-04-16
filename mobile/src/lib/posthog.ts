import PostHog from "posthog-react-native";

export const posthog = new PostHog(
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "",
    {
        host: "https://us.i.posthog.com",
        disabled: !process.env.EXPO_PUBLIC_POSTHOG_API_KEY || __DEV__,
    }
);
