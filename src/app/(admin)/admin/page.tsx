"use client";

import Link from "next/link";

export default function AdminDashboard() {
    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">DoNa 관리자 대시보드</h1>

            {/* 메뉴 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. 코스 관리 */}
                <Link href="/admin/courses" className="block group">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                        <div className="text-3xl mb-4">🗺️</div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">코스 관리</h3>
                        <p className="text-gray-500 mt-2 text-sm">
                            데이트 코스를 생성, 수정하고 코스에 장소를 배치합니다.
                        </p>
                    </div>
                </Link>

                {/* 2. 장소 관리 */}
                <Link href="/admin/places" className="block group">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                        <div className="text-3xl mb-4">📍</div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                            장소 데이터베이스
                        </h3>
                        <p className="text-gray-500 mt-2 text-sm">
                            개별 장소(카페, 식당 등) 데이터를 추가하고 수정합니다.
                        </p>
                    </div>
                </Link>

                {/* 3. 알림 발송 */}
                <Link href="/admin/notifications" className="block group">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                        <div className="text-3xl mb-4">📢</div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">푸시 알림 발송</h3>
                        <p className="text-gray-500 mt-2 text-sm">전체 유저 또는 구독자에게 이벤트 알림을 보냅니다.</p>
                    </div>
                </Link>

                {/* 4. 방탈출 스토리 */}
                <Link href="/admin/escape-stories" className="block group">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                        <div className="text-3xl mb-4">🕵️‍♀️</div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                            이스케이프 스토리
                        </h3>
                        <p className="text-gray-500 mt-2 text-sm">방탈출 게임 시나리오와 스토리를 관리합니다.</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
