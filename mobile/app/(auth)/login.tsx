/**
 * 로그인 화면
 * 웹 src/app/(home)/login/page.tsx 기반으로 1:1 재현
 *
 * - 이메일/비밀번호: POST /api/auth/login
 * - 카카오: 웹 OAuth 방식 그대로 유지 (expo-web-browser)
 * - Apple: expo-apple-authentication 네이티브
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useQueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';

import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../src/constants/theme';
import { api, endpoints, BASE_URL } from '../../src/lib/api';
import { saveAuthToken, saveUserId } from '../../src/lib/mmkv';
import { AUTH_QUERY_KEY } from '../../src/hooks/useAuth';
import AppHeader from '../../src/components/AppHeader';
import StandaloneTabBar from '../../src/components/StandaloneTabBar';
import { AppleMark, KakaoMark, SOCIAL_MARK_SIZE } from '../../src/components/auth/SocialLoginMarks';

// @react-native-kakao/user — 네이티브 모듈, 정적 import 시 일부 빌드에서 크래시 가능 → 동적 require
let kakaoNativeLogin: (() => Promise<{ accessToken: string }>) | null = null;
try {
    const kakaoUserModule = require('@react-native-kakao/user');
    kakaoNativeLogin = kakaoUserModule.login ?? null;
} catch {
    kakaoNativeLogin = null;
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type LoginResponse = {
    user?: { id: number; email: string; name: string; nickname?: string };
    token?: string;
    error?: string;
};

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function LoginScreen() {
    const queryClient = useQueryClient();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // ─── 로그인 성공 처리 ──────────────────────────────────────────────────────

    async function handleLoginSuccess(user: { id: number }, token?: string | null) {
        if (token) saveAuthToken(token);
        saveUserId(String(user.id));

        try {
            await Purchases.logIn(String(user.id));
        } catch {}

        // TanStack Query 세션 캐시 갱신 → 루트 index.tsx가 /(tabs)로 리다이렉트
        await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        router.replace('/(tabs)');
    }

    // ─── 이메일/비밀번호 로그인 ────────────────────────────────────────────────

    async function handleEmailLogin() {
        if (loading) return;
        if (!email.trim() || !password) {
            setError('이메일과 비밀번호를 입력해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const data = await api.post<LoginResponse>(endpoints.login, { email, password });
            if (data.user) {
                setMessage('로그인 중...');
                await handleLoginSuccess(data.user, data.token);
            } else {
                setError(data.error || '로그인에 실패했습니다.');
            }
        } catch (e: any) {
            setError(e.message || '로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }

    // ─── 카카오 로그인 ────────────────────────────────────────────────────────
    // Android: 네이티브 Kakao SDK (@react-native-kakao/user)
    // iOS: 웹 OAuth (expo-web-browser)

    async function handleKakaoLogin() {
        if (loading) return;
        setLoading(true);
        setError('');

        try {
            const runKakaoWebOAuth = async () => {
                const result = await WebBrowser.openAuthSessionAsync(
                    `${BASE_URL}/api/auth/kakao?next=mobile`,
                    'duna://success',
                );
                if (result.type === 'success' && result.url) {
                    const urlObj = new URL(result.url);
                    const token = urlObj.searchParams.get('token');
                    const userId = urlObj.searchParams.get('userId');
                    if (token) saveAuthToken(token);
                    if (userId) saveUserId(userId);
                    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
                    router.replace('/(tabs)');
                }
            };

            if (Platform.OS === 'android' && kakaoNativeLogin) {
                const kakaoToken = await kakaoNativeLogin();
                const data = await api.post<LoginResponse>('/api/auth/kakao/native', {
                    accessToken: kakaoToken.accessToken,
                });
                if (data.user) {
                    setMessage('로그인 중...');
                    await handleLoginSuccess(data.user, data.token);
                } else {
                    setError(data.error || '카카오 로그인에 실패했습니다.');
                }
            } else {
                // iOS 또는 안드로이드에서 네이티브 모듈 없을 때: 웹 OAuth
                await runKakaoWebOAuth();
            }
        } catch (e: any) {
            // 사용자가 직접 취소한 경우 에러 표시 안 함
            if (!e?.message?.includes('cancel') && e?.code !== 'ECANCEL') {
                setError('카카오 로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    }

    // ─── Apple 로그인 ──────────────────────────────────────────────────────────

    async function handleAppleLogin() {
        if (loading) return;
        setLoading(true);
        setError('');

        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            const data = await api.post<LoginResponse>(endpoints.appleAuth, {
                identityToken: credential.identityToken,
                authorizationCode: credential.authorizationCode,
                user: credential.user,
                fullName: credential.fullName,
            });

            if (data.user) {
                await handleLoginSuccess(data.user, data.token);
            } else {
                throw new Error(data.error || 'Apple 로그인에 실패했습니다.');
            }
        } catch (e: any) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
                // 사용자가 취소 — 에러 표시 안 함
            } else {
                setError(e.message || 'Apple 로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    }

    // ─── 렌더 ──────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <AppHeader />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* 카드 */}
                    <View style={styles.card}>
                        {/* 헤더 */}
                        <View style={styles.header}>
                            <View style={styles.iconBox}>
                                <Text style={styles.iconEmoji}>🌿</Text>
                            </View>
                            <Text style={styles.title}>로그인</Text>
                            <Text style={styles.subtitle}>두나에 오신 것을 환영합니다</Text>
                        </View>

                        {/* 메시지 */}
                        {!!message && (
                            <View style={styles.msgSuccess}>
                                <Text style={styles.msgSuccessText}>{message}</Text>
                            </View>
                        )}
                        {!!error && (
                            <View style={styles.msgError}>
                                <Text style={styles.msgErrorText}>{error}</Text>
                            </View>
                        )}

                        {/* 이메일 */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>이메일</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="이메일을 입력하세요"
                                placeholderTextColor={Colors.gray400}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoComplete="email"
                                textContentType="emailAddress"
                                editable={!loading}
                            />
                        </View>

                        {/* 비밀번호 */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>비밀번호</Text>
                            <View style={styles.passwordRow}>
                                <TextInput
                                    style={[styles.input, styles.passwordInput]}
                                    placeholder="비밀번호를 입력하세요"
                                    placeholderTextColor={Colors.gray400}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoComplete="password"
                                    textContentType="password"
                                    editable={!loading}
                                />
                                <TouchableOpacity
                                    style={styles.eyeBtn}
                                    onPress={() => setShowPassword(v => !v)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 로그인 버튼 */}
                        <TouchableOpacity
                            style={[styles.btnSubmit, loading && styles.btnDisabled]}
                            onPress={handleEmailLogin}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.white} size="small" />
                            ) : (
                                <Text style={styles.btnSubmitText}>로그인</Text>
                            )}
                        </TouchableOpacity>

                        {/* 회원가입 링크 */}
                        <View style={styles.signupRow}>
                            <Text style={styles.signupText}>계정이 없으신가요? </Text>
                            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                                <Text style={styles.signupLink}>회원가입</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 구분선 */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>또는</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* 소셜 로그인 — 원형 아이콘 64px (Apple 왼쪽, 카카오 오른쪽 · iOS만 Apple) */}
                        <View style={styles.socialRow}>
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={[styles.socialCircleApple, loading && styles.btnDisabled]}
                                    onPress={handleAppleLogin}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Apple로 로그인"
                                >
                                    <AppleMark size={SOCIAL_MARK_SIZE} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.socialCircleKakao, loading && styles.btnDisabled]}
                                onPress={handleKakaoLogin}
                                disabled={loading}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="카카오로 로그인"
                            >
                                <KakaoMark size={SOCIAL_MARK_SIZE} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <StandaloneTabBar />
        </SafeAreaView>
    );
}

