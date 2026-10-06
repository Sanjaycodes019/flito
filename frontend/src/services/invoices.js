import { Linking, Platform } from 'react-native';
import api, { API_BASE_URL } from './api';

// A completed trip's invoice is a PDF the server draws. The app asks for a
// short-lived link to it and hands that to the browser, which downloads the
// file itself: on the web it saves straight away, on a phone the browser
// opens or saves it. Nothing is written to the device by the app.
export const downloadInvoice = async (bookingId) => {
  const { data } = await api.post(`/bookings/${bookingId}/invoice-link`);
  const url = `${API_BASE_URL}${data.path}`;

  if (Platform.OS === 'web') {
    // A link click, not window.open, so a popup blocker can't stop it after
    // the request above. The server sends it as an attachment, so the page
    // stays where it is.
    const link = document.createElement('a');
    link.href = url;
    link.download = data.fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    await Linking.openURL(url);
  }
  return data.invoice;
};
