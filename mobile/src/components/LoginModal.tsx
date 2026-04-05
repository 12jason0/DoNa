/**
 * 로그인 바텀시트 모달
 * 웹 src/components/LoginModal.tsx 디자인과 동일
 */
import React from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useSlideModalAnimation } from '../hooks/useSlideModalAnimation';
import { useThemeColors } from '../hooks/useThemeColors';
import { modalBottomPadding } from '../utils/modalSafePadding';
import { MODAL_ANDROID_PROPS } from '../constants/modalAndroidProps';
import { Colors, FontSize, BorderRadius } from '../constants/theme';
import { useLocale } from '../lib/useLocale';
import { useModal } from '../lib/modalContext';

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

    const benefitList = [
        i18n('loginModal.presets.courseDetail.benefit0'),
        i18n('loginModal.presets.courseDetail.benefit1'),
        i18n('loginModal.presets.courseDetail.benefit2'),
    ];

    function handleLogin() {
        onClose();
        router.push('/(auth)/login' as any);
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

                            {/* CTA 버튼 */}
                            <TouchableOpacity
                                style={styles.ctaBtn}
                                onPress={handleLogin}
                                activeOpacity={0.88}
                            >
                                <Text style={styles.ctaText}>{i18n('loginModal.cta')}</Text>
                                <Ionicons name="sparkles" size={15} color={Colors.white} style={{ marginLeft: 6 }} />
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
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.emerald600,
        paddingVertical: 14,
        borderRadius: BorderRadius.full,
        shadowColor: Colors.emerald600,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: 8,
    },
    ctaText: {
        color: Colors.white,
        fontSize: FontSize.base,
        fontWeight: '500',
    },
});
