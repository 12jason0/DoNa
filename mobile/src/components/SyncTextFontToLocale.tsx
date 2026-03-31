import { useEffect } from "react";

import { useAppSettings } from "../context/AppSettingsContext";
import { applyDefaultTextFontForLocale } from "../lib/textDefaultFont";

/** 언어 변경 시 React Native Text 기본 폰트를 locale 에 맞게 다시 적용 */
export default function SyncTextFontToLocale() {
    const { locale } = useAppSettings();

    useEffect(() => {
        applyDefaultTextFontForLocale(locale);
    }, [locale]);

    return null;
}
