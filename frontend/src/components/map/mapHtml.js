// Builds the Leaflet page embedded in both the native WebView and the web
// iframe (see MapCanvas.native.js / MapCanvas.web.js). One HTML string drives
// both, so the map behaves identically cross-platform.
//
// Host <-> page messaging is a small JSON bridge, transport-agnostic on
// purpose: a WebView delivers postMessage to `document` on Android and to
// `window` on iOS, and an iframe delivers to `window`, so the page listens
// on both, and replies via window.ReactNativeWebView.postMessage when present
// (native) or window.parent.postMessage otherwise (web).
//
// Commands the host can send in: {type:'setDriver'|'clearDriver', lat, lng},
// {type:'setPicked', lat, lng}, {type:'center', lat, lng, zoom?}.
// Events the page sends out: {type:'picked', lat, lng} (tap in picker mode),
// {type:'ready'}.

const KATHMANDU = { lat: 27.7172, lng: 85.3240 };

const escapeJs = (value) => JSON.stringify(value ?? null);

// options:
//   interactive: tapping the map drops/moves a single marker and reports it
//   pickup / dropoff: {lat,lng} static markers shown on load
//   initialPicked: {lat,lng} starting marker for interactive mode
export const buildMapHtml = ({
  interactive = false,
  pickup = null,
  dropoff = null,
  initialPicked = null,
} = {}) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef1f3; }
    .flito-pin {
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4); border: 2px solid #fff;
    }
    .flito-pin span { transform: rotate(45deg); color: #fff; font-weight: 700; font-size: 12px; font-family: sans-serif; }
    .flito-dot {
      /* Distinct from the teal pickup pin so the two are never confused at a glance. */
      width: 18px; height: 18px; border-radius: 50%; background: #3498DB;
      border: 3px solid #fff; box-shadow: 0 0 0 2px #3498DB, 0 1px 4px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var INTERACTIVE = ${escapeJs(interactive)};
      var PICKUP = ${escapeJs(pickup)};
      var DROPOFF = ${escapeJs(dropoff)};
      var INITIAL_PICKED = ${escapeJs(initialPicked)};
      var DEFAULT_CENTER = ${escapeJs(KATHMANDU)};

      function sendToHost(data) {
        var msg = JSON.stringify(data);
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
        else if (window.parent) window.parent.postMessage(msg, '*');
      }

      function onHostMessage(handler) {
        var listener = function (event) {
          var data = event.data;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return; }
          }
          if (data && typeof data === 'object') handler(data);
        };
        document.addEventListener('message', listener);
        window.addEventListener('message', listener);
      }

      function pinIcon(color, label) {
        return L.divIcon({
          className: '',
          html: '<div class="flito-pin" style="background:' + color + '"><span>' + label + '</span></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
      }
      var dotIcon = L.divIcon({ className: '', html: '<div class="flito-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

      var start = PICKUP || DROPOFF || INITIAL_PICKED || DEFAULT_CENTER;
      var map = L.map('map', { zoomControl: true, attributionControl: true })
        .setView([start.lat, start.lng], (PICKUP || DROPOFF) ? 12 : 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      var bounds = [];
      var pickupMarker = null;
      var dropoffMarker = null;
      var driverMarker = null;
      var pickedMarker = null;

      if (PICKUP) {
        pickupMarker = L.marker([PICKUP.lat, PICKUP.lng], { icon: pinIcon('#00D2A2', 'P') }).addTo(map).bindPopup('Pickup');
        bounds.push([PICKUP.lat, PICKUP.lng]);
      }
      if (DROPOFF) {
        dropoffMarker = L.marker([DROPOFF.lat, DROPOFF.lng], { icon: pinIcon('#E74C3C', 'D') }).addTo(map).bindPopup('Dropoff');
        bounds.push([DROPOFF.lat, DROPOFF.lng]);
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      function setPicked(lat, lng) {
        if (pickedMarker) pickedMarker.setLatLng([lat, lng]);
        else pickedMarker = L.marker([lat, lng], { icon: pinIcon('#FF9F00', '•'), draggable: true }).addTo(map);
        pickedMarker.on('dragend', function () {
          var p = pickedMarker.getLatLng();
          sendToHost({ type: 'picked', lat: p.lat, lng: p.lng });
        });
      }

      if (INTERACTIVE) {
        if (INITIAL_PICKED) {
          setPicked(INITIAL_PICKED.lat, INITIAL_PICKED.lng);
          map.setView([INITIAL_PICKED.lat, INITIAL_PICKED.lng], 15);
        }
        map.on('click', function (e) {
          setPicked(e.latlng.lat, e.latlng.lng);
          sendToHost({ type: 'picked', lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      onHostMessage(function (msg) {
        if (msg.type === 'setDriver') {
          if (driverMarker) driverMarker.setLatLng([msg.lat, msg.lng]);
          else driverMarker = L.marker([msg.lat, msg.lng], { icon: dotIcon, zIndexOffset: 1000 }).addTo(map).bindPopup('Driver');
        } else if (msg.type === 'clearDriver') {
          if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
        } else if (msg.type === 'setPicked') {
          setPicked(msg.lat, msg.lng);
          map.setView([msg.lat, msg.lng], Math.max(map.getZoom(), 15));
        } else if (msg.type === 'center') {
          map.setView([msg.lat, msg.lng], msg.zoom || map.getZoom());
        } else if (msg.type === 'fitAll') {
          var all = bounds.slice();
          if (driverMarker) all.push(driverMarker.getLatLng());
          if (all.length > 1) map.fitBounds(all, { padding: [40, 40] });
          else if (all.length === 1) map.setView(all[0], 14);
        }
      });

      sendToHost({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
