/**
 * 회원가입 화면
 * 웹 src/app/(home)/signup/page.tsx 기반으로 1:1 재현
 *
 * 순서: 소셜(카카오/Apple) → 구분선 → 이메일 폼
 * 필드: nickname*, email*, password*, confirmPassword*, ageRange(선택), gender(선택)
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
    Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { login as kakaoNativeLogin } from '@react-native-kakao/user';
import { useQueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';

import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../src/constants/theme';
import { api, endpoints, BASE_URL } from '../../src/lib/api';
import { saveAuthToken, saveUserId } from '../../src/lib/mmkv';
import { AUTH_QUERY_KEY } from '../../src/hooks/useAuth';
import AppHeader from '../../src/components/AppHeader';
import StandaloneTabBar from '../../src/components/StandaloneTabBar';
import { AppleMark, KakaoMark, SOCIAL_MARK_SIZE } from '../../src/components/auth/SocialLoginMarks';
import { MODAL_ANDROID_PROPS } from '../../src/constants/modalAndroidProps';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const AGE_RANGES = ['10대', '20대', '30대', '40대', '50대'] as const;
const GENDERS = [
    { label: '남성', value: '남성' },
    { label: '여성', value: '여성' },
    { label: '기타', value: '기타' },
] as const;

type PickerField = 'ageRange' | 'gender' | null;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function SignupScreen() {
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();

    const [form, setForm] = useState({
        nickname: '',
        email: '',
        password: '',
        confirmPassword: '',
        ageRange: '',
        gender: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [pickerField, setPickerField] = useState<PickerField>(null);

    function setField(key: keyof typeof form, value: string) {
        setForm(prev => ({ ...prev, [key]: value }));
        if (error) setError('');
    }

    // ─── 소셜 로그인 성공 공통 처리 ────────────────────────────────────────────

    async function handleSocialSuccess(userId?: number, token?: string) {
        if (token) saveAuthToken(token);
        if (userId) {
            saveUserId(String(userId));
            try { await Purchases.logIn(String(userId)); } catch {}
        }
        await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        router.replace('/(tabs)');
    }

    // ─── 카카오 ────────────────────────────────────────────────────────────────
    // Android: 네이티브 Kakao SDK, iOS: 웹 OAuth

    async function handleKakao() {
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            if (Platform.OS === 'android') {
                const kakaoToken = await kakaoNativeLogin();
                const data = await api.post<{ user?: { id: number }; token?: string; error?: string }>(
                    '/api/auth/kakao/native',
                    { accessToken: kakaoToken.accessToken },
                );
                if (data.user) {
                    await handleSocialSuccess(data.user.id, data.token);
                } else {
                    setError(data.error || '카카오 로그인에 실패했습니다.');
                }
            } else {
                const result = await WebBrowser.openAuthSessionAsync(
                    `${BASE_URL}/api/auth/kakao?next=mobile`,
                    'duna://success',
                );
                if (result.type === 'success') {
                    await handleSocialSuccess();
                }
            }
        } catch (e: any) {
            if (!e?.message?.includes('cancel') && e?.code !== 'ECANCEL') {
                setError('카카오 로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    }

    // ─── Apple ─────────────────────────────────────────────────────────────────

    async function handleApple() {
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
            const data = await api.post<{ user?: { id: number }; error?: string }>(
                endpoints.appleAuth,
                {
                    identityToken: credential.identityToken,
                    authorizationCode: credential.authorizationCode,
                    fullName: credential.fullName,
                    email: credential.email,
                },
            );
            if (!data.user) throw new Error(data.error || 'Apple 로그인에 실패했습니다.');
            await handleSocialSuccess(data.user.id);
        } catch (e: any) {
            if (e.code !== 'ERR_REQUEST_CANCELED') {
                setError(e.message || 'Apple 로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    }

    // ─── 이메일 회원가입 ───────────────────────────────────────────────────────

    async function handleSubmit() {
        if (loading) return;

        // 유효성 검사
        if (!form.nickname.trim() || form.nickname.length < 2) {
            setError('닉네임은 2자 이상 입력해주세요.');
            return;
        }
        if (!form.email.includes('@')) {
            setError('유효한 이메일을 입력해주세요.');
            return;
        }
        if (form.password.length < 6) {
            setError('비밀번호는 6자 이상 입력해주세요.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await api.post<{ user?: { id: number }; error?: string }>(
                '/api/auth/signup',
                {
                    email: form.email,
                    password: form.password,
                    nickname: form.nickname.trim(),
                    ageRange: form.ageRange || undefined,
                    gender: form.gender || undefined,
                },
            );

            if (data.user) {
                await handleSocialSuccess(data.user.id);
            } else {
                setError(data.error || '회원가입에 실패했습니다.');
            }
        } catch (e: any) {
            setError(e.message || '오류가 발생했습니다. 다시 시도해주세요.');
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
                    <View style={styles.card}>
                        {/* 헤더 */}
                        <View style={styles.header}>
                            <Text style={styles.brandTitle}>
                                DoNa<Text style={styles.brandDot}>.</Text>
                            </Text>
                            <Text style={styles.tagline}>특별한 데이트의 시작</Text>
                        </View>

                        {/* 에러 */}
                        {!!error && (
                            <View style={styles.msgError}>
                                <Text style={styles.msgErrorText}>⚠️ {error}</Text>
                            </View>
                        )}

                        {/* 소셜 — 원형 아이콘 */}
                        <View style={styles.socialRow}>
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={[styles.socialCircleApple, loading && styles.btnDisabled]}
                                    onPress={handleApple}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Apple로 가입"
                                >
                                    <AppleMark size={SOCIAL_MARK_SIZE} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.socialCircleKakao, loading && styles.btnDisabled]}
                                onPress={handleKakao}
                                disabled={loading}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="카카오로 시작하기"
                            >
                                <KakaoMark size={SOCIAL_MARK_SIZE} />
                            </TouchableOpacity>
                        </View>

                        {/* 구분선 */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>이메일로 가입</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* 폼 */}
                        <View style={styles.formGroup}>
                            <Field label="닉네임" required>
                                <TextInput
                                    style={styles.input}
                                    placeholder="2자 이상 입력"
                                    placeholderTextColor={Colors.gray400}
                                    value={form.nickname}
                                    onChangeText={v => setField('nickname', v)}
                                    editable={!loading}
                                />
                            </Field>

                            <Field label="이메일" required>
                                <TextInput
                                    style={styles.input}
                                    placeholder="이메일 주소"
                                    placeholderTextColor={Colors.gray400}
                                    value={form.email}
                                    onChangeText={v => setField('email', v)}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    editable={!loading}
                                />
                            </Field>

                            <Field label="비밀번호" required>
                                <TextInput
                                    style={styles.input}
                                    placeholder="6자 이상"
                                    placeholderTextColor={Colors.gray400}
                                    value={form.password}
                                    onChangeText={v => setField('password', v)}
                                    secureTextEntry
                                    autoComplete="new-password"
                                    editable={!loading}
                                />
                            </Field>

                            <Field label="비밀번호 확인" required>
                                <TextInput
                                    style={styles.input}
                                    placeholder="비밀번호 재입력"
                                    placeholderTextColor={Colors.gray400}
                                    value={form.confirmPassword}
                                    onChangeText={v => setField('confirmPassword', v)}
                                    secureTextEntry
                                    editable={!loading}
                                />
                            </Field>

                            {/* 연령대 + 성별 (2열) */}
                            <View style={styles.twoCol}>
                                <View style={styles.colItem}>
                                    <Text style={styles.label}>
                                        연령대 <Text style={styles.optional}>(선택)</Text>
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.selectBtn}
                                        onPress={() => setPickerField('ageRange')}
                                        disabled={loading}
                                    >
                                        <Text style={form.ageRange ? styles.selectValue : styles.selectPlaceholder}>
                                            {form.ageRange || '선택'}
                                        </Text>
                                        <Text style={styles.chevron}>▾</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.colItem}>
                                    <Text style={styles.label}>
                                        성별 <Text style={styles.optional}>(선택)</Text>
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.selectBtn}
                                        onPress={() => setPickerField('gender')}
                                        disabled={loading}
                                    >
                                        <Text style={form.gender ? styles.selectValue : styles.selectPlaceholder}>
                                            {form.gender || '선택'}
                                        </Text>
                                        <Text style={styles.chevron}>▾</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* 제출 */}
                        <TouchableOpacity
                            style={[styles.btnSubmit, loading && styles.btnDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.white} size="small" />
                            ) : (
                                <Text style={styles.btnSubmitText}>가입하기</Text>
                            )}
                        </TouchableOpacity>

                        {/* 로그인 링크 */}
                        <View style={styles.loginRow}>
                            <Text style={styles.loginText}>이미 계정이 있으신가요? </Text>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Text style={styles.loginLink}>로그인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* 연령대/성별 선택 모달 */}
            <Modal
                visible={pickerField !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerField(null)}
                {...MODAL_ANDROID_PROPS}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setPickerField(null)}
                >
                    <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 40) }]}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>
                            {pickerField === 'ageRange' ? '연령대 선택' : '성별 선택'}
                        </Text>

                        {pickerField === 'ageRange' &&
                            AGE_RANGES.map(age => (
                                <TouchableOpacity
                                    key={age}
                                    style={[
                                        styles.optionRow,
                                        form.ageRange === age && styles.optionRowActive,
                                    ]}
                                    onPress={() => {
                                        setField('ageRange', age);
                                        setPickerField(null);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.optionText,
                                            form.ageRange === age && styles.optionTextActive,
                                        ]}
                                    >
                                        {age}
                                    </Text>
                                    {form.ageRange === age && <Text style={styles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            ))}

                        {pickerField === 'gender' &&
                            GENDERS.map(g => (
                                <TouchableOpacity
                                    key={g.value}
                                    style={[
                                        styles.optionRow,
                                        form.gender === g.value && styles.optionRowActive,
                                    ]}
                                    onPress={() => {
                                        setField('gender', g.value);
                                        setPickerField(null);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.optionText,
                                            form.gender === g.value && styles.optionTextActive,
                                        ]}
                                    >
                                        {g.label}
                                    </Text>
                                    {form.gender === g.value && (
                                        <Text style={styles.checkmark}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                    </View>
                </TouchableOpacity>
            </Modal>
            <StandaloneTabBar />
        </SafeAreaView>
    );
}

// ─── Field 래퍼 컴포넌트 ──────────────────────────────────────────────────────

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>
                {label}
                {required && <Text style={styles.required}> *</Text>}
            </Text>
            {children}
        </View>
    );
}

// ─── 스타일 (웹 signup/page.tsx Tailwind → StyleSheet 변환) ──────────────────

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    flex: { flex: 1 },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Spacing[4],
        paddingBottom: 120,
    },

    // ── 카드 (bg-white rounded-xl border p-8 shadow-sm) ───────────────────────
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
    brandTitle: {
        fontSize: FontSize['3xl'],
        fontWeight: '800',
        color: Colors.gray900,
        letterSpacing: -1,
    },
    brandDot: {
        color: Colors.emerald600,
    },
    tagline: {
        marginTop: Spacing[1],
        fontSize: FontSize.sm,
        color: Colors.gray500,
        fontWeight: '500',
    },

    // ── 에러 ──────────────────────────────────────────────────────────────────
    msgError: {
        marginBottom: Spacing[4],
        padding: Spacing[4],
        backgroundColor: Colors.red50,
        borderWidth: 1,
        borderColor: Colors.red200,
        borderRadius: BorderRadius.xl,
    },
    msgErrorText: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: Colors.red600,
    },

    // ── 소셜 — 원형 아이콘 ───────────────────────────────────────────────────
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        marginBottom: Spacing[6],
    },
    socialCircleKakao: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEE500',
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.sm,
    },
    socialCircleApple: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.sm,
    },

    // ── 구분선 ─────────────────────────────────────────────────────────────────
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing[6],
    },
    dividerLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.gray100,
    },
    dividerText: {
        marginHorizontal: Spacing[4],
        fontSize: FontSize.sm,
        color: Colors.gray400,
        fontWeight: '500',
    },

    // ── 폼 ────────────────────────────────────────────────────────────────────
    formGroup: { gap: 12, marginBottom: Spacing[5] },
    fieldGroup: {},
    label: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        color: Colors.gray700,
        marginBottom: 6,
        marginLeft: 2,
    },
    required: { color: Colors.emerald500 },
    optional: { color: Colors.gray400, fontWeight: '400' },

    // input (bg-gray-50 rounded-lg px-4 py-3.5)
    input: {
        width: '100%',
        paddingHorizontal: Spacing[4],
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.gray50,
        fontSize: FontSize.sm,
        color: Colors.gray900,
        fontWeight: '500',
    },

    // 2열 (연령대+성별)
    twoCol: { flexDirection: 'row', gap: 12 },
    colItem: { flex: 1 },
    selectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing[4],
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: Colors.gray200,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.gray50,
    },
    selectValue: {
        fontSize: FontSize.sm,
        color: Colors.gray900,
        fontWeight: '500',
    },
    selectPlaceholder: {
        fontSize: FontSize.sm,
        color: Colors.gray400,
    },
    chevron: { color: Colors.gray500, fontSize: 12 },

    // ── 제출 버튼 (bg-emerald-600) ────────────────────────────────────────────
    btnSubmit: {
        backgroundColor: Colors.emerald600,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing[4],
        minHeight: 50,
        ...Shadow.sm,
    },
    btnSubmitText: {
        color: Colors.white,
        fontSize: FontSize.base,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    btnDisabled: { opacity: 0.5 },

    // ── 로그인 링크 ────────────────────────────────────────────────────────────
    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    loginText: { fontSize: FontSize.sm, color: Colors.gray500 },
    loginLink: {
        fontSize: FontSize.sm,
        color: Colors.emerald600,
        fontWeight: '700',
    },

    // ── 선택 모달 ──────────────────────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: BorderRadius['2xl'],
        borderTopRightRadius: BorderRadius['2xl'],
        paddingHorizontal: Spacing[4],
        paddingBottom: 40,
        paddingTop: Spacing[3],
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.gray200,
        alignSelf: 'center',
        marginBottom: Spacing[4],
    },
    modalTitle: {
        fontSize: FontSize.md,
        fontWeight: '700',
        color: Colors.gray900,
        marginBottom: Spacing[3],
        paddingHorizontal: Spacing[2],
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: Spacing[2],
        borderRadius: BorderRadius.lg,
    },
    optionRowActive: {
        backgroundColor: Colors.green50,
    },
    optionText: {
        fontSize: FontSize.base,
        color: Colors.gray700,
    },
    optionTextActive: {
        color: Colors.emerald600,
        fontWeight: '600',
    },
    checkmark: {
        color: Colors.emerald600,
        fontSize: FontSize.md,
        fontWeight: '700',
    },
});
