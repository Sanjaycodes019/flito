import React from 'react';
import { View } from 'react-native';
import i18n from '../../i18n';
import { colors, themedStyles } from '../../theme/tokens';
import EmptyState from './EmptyState';

// Catches render errors anywhere below it so one broken screen shows a
// recoverable message instead of a blank white app.
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) this.props.onError(error, info);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <EmptyState
          icon="warning"
          tone="error"
          title={i18n.t('common:errorBoundary.title')}
          message={i18n.t('common:errorBoundary.message')}
          actionLabel={i18n.t('common:errorBoundary.retry')}
          onAction={this.reset}
        />
      </View>
    );
  }
}

const styles = themedStyles(() => ({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
}));
