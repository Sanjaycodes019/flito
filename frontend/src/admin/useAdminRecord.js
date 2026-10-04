import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { getErrorMessage } from '../utils/helpers';

// One record's admin page: GET `endpoint` (e.g. /admin/users/:id), kept fresh
// whenever the page comes back into view, since an action on a linked record
// (approving a user's truck) can change what this page shows.
//
//   const record = useAdminRecord(`/admin/users/${userId}`);
//   record.data       the response body, or null until the first load
//   record.loading    true until the first load settles
//   record.error      { message, notFound } when it failed
//   record.refresh()  load it again (returns a promise)
//   record.replace(body)  swap in the body an action answered with
const useAdminRecord = (endpoint) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latest.current;
    try {
      const { data: body } = await api.get(endpoint);
      if (requestId !== latest.current) return;
      setData(body);
      setError(null);
    } catch (err) {
      if (requestId !== latest.current) return;
      setError({ message: getErrorMessage(err), notFound: err?.response?.status === 404 });
    }
    if (requestId === latest.current) setLoading(false);
  }, [endpoint]);

  // A different record in the same screen starts from a clean slate.
  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
  }, [endpoint]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const replace = useCallback((body) => setData((current) => ({ ...current, ...body })), []);

  return { data, error, loading, refresh, replace };
};

export default useAdminRecord;
