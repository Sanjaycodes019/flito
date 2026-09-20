import React from 'react';
import { View, Text } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

// The repeated shape of every role dashboard tile on HomeScreen: an icon,
// a title (with an optional count), a description or a large stat value,
// and a single primary action. Keeping this as one component is what makes
// the shipper/owner/driver/admin dashboards read as the same app.
//
// The card fills its grid cell and the text area takes up any spare height,
// so action buttons line up along the bottom of a row of cards.
const DashboardCard = ({ icon, title, description, value, actionLabel, onAction, variant = 'primary', style }) => (
  <Card style={[styles.card, style]}>
    <View style={styles.header}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={iconSize.lg} color={colors.primaryText} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>

    <View style={styles.body}>
      {value != null ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        !!description && <Text style={styles.description}>{description}</Text>
      )}
    </View>

    <Button title={actionLabel} onPress={onAction} variant={variant} />
  </Card>
);

const styles = themedStyles(() => ({
  card: { flex: 1, marginVertical: 0 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: { ...type.h3, color: colors.textPrimary, flex: 1 },
  body: { flexGrow: 1 },
  description: { ...type.small, color: colors.textMuted, marginBottom: spacing.md },
  value: { ...type.display, color: colors.primaryText, marginVertical: spacing.sm },
}));

export default DashboardCard;
