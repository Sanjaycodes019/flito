import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from '../common/Card';
import Button from '../common/Button';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

// The repeated shape of every role dashboard tile on HomeScreen: an icon,
// a title (with an optional count), a description or a large stat value,
// and a single primary action. Keeping this as one component is what makes
// the shipper/owner/driver/admin dashboards read as the same app.
const DashboardCard = ({ icon, title, description, value, actionLabel, onAction, variant = 'primary' }) => (
  <Card style={styles.card}>
    <View style={styles.header}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={iconSize.lg} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>

    {value != null ? (
      <Text style={styles.value}>{value}</Text>
    ) : (
      !!description && <Text style={styles.description}>{description}</Text>
    )}

    <Button title={actionLabel} onPress={onAction} variant={variant} />
  </Card>
);

const styles = StyleSheet.create({
  card: { marginVertical: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: { ...type.h3, color: colors.textPrimary, flex: 1 },
  description: { ...type.small, color: colors.textMuted, marginBottom: spacing.md },
  value: { ...type.display, color: colors.primary, marginVertical: spacing.sm },
});

export default DashboardCard;
