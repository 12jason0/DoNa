export default function DataDeletionPage() {
    const CONTACT_EMAIL = "12jason@naver.com";
    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">사용자 데이터 삭제</h1>
                    <p className="text-gray-600 mb-6">계정 탈퇴 또는 개인정보 삭제를 원하실 때의 안내 페이지입니다.</p>

                    <div className="prose prose-lg max-w-none leading-relaxed text-gray-700">
                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">데이터 삭제 안내</h2>
                            <p className="mb-4">
                                DoNa에서 탈퇴하시거나 개인정보 삭제를 원하시면 아래 이메일로 요청해 주세요.
                            </p>
                            <div className="bg-gray-50 border rounded-lg p-4">
                                <p className="text-sm">
                                    <strong>이메일:</strong> {CONTACT_EMAIL}
                                </p>
                                <p className="text-sm mt-2">
                                    <strong>이메일 제목 예시:</strong> 데이터 삭제 요청 (가입 이메일:
                                    example@domain.com)
                                </p>
                                <p className="text-sm mt-2">
                                    <strong>필요 정보:</strong> 가입에 사용한 이메일, 표시 이름(닉네임), 삭제 사유(선택)
                                </p>
                            </div>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">처리 절차</h3>
                            <ol className="list-decimal pl-6 space-y-2">
                                <li>요청 접수 후 본인 확인을 진행합니다.</li>
                                <li>
                                    확인 완료 시 계정, 프로필, 즐겨찾기, 체크인, 미션 기록 등 사용자 연동 데이터가
                                    삭제됩니다.
                                </li>
                                <li>관계 법령에 따라 보존이 필요한 데이터는 법정 기간 동안 분리 보관 후 파기됩니다.</li>
                                <li>처리 완료 후 이메일로 결과를 안내드립니다. (영업일 기준 최대 7일)</li>
                            </ol>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">유의사항</h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>데이터 삭제가 완료되면 복구가 불가능합니다.</li>
                                <li>
                                    사진 업로드 등 사용자가 직접 게시한 콘텐츠도 함께 삭제되며, 통계 목적의 비식별
                                    데이터는 남을 수 있습니다.
                                </li>
                                <li>
                                    더 자세한 내용은{" "}
                                    <a href="/privacy" className="text-blue-600 hover:underline">
                                        개인정보처리방침
                                    </a>
                                    을 참고해 주세요.
                                </li>
                            </ul>
                        </section>

                        <p className="text-sm text-gray-500">최종 업데이트: 2025-10-30</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
