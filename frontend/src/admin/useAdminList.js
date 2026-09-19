import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const SEARCH_DELAY_MS = 350;

// One paginated admin list with server-side search and filters. Changing the
// search text or a filter goes back to page 1; typing is debounced so the
// server isn't asked on every keystroke; and a slow response that arrives
// after a newer request is discarded instead of overwriting it.
//
//   const list = useAdminList('/admin/users', 'users', { pageSize: 12 });
//   list.items, list.page, list.totalPages, list.total, list.loading
//   list.search / list.setSearch, list.filters / list.setFilter(key, value)
//   list.pageSize / list.setPageSize, list.dirty / list.clear()
//   list.goTo(page), list.refresh()
const useAdminList = (endpoint, itemsKey, { pageSize: initialPageSize = 12, initialFilters = {} } = {}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [result, setResult] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const goTo = useCallback(async (page = 1) => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, {
        params: { ...filters, q: debouncedSearch || undefined, page, limit: pageSize },
      });
      if (requestId !== latestRequest.current) return;
      const items = data[itemsKey];
      // A decision can empty out the last page; step back rather than leave
      // the admin on a blank page that no longer exists.
      if (items.length === 0 && page > 1) {
        await goTo(page - 1);
        return;
      }
      setResult({ items, page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (error) {
      if (requestId === latestRequest.current) notify(t('admin:common.error'), getErrorMessage(error));
    }
    if (requestId === latestRequest.current) setLoading(false);
  }, [endpoint, itemsKey, pageSize, filters, debouncedSearch, t]);

  // Runs on mount and whenever the search text or a filter changes.
  useEffect(() => { goTo(1); }, [goTo]);

  const setFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }, []);

  const refresh = useCallback(() => goTo(result.page), [goTo, result.page]);

  // Back to the page's own starting view: no search text, its default filters.
  const clear = useCallback(() => {
    setSearch('');
    setFilters(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = Boolean(search.trim()) || Object.keys({ ...filters, ...initialFilters }).some((key) => filters[key] !== initialFilters[key]);

  return { ...result, loading, pageSize, setPageSize, search, setSearch, filters, setFilter, dirty, clear, goTo, refresh };
};

export default useAdminList;
