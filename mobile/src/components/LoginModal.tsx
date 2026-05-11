/**
 * 로그인 바텀시트 모달
 * 웹 src/components/LoginModal.tsx 디자인과 동일
 * + 카카오/애플 소셜 로그인 버튼 직접 제공
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    TouchableOpacity,
    ScrollView,
    Platform,
    Animated,
    useWindowDimensions,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useQueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';

import { useSlideModalAnimation } from '../hooks/useSlideModalAnimation';
import { useThemeColors } from '../hooks/useThemeColors';
import { modalBottomPadding } from '../utils/modalSafePadding';
import { MODAL_ANDROID_PROPS } from '../constants/modalAndroidProps';
import { Colors, FontSize, BorderRadius } from '../constants/theme';
import { useLocale } from '../lib/useLocale';
import { useModal } from '../lib/modalContext';
import { api, BASE_URL } from '../lib/api';
import { saveAuthToken, saveUserId } from '../lib/mmkv';
import { AUTH_QUERY_KEY } from '../hooks/useAuth';
import { AppleMark, KakaoMark, SOCIAL_MARK_SIZE } from './auth/SocialLoginMarks';

// 네이티브 카카오 SDK (동적 require — 정적 import 시 일부 빌드 크래시 가능)
let kakaoNativeLogin: (() => Promise<{ accessToken: string }>) | null = null;
try {
    const kakaoUserModule = require('@react-native-kakao/user');
    const loginFn = kakaoUserModule.login;
    kakaoNativeLogin = loginFn ? () => loginFn({ useKakaoAccountLogin: true }) : null;
} catch {}

type LoginResponse = {
    user?: { id: number; email: string; name: string; nickname?: string };
    token?: string;
    error?: string;
};

export default function LoginModal() {
    const { isOpen, closeModal } = useModal();
    const visible = isOpen("login");
    const onClose = () => closeModal("login");
    const t = useThemeColors();
    const { t: i18n } = useLocale();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const maxH = Math.min(height * 0.92, height - insets.top - 16);
    const { rendered, translateY, backdropOpacity, sheetReady, isClosing } = useSlideModalAnimation(visible);
    const bottomPad = modalBottomPadding(insets.bottom);
    const queryClient = useQueryClient();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const benefitList = [
        i18n('loginModal.presets.courseDetail.benefit0'),
        i18n('loginModal.presets.courseDetail.benefit1'),
        i18n('loginModal.presets.courseDetail.benefit2'),
    ];

    async function handleLoginSuccess(user: { id: number }, token?: string | null) {
        if (token) saveAuthToken(token);
        saveUserId(String(user.id));
        try { await Purchases.logIn(String(user.id)); } catch {}
        await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        onClose();
        router.replace('/(tabs)');
    }

    function handleGoToLogin() {
        onClose();
        router.push('/(auth)/login' as any);
    }

    // ─── 카카오 로그인 ─────────────────────────────────────────────────────────

    async function handleKakaoLogin() {
        if (loading) return;
        setLoading(true);
        setError('');

        console.log('[LoginModal] kakaoNativeLogin loaded:', !!kakaoNativeLogin, 'platform:', Platform.OS);

        try {
            // Android: intentFilter가 https://dona.io.kr를 앱으로 라우팅 → 네이티브 SDK
            if (Platform.OS === 'android') {
                if (!kakaoNativeLogin) {
                    console.warn('[LoginModal] kakaoNativeLogin is null — SDK not loaded');
                    setError('[debug] native SDK null');
                    setLoading(false);
                    return;
                }
                let nativeResult: { accessToken: string };
                try {
                    console.log('[LoginModal] calling kakaoNativeLogin...');
                    nativeResult = await kakaoNativeLogin();
                    console.log('[LoginModal] kakaoNativeLogin success, token length:', nativeResult?.accessToken?.length);
                } catch (e: any) {
                    console.error('[LoginModal][inner] SDK 오류 msg:', e?.message, 'code:', e?.code, 'name:', e?.name);
                    console.error('[LoginModal][inner] JSON:', JSON.stringify(e));
                    // "마지막 로그인 도중에 오류 발생" → 카카오 로그아웃 후 재시도
                    if (e?.message?.includes('마지막 로그인') || e?.message?.toLowerCase().includes('lastlogin')) {
                        try {
                            const m = require('@react-native-kakao/user');
                            if (m.logout) await m.logout();
                        } catch {}
                        nativeResult = await kakaoNativeLogin();
                    } else {
                        throw e;
                    }
                }
                console.log('[LoginModal] posting to /api/auth/kakao/native');
                const data = await api.post<LoginResponse>('/api/auth/kakao/native', {
                    accessToken: nativeResult.accessToken,
                });
                console.log('[LoginModal] API response user:', !!data.user, 'error:', data.error);
                if (data.user) {
                    await handleLoginSuccess(data.user, data.token);
                } else {
                    setError(data.error || i18n('authPage.login.errorLoginFailed'));
                }
                return;
            }

            // iOS: 웹 OAuth
            const result = await WebBrowser.openAuthSessionAsync(
                `${BASE_URL}/api/auth/kakao?next=mobile`,
                'duna://success',
            );
            if (result.type === 'success' && result.url) {
                const urlObj = new URL(result.url);
                const token = urlObj.searchParams.get('token');
                const userId = urlObj.searchParams.get('userId');
                if (!token) { setError(i18n('authPage.login.errorGeneric')); return; }
                saveAuthToken(token);
                if (userId) saveUserId(userId);
                await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
                onClose();
                router.replace('/(tabs)');
            } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
                setError(i18n('authPage.login.errorGeneric'));
            }
        } catch (e: any) {
            let detail = '';
            try { detail = JSON.stringify(e); } catch {}
            console.error('[LoginModal][outer] msg:', e?.message, 'code:', e?.code, 'name:', e?.name);
            console.error('[LoginModal][outer] JSON:', detail);
            if (!e?.message?.includes('cancel') && e?.code !== 'ECANCEL') {
                setError(`[${e?.name || 'Err'}] ${e?.message || detail || '알 수 없는 오류'}`);
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
            const data = await api.post<LoginResponse>('/api/auth/apple', {
                identityToken: credential.identityToken,
                authorizationCode: credential.authorizationCode,
                user: credential.user,
                fullName: credential.fullName,
            });
            if (data.user) {
                await handleLoginSuccess(data.user, data.token);
            } else {
                throw new Error(data.error || i18n('authPage.login.errorAppleFailed'));
            }
        } catch (e: any) {
            if (e.code !== 'ERR_REQUEST_CANCELED') {
                setError(e.message || i18n('authPage.login.errorGeneric'));
            }
        } finally {
            setLoading(false);
        }
    }

    if (!rendered) return null;

    return (
        <Modal
            visible={rendered}
            transparent
            animationType="none"
            onRequestClose={onClose}
            {...MODAL_ANDROID_PROPS}
        >
            <View style={StyleSheet.absoluteFillObject} pointerEvents={isClosing ? "none" : "auto"}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                    {sheetReady && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
                </Animated.View>

                <Animated.View
                    style={[styles.sheetWrap, { transform: [{ translateY }], maxHeight: maxH }]}
                >
                    <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: bottomPad }]}>
                        {/* 닫기 버튼 */}
                        <TouchableOpacity
                            style={[styles.closeBtn, { backgroundColor: t.surface }]}
                            onPress={onClose}
                            hitSlop={12}
                        >
                            <Ionicons name="close" size={16} color={t.textMuted} />
                        </TouchableOpacity>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={[styles.scrollInner, { paddingBottom: 4 }]}
                        >
                            {/* 아이콘 */}
                            <View style={styles.iconWrap}>
                                <View style={styles.iconPulse} />
                                <View style={styles.iconBox}>
                                    <Ionicons name="ticket-outline" size={30} color={Colors.white} style={{ transform: [{ rotate: '-12deg' }] }} />
                                    <View style={styles.sparkle}>
                                        <Ionicons name="sparkles" size={14} color="#fef08a" />
                                    </View>
                                </View>
                            </View>

                            {/* 제목 */}
                            <Text style={[styles.title, { color: t.text }]}>
                                {i18n('loginModal.sheetHeroBefore')}
                                <Text style={styles.titleHighlight}>{i18n('commonFallback.dona')}</Text>
                                {i18n('loginModal.sheetHeroAfter')}
                            </Text>

                            {/* 설명 */}
                            <Text style={[styles.desc, { color: t.textMuted }]}>
                                {i18n('loginModal.sheetDefaultDesc')}
                            </Text>

                            {/* 혜택 리스트 */}
                            <View style={[styles.benefitBox, { backgroundColor: t.isDark ? 'rgba(31,41,55,0.5)' : Colors.gray50, borderColor: t.border }]}>
                                <Text style={[styles.benefitLabel, { color: t.textMuted }]}>{i18n('loginModal.benefitsTitle')}</Text>
                                {benefitList.map((b, i) => (
                                    <View key={i} style={styles.benefitRow}>
                                        <View style={[styles.checkCircle, { backgroundColor: t.isDark ? 'rgba(16,185,129,0.2)' : Colors.emerald100 }]}>
                                            <Ionicons name="checkmark" size={12} color={Colors.emerald600} />
                                        </View>
                                        <Text style={[styles.benefitText, { color: t.text }]}>{b}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* 에러 메시지 */}
                            {!!error && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            {/* 소셜 로그인 버튼 */}
                            <View style={styles.socialRow}>
                                {Platform.OS === 'ios' && (
                                    <TouchableOpacity
                                        style={[styles.socialCircleApple, loading && styles.btnDisabled]}
                                        onPress={handleAppleLogin}
                                        disabled={loading}
                                        activeOpacity={0.85}
                                    >
                                        <AppleMark size={SOCIAL_MARK_SIZE} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.socialCircleKakao, loading && styles.btnDisabled]}
                                    onPress={handleKakaoLogin}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                >
                                    {loading
                                        ? <ActivityIndicator color="#3c1e1e" size="small" />
                                        : <KakaoMark size={SOCIAL_MARK_SIZE} />
                                    }
                                </TouchableOpacity>
                            </View>

                            {/* 이메일 로그인 링크 */}
                            <TouchableOpacity
                                style={styles.emailLink}
                                onPress={handleGoToLogin}
                                disabled={loading}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.emailLinkText, { color: t.textMuted }]}>
                                    {i18n('loginModal.cta')}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheetWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    sheet: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 16,
        maxHeight: '100%',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    scrollInner: {
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    iconWrap: {
        alignItems: 'center',
        marginBottom: 20,
    },
    iconPulse: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 24,
        backgroundColor: Colors.emerald500,
        opacity: 0.12,
        transform: [{ rotate: '12deg' }],
    },
    iconBox: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: Colors.emerald600,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.emerald600,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
        position: 'relative',
    },
    sparkle: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 10 : 8,
        right: Platform.OS === 'ios' ? 10 : 8,
    },
    title: {
        fontSize: FontSize['2xl'],
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginBottom: 8,
    },
    titleHighlight: {
        color: Colors.emerald600,
    },
    desc: {
        fontSize: FontSize.sm,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    benefitBox: {
        borderRadius: BorderRadius['2xl'],
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    benefitLabel: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    checkCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    benefitText: {
        fontSize: FontSize.sm,
        fontWeight: '500',
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        borderRadius: BorderRadius.lg,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    errorText: {
        fontSize: FontSize.sm,
        color: '#dc2626',
        textAlign: 'center',
    },
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 16,
    },
    socialCircleKakao: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEE500',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    socialCircleApple: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    emailLink: {
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 4,
    },
    emailLinkText: {
        fontSize: FontSize.sm,
        textDecorationLine: 'underline',
    },
});
