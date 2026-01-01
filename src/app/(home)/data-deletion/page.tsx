export default function DataDeletionPage() {
    const CONTACT_EMAIL = "12jason@donacourse.com";
    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">사용자 데이터 삭제</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">계정 탈퇴 또는 개인정보 삭제를 원하실 때의 안내 페이지입니다.</p>

                    <div className="prose prose-lg max-w-none leading-relaxed text-gray-700 dark:text-white">
                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">데이터 삭제 안내</h2>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 mb-4">
                                <p className="text-gray-800 dark:text-white mb-2">
                                    <strong>회원 탈퇴는 마이페이지에서 직접 가능합니다.</strong>
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    로그인 후 <strong>마이페이지 → 프로필 → 계정 삭제</strong> 버튼을 통해 즉시 탈퇴 처리할 수 있습니다.
                                </p>
                            </div>
                            <p className="mb-4">
                                마이페이지에서 탈퇴가 어려운 경우, 아래 이메일로 요청해 주세요.
                            </p>
                            <div className="bg-gray-50 dark:bg-gray-800/50 border dark:border-gray-700 rounded-lg p-4">
                                <p className="text-sm dark:text-white">
                                    <strong>이메일:</strong> {CONTACT_EMAIL}
                                </p>
                                <p className="text-sm dark:text-white mt-2">
                                    <strong>이메일 제목 예시:</strong> 데이터 삭제 요청 (가입 이메일:
                                    example@domain.com)
                                </p>
                                <p className="text-sm dark:text-white mt-2">
                                    <strong>필요 정보:</strong> 가입에 사용한 이메일, 표시 이름(닉네임), 삭제 사유(선택)
                                </p>
                            </div>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">처리 절차</h3>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 mt-4">마이페이지를 통한 탈퇴</h4>
                            <ol className="list-decimal pl-6 space-y-2 mb-4 dark:text-white">
                                <li>로그인 후 <strong>마이페이지 → 프로필</strong>로 이동합니다.</li>
                                <li><strong>계정 삭제</strong> 버튼을 클릭합니다.</li>
                                <li>탈퇴 사유 선택 및 확인 후 즉시 탈퇴 처리됩니다.</li>
                                <li>
                                    계정, 프로필, 즐겨찾기, 체크인, 미션 기록 등 사용자 연동 데이터가 즉시 삭제됩니다.
                                </li>
                            </ol>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 mt-4">이메일을 통한 탈퇴 요청</h4>
                            <ol className="list-decimal pl-6 space-y-2 dark:text-white">
                                <li>요청 접수 후 본인 확인을 진행합니다.</li>
                                <li>
                                    확인 완료 시 계정, 프로필, 즐겨찾기, 체크인, 미션 기록 등 사용자 연동 데이터가
                                    삭제됩니다.
                                </li>
                                <li>처리 완료 후 이메일로 결과를 안내드립니다. (영업일 기준 최대 7일)</li>
                            </ol>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                                <strong>공통:</strong> 관계 법령에 따라 보존이 필요한 데이터는 법정 기간 동안 분리 보관 후 파기됩니다.
                            </p>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                                법령에 의한 데이터 보관 (즉시 삭제 불가)
                            </h3>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 p-4 mb-4">
                                <p className="text-gray-800 dark:text-white mb-2">
                                    <strong>중요 안내:</strong> 계정 탈퇴/데이터 삭제는 언제든지 직접 요청하실 수 있습니다.
                                    다만, <strong>통신비밀보호법(방송통신법)</strong> 및 <strong>전자상거래 등에서의 소비자보호에 관한 법률</strong> 등 관련 법령에 따라 일부 데이터는
                                    즉시 삭제할 수 없으며, 법정 기간 동안 분리 보관 후 파기됩니다.
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    이는 회원 탈퇴 후에도 적용되며, 법적 의무사항이므로 반드시 준수해야 합니다.
                                </p>
                            </div>
                            <div className="overflow-x-auto mb-4">
                                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                                보관 항목
                                            </th>
                                            <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                                보관 근거 (법령)
                                            </th>
                                            <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                                보관 기간
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700 dark:text-white">
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                서비스 접속 로그, 접속 IP 정보
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                통신비밀보호법
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">3개월</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                계약 또는 청약철회 등에 관한 기록
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                전자상거래 등에서의 소비자보호에 관한 법률
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">5년</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                대금결제 및 재화 등의 공급에 관한 기록
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                전자상거래 등에서의 소비자보호에 관한 법률
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">5년</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                소비자의 불만 또는 분쟁처리에 관한 기록
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                전자상거래 등에서의 소비자보호에 관한 법률
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">3년</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                표시/광고에 관한 기록
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                전자상거래 등에서의 소비자보호에 관한 법률
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">6개월</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                위 데이터들은 회원 탈퇴 요청 시에도 법정 기간 동안 별도로 보관되며, 기간 경과 후 파기됩니다.
                                자세한 내용은{" "}
                                <a href="/privacy#retention" className="text-blue-600 dark:text-blue-400 hover:underline">
                                    개인정보처리방침 제2조 (개인정보의 처리 및 보유기간)
                                </a>
                                을 참고해 주세요.
                            </p>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">유의사항</h3>
                            <ul className="list-disc pl-6 space-y-2 dark:text-white">
                                <li>데이터 삭제가 완료되면 복구가 불가능합니다.</li>
                                <li>
                                    사진 업로드 등 사용자가 직접 게시한 콘텐츠도 함께 삭제되며, 통계 목적의 비식별
                                    데이터는 남을 수 있습니다.
                                </li>
                                <li>
                                    <strong>통신비밀보호법 및 전자상거래법 등 관련 법령에 따라</strong>, 접속 로그, 결제 기록, 
                                    분쟁 처리 기록 등은 법정 보관 기간(3개월~5년) 동안 보관 후 파기됩니다. 
                                    이는 회원 탈퇴 후에도 적용되는 법적 의무사항입니다.
                                </li>
                                <li>
                                    더 자세한 내용은{" "}
                                    <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                                        개인정보처리방침
                                    </a>
                                    을 참고해 주세요.
                                </li>
                            </ul>
                        </section>

                        <p className="text-sm text-gray-500 dark:text-gray-400">최종 업데이트: 2025-10-30</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
