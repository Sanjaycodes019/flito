import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';
import { QUICK_LINKS } from '../pages';
import useOpenPage from '../useOpenPage';

const QuickLink = ({ label, onPress, small }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      hitSlop={6}
    >
      <Text style={[small ? styles.small : styles.text, hovered && styles.hovered]}>{label}</Text>
    </Pressable>
  );
};

// About · Help · Terms · Privacy, as one quiet row: at the foot of the log in
// pages, and under the account card in the laptop sidebar.
const QuickLinks = ({ small = false, align = 'center', style }) => {
  const { t } = useTranslation();
  const { openPage } = useOpenPage();
  return (
    <View
      style={[styles.row, { justifyContent: align === 'center' ? 'center' : 'flex-start' }, style]}
      accessibilityLabel={t('site:quickLinks.label')}
    >
      {QUICK_LINKS.map((key, index) => (
        <React.Fragment key={key}>
          {index > 0 ? <Text style={styles.dot} accessible={false}>·</Text> : null}
          <QuickLink label={t(`site:pages.${key}.label`)} onPress={() => openPage(key)} small={small} />
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xs },
  text: { ...type.small, color: colors.textMuted },
  small: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  hovered: { color: colors.textLink, textDecorationLine: 'underline' },
  dot: { ...type.small, color: colors.textMuted },
}));

export default QuickLinks;
