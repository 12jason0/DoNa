import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function EscapeIdRedirectPage({ params }: Params) {
    const { id } = await params;
    redirect(`/escape/intro?id=${encodeURIComponent(id || "")}`);
}


