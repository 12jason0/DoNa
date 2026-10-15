import { Alert } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

const favCourseId = (f: any) => Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);

/** 찜 목록(["favorites"]) 캐시를 먼저 바꿔 하트를 바로 표시. 실패 시 되돌릴 이전 값 반환 */
export async function optimisticFavorite(queryClient: QueryClient, id: number, adding: boolean) {
    await queryClient.cancelQueries({ queryKey: ["favorites"] });
    const prev = queryClient.getQueryData<any[]>(["favorites"]);
    queryClient.setQueryData<any[]>(["favorites"], (old = []) =>
        adding ? [...old, { course_id: id, course: { id } }] : old.filter((f) => favCourseId(f) !== id),
    );
    return { prev };
}

/** 찜 실패 알림. 원인 파악용으로 HTTP 상태 코드를 뒤에 붙임 (예: "(401)") */
export function alertFavoriteFailed(t: (key: string) => string, adding: boolean, err: unknown) {
    const code = err instanceof ApiError ? ` (${err.status})` : "";
    Alert.alert(t("mypage.alertErrorTitle"), t(adding ? "mypage.favAddFailed" : "mypage.favRemoveFailed") + code);
}
