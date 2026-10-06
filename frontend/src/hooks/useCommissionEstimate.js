import { useEffect, useState } from 'react';
import { getCommissionEstimate } from '../services/commission';

// What FLITO's fee would be on the fare an owner is typing ({ amount, reason }),
// asked of the server once they pause typing. Null while unknown, or if it
// couldn't be fetched: a hint beside the offer, never in its way.
const useCommissionEstimate = (fare, enabled = true) => {
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    const value = Number(fare);
    if (!enabled || !Number.isInteger(value) || value < 1) {
      setEstimate(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      getCommissionEstimate(value)
        .then((data) => { if (active) setEstimate(data); })
        .catch(() => { if (active) setEstimate(null); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [fare, enabled]);

  return estimate;
};

export default useCommissionEstimate;
