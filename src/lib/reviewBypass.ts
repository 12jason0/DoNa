export function isAndroidAppRequest(headers: { get(name: string): string | null }): boolean {
    const ua = (headers.get("user-agent") || "").toLowerCase();
    return /android/.test(ua) && /dona_app|expo|reactnative/i.test(ua);
}
