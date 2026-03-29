/**
 * 웹 src/app/(home)/privacy/page.tsx 와 동일 문구·구조 (React Native)
 */
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";

const CONTACT_EMAIL = "12jason@donacouse.com";
const GOOGLE_PARTNERS = "https://www.google.com/policies/privacy/partners/";
const DATA_DELETION_URL = "https://dona.io.kr/data-deletion";

type Theme = {
    text: string;
    textMuted: string;
    surface: string;
    border: string;
    isDark: boolean;
};

type Props = {
    tr: (key: string) => string;
    theme: Theme;
    scrollRef: React.RefObject<ScrollView | null>;
    anchorYs: React.MutableRefObject<Record<string, number>>;
};

function regY(anchorYs: React.MutableRefObject<Record<string, number>>, id: string) {
    return (e: { nativeEvent: { layout: { y: number } } }) => {
        anchorYs.current[id] = e.nativeEvent.layout.y;
    };
}

function TableRow({
    c1,
    c2,
    c3,
    header,
    borderColor,
    headerBg,
    textColor,
    muted,
}: {
    c1: string;
    c2: string;
    c3: string;
    header?: boolean;
    borderColor: string;
    headerBg: string;
    textColor: string;
    muted: string;
}) {
    return (
        <View style={[styles.tr, { borderColor }, header ? { backgroundColor: headerBg } : null]}>
            <View style={[styles.td, styles.td1, { borderColor }]}>
                <Text style={[header ? styles.thText : styles.tdText, { color: header ? textColor : muted }]}>{c1}</Text>
            </View>
            <View style={[styles.td, { borderColor }]}>
                <Text style={[header ? styles.thText : styles.tdText, { color: header ? textColor : muted }]}>{c2}</Text>
            </View>
            <View style={[styles.td, styles.td3, { borderColor }]}>
                <Text style={[header ? styles.thText : styles.tdTextBold, { color: header ? textColor : muted }]}>{c3}</Text>
            </View>
        </View>
    );
}

