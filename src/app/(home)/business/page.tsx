export default function BusinessPage() {
    const CONTACT_EMAIL = "12jason@donacouse.com";
    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">사업자 정보</h1>

                    <div className="prose prose-lg max-w-none">
                        <div className="bg-gray-50 rounded-lg p-8">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">서비스명</h3>
                                    <p className="text-gray-700">DoNa</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">운영자</h3>
                                    <p className="text-gray-700">오승용</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">사업자등록번호</h3>
                                    <p className="text-gray-700">166-10-03081</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">통신판매업신고번호</h3>
                                    <p className="text-gray-700">준비 중 (베타 서비스)</p>
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">소재지</h3>
                                    <p className="text-gray-700">온라인 서비스</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">고객센터</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">서비스 운영시간</h3>
                                    <p className="text-gray-700">24시간 (문의 응답: 평일 10:00-18:00)</p>
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">개인정보보호책임자</h3>
                                    <p className="text-gray-700">오승용 (12jason@donacouse.com)</p>
                                </div>
                            </div>
                        </div>

                        {/* 서비스 소개 */}
                        <div className="mt-8 bg-blue-50 rounded-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">서비스 소개</h2>
                            <p className="text-gray-700 mb-4">
                                DoNa는 AI 기술을 활용하여 사용자 맞춤형 여행 코스를 추천하는 플랫폼입니다.
                            </p>
                            <ul className="list-disc pl-6 text-gray-700 space-y-2">
                                <li>
                                    <strong>AI 맞춤 추천:</strong> 개인 취향과 선호도를 분석한 맞춤형 여행 코스
                                </li>
                                <li>
                                    <strong>실시간 정보:</strong> 최신 맛집, 카페, 관광지 정보 제공
                                </li>
                                <li>
                                    <strong>간편한 이용:</strong> 복잡한 계획 없이 바로 떠날 수 있는 완성된 코스
                                </li>
                                <li>
                                    <strong>지도 연동:</strong> 카카오맵 기반 경로 안내 및 길찾기
                                </li>
                            </ul>
                        </div>

                        {/* 베타 서비스 안내 */}
                        <div className="mt-8 bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">🚧 베타 서비스 안내</h2>
                            <div className="space-y-3 text-gray-700">
                                <p>
                                    <strong>현재 상태:</strong> 베타 테스트 운영 중
                                </p>
                                <p>
                                    <strong>정식 오픈:</strong> 2025년 9월 오픈 예정
                                </p>
                                <p>
                                    <strong>베타 기간 혜택:</strong>
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>모든 서비스 무료 이용</li>
                                    <li>AI 추천 기능 무제한 체험</li>
                                    <li>정식 서비스 전환 시 할인 혜택</li>
                                </ul>
                                <p>
                                    <strong>주의사항:</strong>
                                </p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>베타 기간 중 일부 기능이 제한될 수 있습니다</li>
                                    <li>서비스 안정성을 위해 정기 점검을 실시합니다</li>
                                    <li>사용자 피드백을 바탕으로 지속적으로 개선하고 있습니다</li>
                                </ul>
                            </div>
                        </div>

                        {/* 연락처 및 문의 */}
                        <div className="mt-8 bg-gray-50 rounded-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">📞 연락처 및 문의</h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">일반 문의</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">24시간 내 답변 (평일 기준)</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">개인정보 관련 문의</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">개인정보보호책임자 직접 처리</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">기술 지원</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">버그 신고 및 기능 제안</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">제휴 및 협력</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">사업 제휴 관련 문의</p>
                                </div>
                            </div>
                        </div>

                        {/* 법적 고지 */}
                        <div className="mt-8 text-sm text-gray-600 border-t pt-6">
                            <p className="mb-2">
                                <strong>저작권:</strong> 본 웹사이트의 모든 콘텐츠는 DoNa의 저작물이며, 무단 복제 및
                                배포를 금지합니다.
                            </p>
                            <p className="mb-2">
                                <strong>면책조항:</strong> DoNa는 베타 서비스 운영 중으로, 서비스 이용으로 인한 직간접적
                                손해에 대해 제한적 책임을 집니다.
                            </p>
                            <p>
                                <strong>분쟁해결:</strong> 서비스 이용 관련 분쟁 발생 시 서비스 운영자 소재지 관할
                                법원에서 해결합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
