import React, { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';

// Web host for the Leaflet page: an iframe with the HTML injected via
// srcDoc. `postMessage` on the exposed ref sends a command into the page
// via contentWindow; `onMapMessage` receives events the page posts back
// (see mapHtml.js for the message shapes). Using an iframe (rather than a
// `<div>` + Leaflet in the RN Web bundle directly) keeps this component's
// implementation identical in shape to the native WebView version, and
// gives Leaflet an isolated document rather than sharing one with the app.
const MapCanvas = forwardRef(({ html, onMapMessage, style }, ref) => {
  const iframeRef = useRef(null);
  const [frameId] = useState(() => `flito-map-${Math.random().toString(36).slice(2)}`);

  useImperativeHandle(ref, () => ({
    postMessage: (data) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify(data), '*'),
  }));

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      try {
        onMapMessage?.(JSON.parse(event.data));
      } catch {
        // ignore malformed messages from the page
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMapMessage]);

  return (
    <iframe
      id={frameId}
      ref={iframeRef}
      title="Map"
      srcDoc={html}
      style={{ border: 0, width: '100%', height: '100%', ...style }}
    />
  );
});

export default MapCanvas;