export default function LegalPrivacyBody({ tr, theme, scrollRef, anchorYs }: Props) {
    const chipBg = theme.isDark ? "#1f2937" : "#f3f4f6";
    const chipBorder = theme.isDark ? "#374151" : "#e5e7eb";
    const chipText = theme.isDark ? "#d1d5db" : "#1f2937";
    const redChipBg = theme.isDark ? "rgba(127,29,29,0.25)" : "#fef2f2";
    const redChipBorder = theme.isDark ? "rgba(185,28,28,0.5)" : "#fecaca";
    const redChipText = theme.isDark ? "#fca5a5" : "#dc2626";
    const boxBg = theme.isDark ? "rgba(31,41,55,0.5)" : "#f9fafb";
    const tableBorder = theme.isDark ? "#374151" : "#d1d5db";
    const theadBg = theme.isDark ? "#1f2937" : "#f9fafb";
    const calloutBorder = theme.isDark ? "#2563eb" : "#60a5fa";

    const nav = [
        { id: "purpose", label: tr("privacy.navPurpose") },
        { id: "retention", label: tr("privacy.navRetention") },
        { id: "items", label: tr("privacy.navItems") },
        { id: "behavior", label: tr("privacy.navBehavior") },
        { id: "rights", label: tr("privacy.navRights") },
        { id: "security", label: tr("privacy.navSecurity") },
    ] as const;

    const go = (id: string) => {
        const y = anchorYs.current[id];
        if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    };

    const reg = (id: string) => regY(anchorYs, id);

    return (
        <View>
            <Text style={[styles.h1, { color: theme.text }]}>{tr("privacy.title")}</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>{tr("privacy.subtitle")}</Text>

            <View style={styles.navRow}>
                {nav.map((n) => (
                    <TouchableOpacity
                        key={n.id}
                        onPress={() => go(n.id)}
                        style={[styles.navChip, { backgroundColor: chipBg, borderColor: chipBorder }]}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.navChipText, { color: chipText }]}>{n.label}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    onPress={() => void Linking.openURL(DATA_DELETION_URL)}
                    style={[styles.navChip, { backgroundColor: redChipBg, borderColor: redChipBorder }]}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.navChipText, { color: redChipText }]}>{tr("privacy.navDataDeletion")}</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.p, { color: theme.textMuted }]}>
                DoNa(이하 &apos;서비스&apos;)은 개인정보보호법 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고
                원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
            </Text>

            <View onLayout={reg("purpose")}>
                <Text style={[styles.h2, { color: theme.text }]}>제1조 개인정보의 처리목적</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지
                    않으며, 이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할
                    예정입니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}회원 가입 및 관리: 회원 식별, 본인 확인, 중복가입 방지</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}서비스 제공: 사용자의 서비스 이용 패턴 분석을 통한 맞춤형 데이트 코스 및 탈출방 추천 서비스 제공, 지도 서비스
                    제공
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}서비스 개선 및 신규 서비스 개발: 서비스 이용 기록 및 접속 빈도 분석, 서비스 이용에 대한 통계, 맞춤형 서비스
                    제공 및 기능 개선
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}고객 지원: 문의사항 처리 및 공지사항 전달</Text>
            </View>

            <View onLayout={reg("retention")}>
                <Text style={[styles.h2, { color: theme.text }]}>제2조 개인정보의 처리 및 보유기간</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보 수집 시에 동의받은 보유·이용기간 내에서
                    개인정보를 처리·보유합니다. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.
                </Text>
                <Text style={[styles.h3, { color: theme.text }]}>1. 서비스 이용 및 내부 방침에 의한 보관</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>회원 가입 정보:</Text> 회원 탈퇴 시까지 보관합니다. 단, 관계법령 위반에 따른 수사·조사 등이
                    진행 중인 경우에는 해당 조사 종료 시까지 보관합니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>사용자 활동 로그 (식별 가능한 형태):</Text> 코스 조회, 클릭, 좋아요, 체류 시간 등 사용자 식별
                    정보와 결합된 활동 로그는 회원 탈퇴 시 즉시 파기합니다. 다만, 서비스 고도화를 위한 통계 분석 목적으로 필요한 경우,
                    특정 개인을 알아볼 수 없는 형태로 <Text style={styles.strong}>비식별화(가명화) 처리</Text>하여 별도 보관할 수 있습니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>S3 업로드 이미지 데이터:</Text> 유저가 업로드한 사진은 파일명 중복 방지 및 인덱싱 성능
                    최적화를 위해 고유한 파일명으로 저장되며, 회원 탈퇴 시 또는 해당 콘텐츠 삭제 시 즉시 파기됩니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>서비스 이용기록 (비식별화된 행태정보):</Text> 개인을 식별할 수 없도록 비식별화 처리된 로그
                    데이터 및 행태정보는 통계 및 분석 목적으로 최대 26개월 보관 후 파기합니다.
                </Text>
                <Text style={[styles.h3, { color: theme.text }]}>2. 관련 법령에 의한 보관 (탈퇴 후에도 예외적으로 보관)</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    상법, 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령의 규정에 의하여 보존할 필요가 있는 경우, 회사는 아래와
                    같이 법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.
                </Text>
                <View style={[styles.table, { borderColor: tableBorder }]}>
                    <TableRow
                        header
                        c1="보관 항목"
                        c2="보관 근거"
                        c3="보관 기간"
                        borderColor={tableBorder}
                        headerBg={theadBg}
                        textColor={theme.text}
                        muted={theme.textMuted}
                    />
                    <TableRow
                        c1="계약 또는 청약철회 등에 관한 기록"
                        c2="전자상거래 등에서의 소비자보호에 관한 법률"
                        c3="5년"
                        borderColor={tableBorder}
                        headerBg={theadBg}
                        textColor={theme.text}
                        muted={theme.textMuted}
                    />
                    <TableRow
                        c1="대금결제 및 재화 등의 공급에 관한 기록"
                        c2="전자상거래 등에서의 소비자보호에 관한 법률"
                        c3="5년"
                        borderColor={tableBorder}
                        headerBg={theadBg}
                        textColor={theme.text}
                        muted={theme.textMuted}
                    />
                    <TableRow
                        c1="소비자의 불만 또는 분쟁처리에 관한 기록"
                        c2="전자상거래 등에서의 소비자보호에 관한 법률"
                        c3="3년"
                        borderColor={tableBorder}
                        headerBg={theadBg}
                        textColor={theme.text}
                        muted={theme.textMuted}
                    />
                    <TableRow
                        c1="서비스 접속 로그, 접속 IP 정보"
                        c2="통신비밀보호법"
                        c3="3개월"
                        borderColor={tableBorder}
                        headerBg={theadBg}
                        textColor={theme.text}
                        muted={theme.textMuted}
                    />
                    <TableRow
                        c1="표시/광고에 관한 기록"
                        c2="전자상거래 등에서의 소비자보호에 관한 법률"
                        c3="6개월"
                        borderColor={tableBorder}
                        headerBg={theadBg}
                        textColor={theme.text}
                        muted={theme.textMuted}
                    />
                </View>
            </View>

            <View onLayout={reg("items")}>
                <Text style={[styles.h2, { color: theme.text }]}>제3조 처리하는 개인정보 항목</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>DoNa는 다음의 개인정보 항목을 처리하고 있습니다.</Text>
                <Text style={[styles.h3, { color: theme.text }]}>1. 회원가입 시</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>필수 항목:</Text> 이메일 주소, 닉네임 (소셜 로그인 시 제공받는 정보)
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>선택 항목:</Text> 프로필 이미지, 여행 선호도 정보 (MBTI, 선호 지역 등)
                </Text>
                <Text style={[styles.h3, { color: theme.text }]}>2. 미션 참여 등 특정 기능 이용 시</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>&apos;Escape 미션&apos; 사진 업로드:</Text> 미션 수행을 위해 이용자가 직접 촬영하거나 선택하여
                    업로드하는 사진 파일. 해당 사진은 서비스 내 &apos;추억 액자&apos;와 같은 기능으로 본인에게 다시 보여질 수 있습니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>사진 데이터의 이용 범위 제한:</Text> 이용자가 업로드한 사진 데이터는 오직 &apos;추억 액자&apos; 기능
                    제공을 위한 목적으로만 사용되며, 추천 알고리즘 학습, 광고 타게팅, 외부 제공 등 그 밖의 용도로는 사용하지 않습니다.
                </Text>
                <Text style={[styles.h3, { color: theme.text }]}>3. 서비스 이용과정에서 자동 생성 및 수집되는 정보</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}IP 주소, 쿠키, 서비스 이용 기록(방문 기록, 페이지 조회, 클릭 기록 등), 접속 로그, 기기 정보(브라우저 종류, OS
                    정보)
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>활동 로그 (코스 조회, 클릭, 좋아요, 공유, 체류 시간 등):</Text> 로그인 상태에서 수집될 경우
                    사용자 식별 정보와 결합되어 개인정보로 관리됩니다. 비로그인 상태에서 수집된 활동 로그는 개인을 식별할 수 없는 형태로
                    처리됩니다.
                </Text>
            </View>

            <View onLayout={reg("behavior")}>
                <Text style={[styles.h2, { color: theme.text }]}>제4조 행태정보의 수집·이용 및 거부 등에 관한 사항</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    서비스는 이용자에게 더 나은 서비스를 제공하기 위해 다음과 같이 행태정보를 수집 및 이용하고 있습니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>수집하는 행태정보의 항목:</Text> 웹사이트 방문 기록, 페이지 조회 이력, 클릭 이력, 검색어 등
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>행태정보 수집 목적:</Text> 서비스 이용 현황 및 통계 분석을 통한 서비스 개선 및 최적화
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>행태정보를 수집하는 외부 도구:</Text> Google Analytics
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>Google Analytics를 통해 수집된 정보의 처리 방식:</Text> Google Analytics는 쿠키를 통해 개인을
                    식별할 수 없는 형태로 정보를 수집하며, 이 정보는 Google의 개인정보처리방침에 따라 관리됩니다. 자세한 내용은
                    &apos;Google이 Google 서비스를 사용하는 사이트 또는 앱의 정보를 이용하는 방법&apos; (
                    <Text style={styles.link} onPress={() => void Linking.openURL(GOOGLE_PARTNERS)}>
                        www.google.com/policies/privacy/partners/
                    </Text>
                    ) 페이지에서 확인하실 수 있습니다.
                </Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    이용자는 웹 브라우저의 설정을 변경하여 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 불편이 발생할 수 있습니다.
                </Text>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제5조 개인정보의 제3자 제공</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 정보주체의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의
                    특별한 규정 등 개인정보보호법 제17조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다. 현재 서비스는 법률에 따른
                    의무 이행 외에 개인정보를 제3자에게 제공하고 있지 않습니다.
                </Text>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제6조 개인정보처리 위탁</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 서비스 제공의 효율성을 위해 아래와 같이 일부 업무를 외부 전문업체에 위탁합니다. 위탁계약 체결 시 개인정보보호
                    관련 법령을 준수하고 수탁자에 대한 관리·감독을 실시합니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>Amazon Web Services, Inc. (AWS)</Text> — 클라우드 인프라 운영 및 이미지 저장(S3) / 보관 위치:
                    서울 리전(ap-northeast-2) / 보유·이용기간: 목적 달성 또는 계약 종료 시까지
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>토스페이먼츠 주식회사</Text> — 결제 처리 및 정산(유료 결제 도입 시) / 보유·이용기간:
                    전자상거래법 등 관계법령에서 정한 기간
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>카카오</Text> — 소셜 로그인(OAuth) 인증 / 항목: 식별자, 프로필(닉네임/이미지) 등 동의 범위 내 /
                    보유·이용기간: 연동 해제 또는 회원 탈퇴 시까지
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}
                    <Text style={styles.strong}>Google LLC (Google Analytics)</Text> — 서비스 이용 행태 분석 / 항목: 쿠키, 방문·클릭 이력 등 개인을
                    식별할 수 없는 형태 / 보유·이용기간: 최대 26개월
                </Text>
            </View>

            <View onLayout={reg("rights")}>
                <Text style={[styles.h2, { color: theme.text }]}>제7조 정보주체의 권리·의무 및 행사방법</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    정보주체는 DoNa에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}개인정보 열람 요구</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}오류 등이 있을 경우 정정 요구</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}삭제 요구</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}처리정지 요구</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    위의 권리 행사는 개인정보보호법 시행령 제41조제1항에 따라 서면, 전자우편 등을 통하여 하실 수 있으며 DoNa는 이에 대해
                    지체없이 조치하겠습니다.
                </Text>
                <View
                    style={[
                        styles.calloutBlue,
                        {
                            backgroundColor: theme.isDark ? "rgba(30,58,138,0.25)" : "#eff6ff",
                            borderLeftColor: calloutBorder,
                        },
                    ]}
                >
                    <Text style={[styles.calloutStrong, { color: theme.isDark ? "#93c5fd" : "#1e3a8a" }]}>
                        💡 계정 탈퇴 또는 개인정보 삭제를 원하시나요?
                    </Text>
                    <Text style={[styles.calloutP, { color: theme.isDark ? "#93c5fd" : "#1d4ed8" }]}>
                        회원 탈퇴 및 개인정보 삭제 절차에 대한 자세한 안내를 확인하실 수 있습니다.
                    </Text>
                    <TouchableOpacity
                        onPress={() => void Linking.openURL(DATA_DELETION_URL)}
                        style={[styles.calloutBtn, { backgroundColor: theme.isDark ? "#1d4ed8" : "#2563eb" }]}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.calloutBtnText}>데이터 삭제 안내 보기 →</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제8조 개인정보의 파기</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를
                    파기합니다.
                </Text>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제8-1조 장기 미이용자(휴면계정) 관리</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}연속 1년 이상 로그인 이력이 없는 계정은 휴면계정으로 전환하여 별도로 분리·보관합니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}휴면 전환 30일 전에 이메일 등으로 사전 안내하며, 로그인 시 휴면 상태는 해제됩니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>
                    {"\u2022 "}분리·보관된 정보는 관계법령 보관기간 경과 후 지체없이 파기합니다.
                </Text>
            </View>

            <View onLayout={reg("security")}>
                <Text style={[styles.h2, { color: theme.text }]}>제9조 개인정보의 안전성 확보조치</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적/관리적 및 물리적 조치를 하고 있습니다.
                </Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}개인정보 취급 직원의 최소화 및 교육</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}개인정보에 대한 접근 제한</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}접속기록의 보관 및 위변조 방지</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}개인정보의 암호화</Text>
                <Text style={[styles.disc, { color: theme.textMuted }]}>{"\u2022 "}해킹 등에 대비한 기술적 대책</Text>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제9-1조 위치정보 처리에 관한 사항</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>
                    DoNa는 지도 보기 및 근처 추천 기능 제공을 위해 단말기의 위치정보(위도·경도 등)를 이용할 수 있습니다. 위치정보는 서비스
                    제공을 위한 최소 범위에서만 이용되며, 브라우저/OS 권한 설정을 통해 수집·이용 동의를 언제든지 철회할 수 있습니다. 동의
                    철회 시 위치 기반 기능의 일부가 제한될 수 있습니다.
                </Text>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제10조 개인정보 보호책임자</Text>
                <View style={[styles.grayBox, { backgroundColor: boxBg }]}>
                    <Text style={[styles.p, { color: theme.textMuted, marginBottom: 6 }]}>
                        <Text style={styles.strong}>개인정보 보호책임자</Text>
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted, marginBottom: 4 }]}>
                        <Text style={styles.strong}>성명: 오승용</Text>
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted, marginBottom: 4 }]}>
                        <Text style={styles.strong}>직책: 대표</Text>
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted, marginBottom: 4 }]}>
                        <Text style={styles.strong}>연락처:</Text> {CONTACT_EMAIL}
                    </Text>
                    <Text style={[styles.small, { color: theme.textMuted }]}>
                        ※ 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자 및 담당부서로 문의하실 수
                        있습니다.
                    </Text>
                </View>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제11조 개인정보 처리방침 변경</Text>
                <Text style={[styles.p, { color: theme.textMuted }]}>이 개인정보처리방침은 2026년 1월 1일부터 적용됩니다.</Text>
            </View>

            <View>
                <Text style={[styles.h2, { color: theme.text }]}>제12조 사업자 정보</Text>
                <View style={[styles.grayBox, { backgroundColor: boxBg }]}>
                    <Text style={[styles.p, { color: theme.textMuted }]}>
                        <Text style={styles.strong}>상호:</Text> 두나(DoNa) (DoNa)
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted }]}>
                        <Text style={styles.strong}>대표:</Text> 오승용
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted }]}>
                        <Text style={styles.strong}>사업자등록번호:</Text> 166-10-03081
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted }]}>
                        <Text style={styles.strong}>통신판매업 신고번호:</Text> 제 2025-충남홍성-0193 호
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted }]}>
                        <Text style={styles.strong}>주소:</Text> 충청남도 홍성군 홍북읍 신대로 33
                    </Text>
                    <Text style={[styles.p, { color: theme.textMuted, marginBottom: 0 }]}>
                        <Text style={styles.strong}>문의:</Text> {CONTACT_EMAIL}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    h1: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
    navRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    navChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    navChipText: { fontSize: 13, fontWeight: "600" },
    h2: { fontSize: 22, fontWeight: "700", marginTop: 24, marginBottom: 12 },
    h3: { fontSize: 17, fontWeight: "600", marginTop: 12, marginBottom: 8 },
    p: { fontSize: 15, lineHeight: 24, marginBottom: 12 },
    disc: { fontSize: 15, lineHeight: 24, marginBottom: 8, paddingLeft: 8 },
    strong: { fontWeight: "700" },
    link: { color: "#2563eb", textDecorationLine: "underline", fontWeight: "600" },
    table: { borderWidth: 1, borderRadius: 4, overflow: "hidden", marginBottom: 16 },
    tr: { flexDirection: "row", borderBottomWidth: 1 },
    td: { flex: 1.2, paddingHorizontal: 10, paddingVertical: 10, borderRightWidth: 1, justifyContent: "center" },
    td1: { flex: 1.3 },
    td3: { flex: 0.85, borderRightWidth: 0 },
    thText: { fontSize: 12, fontWeight: "700" },
    tdText: { fontSize: 12, lineHeight: 18 },
    tdTextBold: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
    calloutBlue: {
        padding: 14,
        borderRadius: 8,
        marginBottom: 16,
        borderLeftWidth: 4,
    },
    calloutStrong: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
    calloutP: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
    calloutBtn: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    calloutBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    grayBox: { padding: 16, borderRadius: 10, marginBottom: 12 },
    small: { fontSize: 13, lineHeight: 20, marginTop: 8 },
});
