import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FieldColors, FieldTypography } from '../constants/FieldTokens';

interface KnurledButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const KnurledButton: React.FC<KnurledButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  style,
  textStyle,
}) => {
  const handlePress = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) return '#2A302B';
    switch (variant) {
      case 'primary':
        return FieldColors.rescueOrange;
      case 'accent':
        return FieldColors.contourOchre;
      case 'danger':
        return '#EF4444';
      case 'secondary':
      default:
        return FieldColors.deepPine;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#666';
    switch (variant) {
      case 'primary':
        return '#0F1210';
      case 'accent':
        return '#0F1210';
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
      default:
        return FieldColors.parchment;
    }
  };

  const getBorderColor = () => {
    if (disabled) return '#333';
    switch (variant) {
      case 'primary':
        return '#FFAA00';
      case 'accent':
        return '#F59E0B';
      case 'danger':
        return '#B91C1C';
      case 'secondary':
      default:
        return '#2E3832';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.base,
        styles[size],
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.text,
          styles[`text_${size}`],
          { color: getTextColor() },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    borderBottomWidth: 3,
  },
  sm: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  md: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  lg: {
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  iconContainer: {
    marginRight: 6,
  },
  text: {
    fontFamily: FieldTypography.mono,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  text_sm: {
    fontSize: 11,
  },
  text_md: {
    fontSize: 13,
  },
  text_lg: {
    fontSize: 15,
  },
});
