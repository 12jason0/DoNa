import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import axios from "axios";
import jwt from "jsonwebtoken";
import { getS3Client, getS3Bucket } from "@/lib/s3";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

/**
 * 애플 Client Secret 생성 함수 (Apple Revoke API 호출용)
 */
function getAppleClientSecret() {
    const teamId = process.env.APPLE_TEAM_ID!;
    const keyId = process.env.APPLE_KEY_ID!;
    const clientId = process.env.APPLE_CLIENT_ID!; // kr.io.dona.dona.sid
    const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

    return jwt.sign({}, privateKey, {
        algorithm: "ES256",
        expiresIn: "1h",
        audience: "https://appleid.apple.com",
        issuer: teamId,
        subject: clientId,
        keyid: keyId,
    });
}

export async function DELETE(request: NextRequest) {
    try {
        // 1. 사용자 인증 확인
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        // 1-1. 탈퇴 사유 수집 (선택사항, UX 개선용)
        let withdrawalReason: string | null = null;
        try {
            const body = await request.json().catch(() => ({}));
            withdrawalReason = body.withdrawalReason || null;
            if (withdrawalReason) {
                console.log(`[탈퇴 사유] User ${userId}: ${withdrawalReason}`);
                // 향후 분석을 위해 별도 로그나 DB에 저장 가능
            }
        } catch (e) {
            // JSON 파싱 실패 시 무시 (body가 없을 수도 있음)
        }

        // 2. 사용자 정보 조회 (소셜 연동 정보, 구독 상태, 이미지 URL 포함)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                provider: true,
                socialId: true,
                subscriptionTier: true,
                subscriptionExpiresAt: true,
                profileImageUrl: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }

        // 2-1. 구독 상태 확인 및 경고 (유료 구독 중이면 경고 반환)
        const hasActiveSubscription =
            user.subscriptionTier !== "FREE" &&
            user.subscriptionExpiresAt &&
            new Date(user.subscriptionExpiresAt) > new Date();

        if (hasActiveSubscription) {
            return NextResponse.json(
                {
                    error: "구독 중인 멤버십이 있습니다.",
                    details: "유료 구독을 해지한 후 탈퇴해주세요. 탈퇴 시 남은 기간에 대한 환불이 어려울 수 있습니다.",
                    hasActiveSubscription: true,
                },
                { status: 400 }
            );
        }

        // 3. 소셜 연동 해제 (External API Call)
        try {
            if (user.provider === "kakao") {
                // 카카오 연동 해제
                await axios.post(
                    "https://kapi.kakao.com/v1/user/unlink",
                    `target_id_type=user_id&target_id=${user.socialId}`,
                    {
                        headers: {
                            Authorization: `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`,
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    }
                );
                console.log("카카오 연동 해제 성공");
            } else if (user.provider === "apple") {
                // 애플 연동 해제 (Revoke)
                // Note: appleRefreshToken이 DB에 저장되어 있지 않으면 스킵
                // Apple은 사용자가 직접 Apple ID 설정에서 앱 연동을 해제할 수 있음
                console.log("애플 로그인 사용자 - Apple ID 설정에서 직접 해제 가능");
                // 향후 appleRefreshToken 필드가 추가되면 아래 코드 활성화
                /*
                const clientSecret = getAppleClientSecret();
                const params = new URLSearchParams();
                params.append("client_id", process.env.APPLE_CLIENT_ID!);
                params.append("client_secret", clientSecret);
                params.append("token", user.appleRefreshToken);
                params.append("token_type_hint", "refresh_token");

                await axios.post("https://appleid.apple.com/auth/revoke", params, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });
                console.log("애플 연동 해제 성공");
                */
            }
        } catch (socialError: any) {
            // 소셜 해제 실패 시 로그는 남기되 DB 삭제는 진행 (이미 플랫폼에서 앱을 삭제했을 수 있음)
            console.error(
                "소셜 연동 해제 중 오류 발생(무시하고 진행):",
                socialError.response?.data || socialError.message
            );
        }

        // 3-1. S3 이미지 삭제 (프로필 이미지 및 사용자가 업로드한 이미지)
        try {
            const s3Client = getS3Client();
            const bucket = getS3Bucket();

            // 프로필 이미지 삭제
            if (user.profileImageUrl) {
                try {
                    // S3 URL에서 키 추출
                    const url = new URL(user.profileImageUrl);
                    const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;

                    await s3Client.send(
                        new DeleteObjectCommand({
                            Bucket: bucket,
                            Key: key,
                        })
                    );
                    console.log(`프로필 이미지 삭제 성공: ${key}`);
                } catch (s3Error) {
                    console.error("프로필 이미지 삭제 실패 (무시):", s3Error);
                }
            }

            // 사용자가 작성한 리뷰 이미지 삭제
            try {
                const reviews = await prisma.review.findMany({
                    where: { userId: userId },
                    select: { imageUrls: true },
                });

                for (const review of reviews) {
                    if (review.imageUrls && Array.isArray(review.imageUrls)) {
                        for (const imageUrl of review.imageUrls) {
                            try {
                                const url = new URL(imageUrl);
                                const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;

                                await s3Client.send(
                                    new DeleteObjectCommand({
                                        Bucket: bucket,
                                        Key: key,
                                    })
                                );
                            } catch (s3Error) {
                                console.error(`리뷰 이미지 삭제 실패 (무시): ${imageUrl}`, s3Error);
                            }
                        }
                    }
                }
            } catch (reviewError) {
                console.error("리뷰 이미지 삭제 중 오류 (무시):", reviewError);
            }

            // 사용자가 만든 코스의 이미지 삭제
            try {
                const courses = await prisma.course.findMany({
                    where: { userId: userId },
                    select: { imageUrl: true },
                });

                for (const course of courses) {
                    if (course.imageUrl) {
                        try {
                            const url = new URL(course.imageUrl);
                            const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;

                            await s3Client.send(
                                new DeleteObjectCommand({
                                    Bucket: bucket,
                                    Key: key,
                                })
                            );
                        } catch (s3Error) {
                            console.error(`코스 이미지 삭제 실패 (무시): ${course.imageUrl}`, s3Error);
                        }
                    }
                }
            } catch (courseError) {
                console.error("코스 이미지 삭제 중 오류 (무시):", courseError);
            }
        } catch (s3Error) {
            // S3 삭제 실패해도 DB 삭제는 진행
            console.error("S3 이미지 삭제 중 전체 오류 (무시하고 진행):", s3Error);
        }

        // 4. DB 데이터 처리 (트랜잭션) - 소프트 딜리트 방식
        await prisma.$transaction(async (tx) => {
            // [법적 보관] Payment와 LoginLog는 보관 (삭제하지 않음)
            // - Payment: 전자상거래법에 따라 5년 보관
            // - LoginLog: 통신비밀보호법에 따라 3개월 보관

            // [삭제 가능한 데이터] 사용자 활동 데이터 삭제
            try {
                await tx.userCheckin.deleteMany({
                    where: { userId: userId },
                });
            } catch (e) {
                console.error("UserCheckin 삭제 실패 (무시):", e);
            }

            // UserReward 삭제 (보상 기록은 법적 보관 불필요)
            try {
                await tx.userReward.deleteMany({ where: { userId: userId } });
            } catch (e) {
                console.error("UserReward 삭제 실패 (무시):", e);
            }

            // UserStoryProgress 삭제
            try {
                await tx.userStoryProgress.deleteMany({ where: { user_id: userId } });
            } catch (e) {
                try {
                    await tx.userStoryProgress.deleteMany({ where: { userId: userId } as any });
                } catch (e2) {
                    console.error("UserStoryProgress 삭제 실패 (무시):", e, e2);
                }
            }

            // [소프트 딜리트] User 개인정보 마스킹 및 deletedAt 설정
            // 실제 삭제하지 않고 개인정보만 마스킹하여 법적 보관 요구사항 준수
            await (tx as any).user.update({
                where: { id: userId },
                data: {
                    // 개인정보 마스킹 (이메일은 null로 설정하여 unique 제약 조건 충돌 방지)
                    email: null, // 이메일 삭제 (null로 설정하여 unique 제약 조건 충돌 방지)
                    username: `탈퇴한사용자_${userId}`,
                    password: null, // 비밀번호 삭제
                    socialId: null, // 소셜 ID 삭제
                    profileImageUrl: null, // 프로필 이미지 삭제
                    phone: null, // 전화번호 삭제
                    mbti: null, // MBTI 삭제
                    age: null, // 나이 삭제
                    gender: null, // 성별 삭제
                    birthday: null, // 생년월일 삭제
                    ageRange: null, // 연령대 삭제
                    location: null, // 위치 정보 삭제
                    preferredTags: [], // 선호 태그 삭제
                    billingKey: null, // 결제 키 삭제
                    // 탈퇴일 기록
                    deletedAt: new Date(),
                    // 구독 정보 초기화
                    subscriptionTier: "FREE",
                    subscriptionExpiresAt: null,
                    isAutoRenewal: false,
                    // 마케팅 동의 초기화
                    isMarketingAgreed: false,
                    marketingAgreedAt: null,
                },
            });

            console.log(`[User Delete] User ${userId} 소프트 딜리트 완료 (deletedAt 설정)`);
        });

        return NextResponse.json({
            success: true,
            message: "계정 및 모든 연동 데이터가 성공적으로 삭제되었습니다.",
        });
    } catch (error: any) {
        console.error("계정 삭제 전체 프로세스 오류:", error);
        return NextResponse.json(
            {
                error: "계정 삭제 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}
