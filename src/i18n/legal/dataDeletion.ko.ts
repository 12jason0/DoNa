const dataDeletionKo = {
    pageTitle: "사용자 데이터 삭제",
    pageSubtitle: "계정 탈퇴 또는 개인정보 삭제를 원하실 때의 안내 페이지입니다.",

    // Section 1
    sec1Title: "데이터 삭제 안내",
    sec1BoxStrong: "회원 탈퇴는 마이페이지에서 직접 가능합니다.",
    sec1BoxPre: "로그인 후 ",
    sec1BoxPath: "마이페이지 → 프로필 → 계정 삭제",
    sec1BoxPost: " 버튼을 통해 즉시 탈퇴 처리할 수 있습니다.",
    sec1EmailNote: "마이페이지에서 탈퇴가 어려운 경우, 아래 이메일로 요청해 주세요.",
    sec1EmailLabel: "이메일:",
    sec1SubjectLabel: "이메일 제목 예시:",
    sec1SubjectExample: "데이터 삭제 요청 (가입 이메일: example@domain.com)",
    sec1RequiredLabel: "필요 정보:",
    sec1RequiredInfo: "가입에 사용한 이메일, 표시 이름(닉네임), 삭제 사유(선택)",

    // Section 2
    sec2Title: "처리 절차",
    sec2MyPageTitle: "마이페이지를 통한 탈퇴",
    sec2MyPageL1Pre: "로그인 후 ",
    sec2MyPageL1Path: "마이페이지 → 프로필",
    sec2MyPageL1Post: "로 이동합니다.",
    sec2MyPageL2Pre: "",
    sec2MyPageL2Strong: "계정 삭제",
    sec2MyPageL2Post: " 버튼을 클릭합니다.",
    sec2MyPageL3: "탈퇴 사유 선택 및 확인 후 즉시 탈퇴 처리됩니다.",
    sec2MyPageL4: "계정, 프로필, 즐겨찾기, 미션 기록 등 사용자 연동 데이터가 즉시 삭제됩니다.",
    sec2EmailTitle: "이메일을 통한 탈퇴 요청",
    sec2EmailL1: "요청 접수 후 본인 확인을 진행합니다.",
    sec2EmailL2: "확인 완료 시 계정, 프로필, 즐겨찾기, 미션 기록 등 사용자 연동 데이터가 삭제됩니다.",
    sec2EmailL3: "처리 완료 후 이메일로 결과를 안내드립니다. (영업일 기준 최대 7일)",
    sec2CommonLabel: "공통:",
    sec2CommonNote: "관계 법령에 따라 보존이 필요한 데이터는 법정 기간 동안 분리 보관 후 파기됩니다.",

    // Section 3
    sec3Title: "법령에 의한 데이터 보관 (즉시 삭제 불가)",
    sec3BoxStrong: "중요 안내:",
    sec3BoxText1: "계정 탈퇴/데이터 삭제는 언제든지 직접 요청하실 수 있습니다.",
    sec3BoxText2: "다만 관련 법령에 따라 일부 데이터는 즉시 삭제할 수 없으며, 법정 기간 동안 분리 보관 후 파기됩니다.",
    sec3BoxNote: "이는 회원 탈퇴 후에도 적용되며, 법적 의무사항이므로 반드시 준수해야 합니다.",

    tableColItem: "보관 항목",
    tableColBasis: "보관 근거 (법령)",
    tableColPeriod: "보관 기간",

    row1Item: "서비스 접속 로그, 접속 IP 정보",
    row1Basis: "통신비밀보호법",
    row1Period: "3개월",

    row2Item: "계약 또는 청약철회 등에 관한 기록",
    row2Basis: "전자상거래 등에서의 소비자보호에 관한 법률",
    row2Period: "5년",

    row3Item: "대금결제 및 재화 등의 공급에 관한 기록",
    row3Basis: "전자상거래 등에서의 소비자보호에 관한 법률",
    row3Period: "5년",

    row4Item: "소비자의 불만 또는 분쟁처리에 관한 기록",
    row4Basis: "전자상거래 등에서의 소비자보호에 관한 법률",
    row4Period: "3년",

    row5Item: "표시/광고에 관한 기록",
    row5Basis: "전자상거래 등에서의 소비자보호에 관한 법률",
    row5Period: "6개월",

    sec3FooterPre: "위 데이터들은 회원 탈퇴 요청 시에도 법정 기간 동안 별도로 보관되며, 기간 경과 후 파기됩니다.",
    sec3FooterLinkPre: "자세한 내용은",
    sec3FooterLinkText: "개인정보처리방침 제2조 (개인정보의 처리 및 보유기간)",
    sec3FooterLinkPost: "을 참고해 주세요.",

    // Section 4
    sec4Title: "유의사항",
    sec4L1: "데이터 삭제가 완료되면 복구가 불가능합니다.",
    sec4L2: "사진 업로드 등 사용자가 직접 게시한 콘텐츠도 함께 삭제되며, 통계 목적의 비식별 데이터는 남을 수 있습니다.",
    sec4L3Pre: "관련 법령에 따라",
    sec4L3Post: " 접속 로그, 결제 기록, 분쟁 처리 기록 등은 법정 보관 기간 동안 보관 후 파기됩니다.",
    sec4L4Pre: "더 자세한 내용은",
    sec4L4Link: "개인정보처리방침",
    sec4L4Post: "을 참고해 주세요.",

    lastUpdated: "최종 업데이트: 2025-10-30",
};

export default dataDeletionKo;
export type DataDeletionStrings = typeof dataDeletionKo;
