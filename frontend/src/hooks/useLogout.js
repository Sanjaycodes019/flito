import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { logout } from '../redux/slices/authSlice';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { confirmAction } from '../utils/alert';

// Asks for confirmation, then signs out and drops the live connection.
const useLogout = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  return () => confirmAction({
    title: t('profile:logout.title'),
    message: t('profile:logout.message'),
    confirmLabel: t('profile:logout.confirmLabel'),
    destructive: true,
    onConfirm: async () => {
      await authService.logout();
      socketService.disconnect();
      dispatch(logout());
    },
  });
};

export default useLogout;
