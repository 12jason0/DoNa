import { redirect } from "next/navigation";

type Params = { params: { id: string } };

export default function EscapeIdRedirectPage({ params }: Params) {
    const id = params?.id;
    redirect(`/escape/intro?id=${encodeURIComponent(id || "")}`);
}


