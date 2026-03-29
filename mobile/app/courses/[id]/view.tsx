/**
 * 웹과 동일하게 공유 URL을 /courses/[id]/view 로 맞춤.
 * Universal Link로 앱이 열릴 때 이 경로를 처리하고, 네이티브 코스 상세로 보냄.
 */
import { Redirect, useLocalSearchParams } from "expo-router";

export default function CourseViewLinkScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    if (!id) return null;
    return <Redirect href={`/courses/${id}`} />;
}
