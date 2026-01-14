"use client"; // 클라이언트 전용임을 명시

import { useEffect } from "react";

export default function ClientStyleManager() {
    useEffect(() => {
        // 화면이 뜬 직후 body의 padding-top을 0으로 강제 고정
        document.body.style.paddingTop = "0px";
    }, []);

    return null; // 화면에 아무것도 그리지 않음
}
