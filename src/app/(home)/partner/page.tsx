import type { Metadata } from "next";
import PartnerClient from "./PartnerClient";

export const metadata: Metadata = {
    title: "제휴·광고 문의",
    description: "팝업 브랜드·가게·대행사의 두나 제휴·노출 문의 창구예요.",
    alternates: { canonical: "/partner" },
};

export default function PartnerPage() {
    return <PartnerClient />;
}
