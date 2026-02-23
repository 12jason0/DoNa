import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
    try {
        // 실제로는 데이터베이스에서 알림 데이터를 가져옴
        const notifications = [
            {
                id: "1",
                type: "recommendation",
                title: "새로운 오늘의 데이트 추천 결과",
                message:
                    "사용자 1,247명에게 새로운 개인화 추천을 제공했습니다. CTR이 12.3%로 기존 대비 15% 향상되었습니다.",
                timestamp: "2025-01-15T10:30:00Z",
                read: false,
                priority: "high",
                category: "오늘의 데이트 추천",
                metadata: {
                    recommendationId: "rec_20250115_001",
                    performance: {
                        ctr: 12.3,
                        conversionRate: 8.7,
                        accuracy: 89.2,
                    },
                },
            },
            {
                id: "2",
                type: "alert",
                title: "시스템 성능 경고",
                message: "AI 모델 응답 시간이 500ms를 초과했습니다. 현재 650ms로 측정되어 성능 최적화가 필요합니다.",
                timestamp: "2025-01-15T09:45:00Z",
                read: false,
                priority: "critical",
                category: "시스템",
                actionUrl: "/performance-monitoring",
            },
        ];

        return NextResponse.json(notifications);
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}
