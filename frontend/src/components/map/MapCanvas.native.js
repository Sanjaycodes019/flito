import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';

// Native (Android) host for the Leaflet page: a WebView. `postMessage` on the
// exposed ref sends a command into the page; `onMapMessage` receives events
// the page sends back (see mapHtml.js for the message shapes).
const MapCanvas = forwardRef(({ html, onMapMessage, style }, ref) => {
  const webviewRef = useRef(null);

  useImperativeHandle(ref, () => ({
    postMessage: (data) => webviewRef.current?.postMessage(JSON.stringify(data)),
  }));

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      onMessage={(event) => {
        try {
          onMapMessage?.(JSON.parse(event.nativeEvent.data));
        } catch {
          // ignore malformed messages from the page
        }
      }}
      // The map itself is static once loaded; only Leaflet's own tile/JS
      // fetches need network access.
      javaScriptEnabled
      domStorageEnabled
    />
  );
});

export default MapCanvas;
