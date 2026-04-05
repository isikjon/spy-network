import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Theme } from '@/constants/colors';
import { Translations } from '@/constants/locales';

interface TutorialProps {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  t: Translations;
}

const TOTAL_STEPS = 15;


export default function Tutorial({ visible, onClose, theme, t }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);

  const styles = createStyles(theme);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    setCurrentStep(1);
    onClose();
  };

  const handleSkip = () => {
    setCurrentStep(1);
    onClose();
  };

  const getStepContent = (): { title: string; text: string } => {
    switch (currentStep) {
      case 1:
        return {
          title: t.tutorial.step1Title,
          text: t.tutorial.step1Text,
        };
      case 2:
        return {
          title: t.tutorial.step2Title,
          text: t.tutorial.step2Text,
        };
      case 3:
        return {
          title: t.tutorial.step3Title,
          text: t.tutorial.step3Text,
        };
      case 4:
        return {
          title: t.tutorial.step4Title,
          text: t.tutorial.step4Text,
        };
      case 5:
        return {
          title: t.tutorial.step5Title,
          text: t.tutorial.step5Text,
        };
      case 6:
        return {
          title: t.tutorial.step6Title,
          text: t.tutorial.step6Text,
        };
      case 7:
        return {
          title: t.tutorial.step7Title,
          text: t.tutorial.step7Text,
        };
      case 8:
        return {
          title: t.tutorial.step8Title,
          text: t.tutorial.step8Text,
        };
      case 9:
        return {
          title: t.tutorial.step9Title,
          text: t.tutorial.step9Text,
        };
      case 10:
        return {
          title: t.tutorial.step10Title,
          text: t.tutorial.step10Text,
        };
      case 11:
        return {
          title: t.tutorial.step11Title,
          text: t.tutorial.step11Text,
        };
      case 12:
        return {
          title: t.tutorial.step12Title,
          text: t.tutorial.step12Text,
        };
      case 13:
        return {
          title: t.tutorial.step13Title,
          text: t.tutorial.step13Text,
        };
      case 14:
        return {
          title: t.tutorial.step14Title,
          text: t.tutorial.step14Text,
        };
      case 15:
        return {
          title: t.tutorial.step15Title,
          text: t.tutorial.step15Text,
        };
      default:
        return {
          title: t.tutorial.step1Title,
          text: t.tutorial.step1Text,
        };
    }
  };

  const content = getStepContent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            style={styles.closeButtonAbsolute}
          >
            <X size={24} color={theme.primary} />
          </TouchableOpacity>

          <View style={styles.fullScreenContent}>
            <Text style={styles.fullScreenTitle}>{content.title}</Text>
            <Text style={styles.fullScreenText}>
              {content.text}
            </Text>
          </View>

          <View style={styles.progressContainer}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index + 1 === currentStep && styles.progressDotActive,
                  index + 1 < currentStep && styles.progressDotComplete,
                ]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            {currentStep > 1 && (
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.7}
                style={styles.backButton}
              >
                <ChevronLeft size={20} color={theme.text} />
                <Text style={styles.backButtonText}>{t.tutorial.back}</Text>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            {currentStep < TOTAL_STEPS ? (
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.7}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>{t.tutorial.next}</Text>
                <ChevronRight size={20} color={theme.background} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleFinish}
                activeOpacity={0.7}
                style={styles.finishButton}
              >
                <Text style={styles.finishButtonText}>{t.tutorial.finish}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
    },
    fullScreenContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    fullScreenContent: {
      width: '100%',
      maxWidth: 500,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.background,
      padding: 32,
      marginBottom: 32,
    },
    fullScreenTitle: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 2,
      marginBottom: 16,
      textAlign: 'center',
    },
    fullScreenText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontFamily: 'monospace' as const,
      lineHeight: 22,
      textAlign: 'center',
    },
    closeButtonAbsolute: {
      position: 'absolute',
      top: 40,
      right: 20,
      padding: 8,
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.border,
    },
    progressContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 32,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.overlay,
      borderWidth: 1,
      borderColor: theme.border,
    },
    progressDotActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
      width: 24,
    },
    progressDotComplete: {
      backgroundColor: theme.primaryDim,
      borderColor: theme.primaryDim,
    },

    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 2,
      borderTopColor: theme.border,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.overlay,
    },
    backButtonText: {
      fontSize: 12,
      color: theme.text,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    nextButtonText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.background,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
    finishButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    finishButtonText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.background,
      fontFamily: 'monospace' as const,
      letterSpacing: 1,
    },
  });
