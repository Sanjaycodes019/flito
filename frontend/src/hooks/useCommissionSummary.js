import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getMyCommission } from '../services/commission';

// A truck owner's FLITO fees at a glance ({ summary, rules }), refreshed each
// time the screen using it comes into view. Null until loaded, when `enabled`
// is false (anyone but an owner), or if it couldn't be loaded: a reminder,
// never something a screen depends on.
const useCommissionSummary = (enabled) => {
  const [fees, setFees] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let active = true;
      getMyCommission()
        .then((data) => { if (active) setFees({ summary: data.summary, rules: data.rules }); })
        .catch(() => {});
      return () => { active = false; };
    }, [enabled])
  );

  return fees;
};

export default useCommissionSummary;
