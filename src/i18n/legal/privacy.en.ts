import type { PrivacyStrings } from "./privacy.ko";

const privacyEn = {
    intro_p:
        "DoNa (the “Service”) establishes and discloses this Privacy Policy in accordance with Article 30 of the Personal Information Protection Act to protect personal data and handle related complaints promptly and smoothly.",

    art1_title: "Article 1 Purposes of processing",
    art1_p:
        "DoNa processes personal data for the purposes below. Data are not used for other purposes; if purposes change, we will take necessary measures such as obtaining separate consent under Article 18 of the Act.",
    art1_li1: "Membership: identification, verification, duplicate signup prevention",
    art1_li2:
        "Service provision: personalized date course and escape room recommendations based on usage patterns, map services",
    art1_li3:
        "Improvement and new services: usage and access analysis, statistics, personalized features",
    art1_li4: "Customer support: inquiries and notices",

    art2_title: "Article 2 Processing and retention periods",
    art2_p:
        "DoNa processes and retains personal data within the period required by law or consented to at collection. Retention details are as follows.",

    sec21_title: "1. Retention under internal policy",
    sec21_li1:
        "Membership data: until withdrawal; if an investigation is ongoing due to legal violation, until it ends.",
    sec21_li2:
        "Activity logs (identifiable): logs linked to identity are destroyed immediately on withdrawal. For service improvement, we may retain de-identified/pseudonymized data.",
    sec21_li3:
        "S3 images: stored under unique filenames for deduplication and indexing; destroyed on withdrawal or content deletion.",
    sec21_li4:
        "De-identified behavioral data: retained up to 26 months for statistics, then destroyed.",

    sec22_title: "2. Retention required by law (even after withdrawal)",
    sec22_p:
        "Where the Commercial Act, E-Commerce Consumer Protection Act, or other laws require retention, we retain member information for the statutory periods below.",

    tbl_h1: "Item",
    tbl_h2: "Legal basis",
    tbl_h3: "Period",
    tbl_r1c1: "Records on contracts, withdrawals, etc.",
    tbl_r1c2: "Act on Consumer Protection in Electronic Commerce",
    tbl_r1c3: "5 years",
    tbl_r2c1: "Records on payment and supply of goods/services",
    tbl_r2c2: "Act on Consumer Protection in Electronic Commerce",
    tbl_r2c3: "5 years",
    tbl_r3c1: "Records on consumer complaints and disputes",
    tbl_r3c2: "Act on Consumer Protection in Electronic Commerce",
    tbl_r3c3: "3 years",
    tbl_r4c1: "Access logs, IP addresses",
    tbl_r4c2: "Protection of Communications Secrets Act",
    tbl_r4c3: "3 months",
    tbl_r5c1: "Advertising and labeling records",
    tbl_r5c2: "Act on Consumer Protection in Electronic Commerce",
    tbl_r5c3: "6 months",

    art3_title: "Article 3 Categories of personal data processed",
    art3_p: "DoNa processes the following categories of personal data.",

    art3_s1_title: "1. At signup",
    art3_s1_li1: "Required: email, nickname (from social login when used)",
    art3_s1_li2: "Optional: profile image, travel preferences (MBTI, preferred areas, etc.)",

    art3_s2_title: "2. When using certain features such as missions",
    art3_s2_li1:
        "Escape mission photos: images you capture or select. They may be shown again in features such as the in-service “memory frame.”",
    art3_s2_li2:
        "Scope of photo use: uploaded photos are used only for the “memory frame” feature, not for training recommendations, ad targeting, or external sharing.",

    art3_s3_title: "3. Automatically collected during use",
    art3_s3_li1:
        "IP address, cookies, usage records (visits, page views, clicks), access logs, device info (browser, OS)",
    art3_s3_li2:
        "Activity logs (course views, clicks, likes, shares, dwell time): when collected while logged in, managed as personal data combined with identity; when not logged in, processed in a non-identifiable form.",

    art4_title: "Article 4 Behavioral information",
    art4_p: "To provide a better service, we collect and use behavioral information as follows.",
    art4_li1: "Items: site visits, page views, clicks, search queries, etc.",
    art4_li2: "Purpose: statistics and analysis to improve and optimize the service",
    art4_li3: "Tool: Google Analytics",
    art4_li4_title: "How Google Analytics processes data:",
    art4_li4_beforeLink:
        "It collects data in a non-identifiable form via cookies, managed under Google’s privacy policy. See “How Google uses information from sites or apps that use our services” (",
    art4_li4_suffix: ").",
    art4_p2:
        "You may refuse cookies via browser settings; some features may be less convenient.",

    art5_title: "Article 5 Disclosure to third parties",
    art5_p:
        "DoNa processes data only within the purposes in Article 1 and provides data to third parties only where consent or legal grounds under Article 17 of the Act apply. Except as required by law, we do not provide personal data to third parties.",

    art6_title: "Article 6 Processors (subcontractors)",
    art6_p:
        "We entrust some tasks to specialists as below. Contracts comply with privacy laws and we supervise processors.",
    art6_li1:
        "Amazon Web Services, Inc. (AWS) — cloud and image storage (S3) / region: Seoul (ap-northeast-2) / until purpose fulfilled or contract ends",
    art6_li2:
        "Toss Payments Co., Ltd. — payment and settlement (when paid features launch) / retention per e-commerce and related laws",
    art6_li3:
        "Kakao — social login (OAuth) / identifiers, profile (nickname/image) within consent / until unlink or withdrawal",
    art6_li4:
        "Google LLC (Google Analytics) — usage analytics / cookies, visit and click data in non-identifiable form / up to 26 months",

    art7_title: "Article 7 Rights of data subjects",
    art7_p: "You may exercise the following rights toward DoNa at any time:",
    art7_li1: "Access",
    art7_li2: "Correction if inaccurate",
    art7_li3: "Erasure",
    art7_li4: "Restriction of processing",
    art7_p2:
        "You may exercise these rights in writing or by email per Enforcement Decree Article 41(1); DoNa will respond without undue delay.",
    art7_box_title: "Want to delete your account or personal data?",
    art7_box_p: "See our detailed guide on withdrawal and data deletion.",
    art7_box_cta: "View data deletion guide →",

    art8_title: "Article 8 Destruction of personal data",
    art8_p:
        "When retention ends or purposes are achieved and data are no longer needed, DoNa destroys them without delay.",

    art81_title: "Article 8-1 Dormant accounts",
    art81_li1: "Accounts with no login for one consecutive year become dormant and are stored separately.",
    art81_li2: "We notify by email about 30 days before dormancy; logging in ends dormancy.",
    art81_li3: "Separated data are destroyed after statutory retention periods.",

    art9_title: "Article 9 Security measures",
    art9_p: "Under Article 29 of the Act, DoNa implements technical, administrative, and physical safeguards, including:",
    art9_li1: "Minimizing and training staff who handle data",
    art9_li2: "Access controls",
    art9_li3: "Access log retention and tamper protection",
    art9_li4: "Encryption",
    art9_li5: "Technical measures against hacking",

    art91_title: "Article 9-1 Location information",
    art91_p:
        "For maps and nearby recommendations, we may use device location (latitude/longitude). Use is minimized for service provision; you may withdraw consent via browser/OS settings. Some location features may be limited if you withdraw.",

    art10_title: "Article 10 Data protection officer",
    art10_role: "Data protection officer",
    art10_name: "Name: Seungyong Oh",
    art10_job: "Title: Representative",
    art10_contact_label: "Contact:",
    art10_footer:
        "For privacy inquiries, complaints, and remedies, contact the officer or responsible team.",

    art11_title: "Article 11 Changes to this policy",
    art11_p: "This Privacy Policy applies from January 1, 2026.",

    art12_title: "Article 12 Business information",
    art12_name: "Trade name: DoNa",
    art12_rep: "Representative: Seungyong Oh",
    art12_reg: "Business registration: 166-10-03081",
    art12_sale: "E-commerce registration: 2025-Chungnam Hongseong-0193",
    art12_addr: "Address: 33 Sindae-ro, Hongbuk-eup, Hongseong-gun, Chungcheongnam-do, Korea",
    art12_contact_label: "Contact:",
} satisfies PrivacyStrings;

export default privacyEn;
