export default function TermsOfServicePage() {
    const CONTACT_EMAIL = "12jason@donacouse.com";
    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
                    <p className="text-gray-600 mb-6">
                        서비스 이용에 필요한 핵심 조항을 빠르게 찾아볼 수 있도록 구성했습니다.
                    </p>

                    <div className="prose prose-lg max-w-none leading-relaxed">
                        {/* 빠른 이동 */}
                        <div className="mb-6 flex flex-wrap gap-2">
                            <a
                                href="#def"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                정의
                            </a>
                            <a
                                href="#change"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                약관 변경
                            </a>
                            <a
                                href="#service"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                서비스 제공
                            </a>
                            <a
                                href="#signup"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                회원가입
                            </a>
                            <a
                                href="#duty"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                회원 의무
                            </a>
                            <a
                                href="#ip"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                저작권
                            </a>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제1조 (목적)</h2>
                        <p className="text-gray-700 mb-6">
                            이 약관은 DoNa(이하 "서비스")가 제공하는 여행 코스 추천 서비스 및 관련 제반 서비스의 이용과
                            관련하여 서비스 제공자와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을
                            목적으로 합니다.
                        </p>

                        <h2 id="def" className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24">
                            제2조 (용어의 정의)
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                <strong>"서비스"</strong>라 함은 DoNa가 제공하는 여행 코스 추천, 지도 서비스, 사용자
                                맞춤 추천 등 모든 관련 서비스를 의미합니다.
                            </li>
                            <li>
                                <strong>"이용자"</strong>라 함은 본 약관에 따라 서비스를 이용하는 회원 및 비회원을
                                말합니다.
                            </li>
                            <li>
                                <strong>"회원"</strong>이라 함은 서비스에 개인정보를 제공하여 회원등록을 한 자로서,
                                서비스의 정보를 지속적으로 제공받으며 서비스를 이용할 수 있는 자를 말합니다.
                            </li>
                            <li>
                                <strong>"비회원"</strong>이라 함은 회원에 가입하지 않고 서비스를 이용하는 자를 말합니다.
                            </li>
                        </ul>

                        <h2 id="change" className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24">
                            제3조 (약관의 효력 및 변경)
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을
                                발생합니다.
                            </li>
                            <li>
                                서비스 제공자는 필요하다고 인정되는 경우 이 약관을 변경할 수 있으며, 변경된 약관은
                                제1항과 같은 방법으로 공지 또는 통지함으로써 효력을 발생합니다.
                            </li>
                            <li>
                                이용자는 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.
                            </li>
                        </ul>

                        <h2 id="service" className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24">
                            제4조 (서비스의 제공)
                        </h2>
                        <p className="text-gray-700 mb-4">
                            DoNa는 사용자 맞춤형 추천을 기반으로 한 서비스를 제공합니다. 서비스 품질 향상 및 사용자
                            맞춤형 추천 서비스 제공을 위해 사용자의 서비스 이용 기록(코스 조회, 클릭, 좋아요, 체류 시간
                            등)을 수집하고 활용할 수 있으며, 이러한 데이터 활용은 서비스의 핵심 기능을 수행하기 위한
                            필수적인 과정입니다.
                        </p>
                        <p className="text-gray-700 mb-4">서비스는 다음과 같은 업무를 제공합니다.</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
                            <li>AI 기반 여행 코스 추천 서비스</li>
                            <li>사용자 활동 패턴 분석을 통한 맞춤형 데이트 코스 추천</li>
                            <li>탈출방 게임 추천 및 진행 관리</li>
                            <li>지역별 맛집, 카페, 관광지 정보 제공</li>
                            <li>사용자 맞춤형 여행 경로 생성</li>
                            <li>여행 후기 및 평점 서비스</li>
                            <li>지도 기반 장소 검색 및 안내</li>
                            <li>기타 여행 관련 부가 서비스</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-900 mb-2">제4-1조 (정보의 제공 및 활용)</h3>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                회사는 서비스 품질 향상 및 사용자 맞춤형 서비스 제공을 위해 사용자의 서비스 이용
                                기록(코스 조회, 클릭, 좋아요, 공유, 체류 시간, 검색 기록 등)을 수집하고 활용할 수
                                있습니다.
                            </li>
                            <li>
                                수집된 이용 기록은 다음 목적으로 활용됩니다:
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>사용자 맞춤형 데이트 코스 및 탈출방 추천 서비스 제공</li>
                                    <li>서비스 이용 패턴 분석을 통한 추천 알고리즘 개선</li>
                                    <li>서비스 통계 분석 및 기능 개선</li>
                                </ul>
                            </li>
                            <li>
                                이용 기록의 구체적인 수집 항목, 수집 목적, 보유 기간 등은 개인정보처리방침에 따르며,
                                회원은 개인정보처리방침에서 해당 내용을 확인할 수 있습니다.
                            </li>
                        </ul>

                        <h2 id="signup" className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24">
                            제5조 (회원가입)
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                이용자는 서비스에서 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는
                                의사표시를 함으로써 회원가입을 신청합니다.
                            </li>
                            <li>
                                서비스는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는
                                한 회원으로 등록합니다.
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>가입신청자가 본 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
                                    <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
                                    <li>
                                        기타 회원으로 등록하는 것이 서비스의 기술상 현저히 지장이 있다고 판단되는 경우
                                    </li>
                                </ul>
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제6조 (회원탈퇴 및 자격 상실)</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>회원은 언제든지 탈퇴를 요청할 수 있으며, 서비스는 즉시 회원탈퇴를 처리합니다.</li>
                            <li>
                                회원이 다음 각 호의 사유에 해당하는 경우, 서비스는 회원자격을 제한 및 정지시킬 수
                                있습니다.
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>가입 신청 시에 허위 내용을 등록한 경우</li>
                                    <li>
                                        다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를
                                        위협하는 경우
                                    </li>
                                    <li>
                                        서비스를 이용하여 법령 또는 본 약관이 금지하거나 공서양속에 반하는 행위를 하는
                                        경우
                                    </li>
                                </ul>
                            </li>
                        </ul>

                        <h2 id="duty" className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24">
                            제7조 (회원의 의무)
                        </h2>
                        <p className="text-gray-700 mb-4">회원은 다음 행위를 하여서는 안됩니다.</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 space-y-1">
                            <li>신청 또는 변경 시 허위내용의 등록</li>
                            <li>타인의 정보 도용</li>
                            <li>서비스에 게시된 정보의 변경</li>
                            <li>서비스가 정한 정보 이외의 정보(컴퓨터 프로그램 등)의 송신 또는 게시</li>
                            <li>서비스 및 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                            <li>서비스 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                            <li>
                                외설 또는 폭력적인 메시지, 화상, 음성 기타 공서양속에 반하는 정보를 서비스에 공개 또는
                                게시하는 행위
                            </li>
                            <li className="font-semibold text-blue-800 bg-blue-50 p-2 rounded-md">
                                사진 등 콘텐츠 업로드 시, 타인의 저작권, 초상권 등 제3자의 권리를 침해하는 콘텐츠를
                                게시하는 행위. 회원이 게시하는 모든 콘텐츠에 대한 법적 책임은 회원 본인에게 있습니다.
                            </li>
                            <li className="font-semibold text-blue-800 bg-blue-50 p-2 rounded-md">
                                이용자가 업로드한 사진 데이터는 오직 서비스 내 '추억 액자' 기능 제공을 위한 목적으로만
                                사용되며, 추천 알고리즘 학습, 광고 타게팅, 외부 제공 등 다른 용도로 사용하지 않습니다.
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제8조 (서비스의 중단)</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                서비스는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한
                                경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
                            </li>
                            <li>
                                서비스는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가
                                입은 손해에 대하여 배상하지 않습니다. 단, 고의 또는 중과실이 있는 경우는 그러하지
                                아니합니다.
                            </li>
                        </ul>

                        <h2 id="ip" className="text-2xl font-bold text-gray-900 mt-8 mb-4 scroll-mt-24">
                            제9조 (저작권의 귀속 및 이용제한)
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>서비스에 의해 작성된 저작물에 대한 저작권 기타 지적재산권은 서비스에 귀속합니다.</li>
                            <li>
                                이용자는 서비스를 이용함으로써 얻은 정보 중 서비스에게 지적재산권이 귀속된 정보를
                                서비스의 사전 승낙없이 복제, 송신, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로
                                이용하거나 제3자에게 이용하게 하여서는 안됩니다.
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제10조 (손해배상)</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                서비스는 무료로 제공되는 서비스와 관련하여 회원에게 어떠한 손해가 발생하더라도 동 손해가
                                서비스의 고의 또는 중과실에 의한 경우를 제외하고는 이에 대하여 책임을 부담하지
                                아니합니다.
                            </li>
                            <li>
                                서비스가 제공하는 정보, 자료, 사실의 신뢰도, 정확성 등의 내용에 관하여는 보증을 하지
                                않으며 이로 인해 발생한 회원의 손해에 대하여는 책임을 부담하지 아니합니다.
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제11조 (면책조항)</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                서비스는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는
                                서비스 제공에 관한 책임이 면제됩니다.
                            </li>
                            <li>서비스는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.</li>
                            <li>
                                서비스는 회원이 서비스를 이용하여 기대하는 수익을 상실한 것에 대하여 책임을 지지 않으며,
                                그 밖의 서비스를 통하여 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제12조 (분쟁해결)</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-2">
                            <li>
                                서비스와 회원은 서비스 이용과 관련해 발생한 분쟁을 원만하게 해결하기 위하여 필요한 모든
                                노력을 하여야 합니다.
                            </li>
                            <li>
                                제1항의 규정에도 불구하고 분쟁으로 인하여 소송이 제기될 경우 소송은 서비스의 본사
                                소재지를 관할하는 법원에 제기합니다.
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">제13조 (준거법)</h2>
                        <p className="text-gray-700 mb-6">
                            본 약관의 해석 및 서비스와 회원간의 분쟁에 대하여는 대한민국의 법을 적용합니다.
                        </p>

                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">부칙</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-1">
                            <li>본 약관은 2025년 9월 10일부터 적용됩니다.</li>
                            <li>
                                이전 약관은 본 약관으로 대체되며, 개정된 약관의 적용일 이전 가입자도 개정된 약관의
                                적용을 받습니다.
                            </li>
                        </ul>

                        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-2">📞 문의처</h3>
                            <p className="text-gray-700 text-sm">
                                본 약관에 대한 문의사항이 있으시면 아래로 연락주시기 바랍니다.
                            </p>
                            <p className="text-gray-700 text-sm mt-2">
                                <strong>이메일:</strong> {CONTACT_EMAIL}
                                <br />
                                <strong>운영시간:</strong> 평일 10:00 - 18:00 (주말 및 공휴일 제외)
                            </p>
                        </div>

                        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-2">사업자 정보</h3>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>상호:</strong> (주)두나 (DoNa)
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>대표:</strong> 오승용
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>사업자등록번호:</strong> 166-10-03081
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>통신판매업 신고번호:</strong> 제 2025-충남홍성-0193 호
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>주소:</strong> 충청남도 홍성군 홍북읍 신대로 33
                            </p>
                            <p className="text-gray-700 text-sm">
                                <strong>고객센터:</strong> {CONTACT_EMAIL}
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