// ─── 스타일 (웹 login/page.tsx Tailwind 클래스 → StyleSheet 변환) ─────────────

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    flex: { flex: 1 },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: Spacing[4],
        paddingVertical: Spacing[8],
        paddingBottom: 120,
    },

    // ── 카드 (bg-white rounded-xl border border-gray-100 p-6) ─────────────────
    card: {
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.gray100,
        padding: Spacing[6],
        ...Shadow.sm,
    },

    // ── 헤더 ──────────────────────────────────────────────────────────────────
    header: {
        alignItems: 'center',
        marginBottom: Spacing[6],
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.emerald100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing[2],
    },
    iconEmoji: { fontSize: 24 },
    title: {
        fontSize: FontSize['2xl'],
        fontWeight: '500',
        color: Colors.gray900,
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: FontSize.sm,
        color: Colors.gray600,
    },

    // ── 알림 메시지 ────────────────────────────────────────────────────────────
    msgSuccess: {
        marginBottom: Spacing[4],
        padding: Spacing[4],
        backgroundColor: Colors.green50,
        borderWidth: 1,
        borderColor: Colors.green200,
        borderRadius: BorderRadius.lg,
    },
    msgSuccessText: { fontSize: FontSize.sm, color: Colors.green600 },
    msgError: {
        marginBottom: Spacing[4],
        padding: Spacing[4],
        backgroundColor: Colors.red50,
        borderWidth: 1,
        borderColor: Colors.red200,
        borderRadius: BorderRadius.lg,
    },
    msgErrorText: { fontSize: FontSize.sm, color: Colors.red600 },

    // ── 입력 필드 ──────────────────────────────────────────────────────────────
    fieldGroup: { marginBottom: Spacing[5] },
    label: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        color: Colors.gray800,
        marginBottom: Spacing[2],
    },
    input: {
        width: '100%',
        paddingHorizontal: Spacing[4],
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.white,
        fontSize: FontSize.base,
        color: Colors.gray900,
    },
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn: {
        position: 'absolute',
        right: 12,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    eyeIcon: { fontSize: 18 },

    // ── 제출 버튼 (bg-slate-900) ──────────────────────────────────────────────
    btnSubmit: {
        backgroundColor: Colors.slate900,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing[4],
        minHeight: 50,
    },
    btnSubmitText: {
        color: Colors.white,
        fontSize: FontSize.base,
        fontWeight: '500',
        letterSpacing: -0.3,
    },
    btnDisabled: { opacity: 0.5 },

    // ── 회원가입 링크 ──────────────────────────────────────────────────────────
    signupRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: Spacing[4],
    },
    signupText: { fontSize: FontSize.sm, color: Colors.gray600 },
    signupLink: {
        fontSize: FontSize.sm,
        color: Colors.emerald600,
        fontWeight: '500',
    },

    // ── 구분선 ─────────────────────────────────────────────────────────────────
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing[4],
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.green100,
    },
    dividerText: {
        marginHorizontal: Spacing[2],
        fontSize: FontSize.sm,
        color: Colors.gray500,
    },

    // ── 소셜 — 원형 아이콘 ────────────────────────────────────────────────────
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
    },
    socialCircleKakao: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEE500',
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.sm,
    },
    socialCircleApple: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.sm,
    },
});
