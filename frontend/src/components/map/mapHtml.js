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
// Commands the host can send in:
//   {type:'setDriver', lat, lng, heading?, accuracy?, stale?}, {type:'clearDriver'}
//   {type:'setStops', pickup?, dropoff?, approximate?: {pickup, dropoff}}
//   {type:'setRoute', line: [[lat,lng], ...]}, {type:'clearRoute'}
//   {type:'setProgress', index, point: [lat,lng]} (where the truck is on the route)
//   {type:'follow', on}, {type:'fitAll'}, {type:'gestures', mode: 'cooperative'|'greedy'}
//   {type:'setPicked', lat, lng}, {type:'clearPicked'}, {type:'center', lat, lng, zoom?}
// Events the page sends out: {type:'picked', lat, lng} (tap in picker mode),
// {type:'userMoved'} (the viewer dragged the map), {type:'ready'}.

const KATHMANDU = { lat: 27.7172, lng: 85.3240 };

const escapeJs = (value) => JSON.stringify(value ?? null);

// options:
//   interactive: tapping the map drops/moves a single marker and reports it
//   pickup / dropoff: {lat,lng} static markers shown on load
//   initialPicked: {lat,lng} starting marker for interactive mode
//   labels: { pickup, dropoff, driver, approximate, twoFingers, clickToZoom }
//     text for the markers' popups and gesture hints, in the app's current
//     language (defaults to English so existing callers that don't pass it
//     keep working)
//   gestures: 'cooperative' (the default) for a map inside a scrolling page:
//     a phone moves it with two fingers and a mouse wheel zooms it only after
//     a click, so the page still scrolls past it; 'greedy' when the map has
//     the screen to itself
export const buildMapHtml = ({
  interactive = false,
  pickup = null,
  dropoff = null,
  initialPicked = null,
  labels = {},
  gestures = 'cooperative',
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
    /* A stop with no exact pin sits at its municipality's centre: shown faded and dashed. */
    .flito-pin.approx { opacity: 0.7; border-style: dashed; }
    .flito-dot {
      /* Distinct from the teal pickup pin so the two are never confused at a glance. */
      width: 18px; height: 18px; border-radius: 50%; background: #3498DB;
      border: 3px solid #fff; box-shadow: 0 0 0 2px #3498DB, 0 1px 4px rgba(0,0,0,0.4);
    }
    /* The truck: an orange disc with an arrow turned to its heading, and a
       pulse while its position is fresh. */
    .flito-truck { position: relative; width: 36px; height: 36px; }
    .flito-truck-pulse {
      position: absolute; inset: 0; border-radius: 50%; background: rgba(255, 159, 0, 0.35);
      animation: flito-pulse 1.8s ease-out infinite;
    }
    .flito-truck-body {
      position: absolute; left: 7px; top: 7px; width: 22px; height: 22px; border-radius: 50%;
      background: #FF9F00; border: 2px solid #fff; box-sizing: border-box;
      box-shadow: 0 1px 5px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
    }
    .flito-truck-arrow { width: 14px; height: 14px; transition: transform 0.6s ease; }
    .flito-truck-centre { display: none; width: 6px; height: 6px; border-radius: 50%; background: #fff; }
    .flito-truck.no-heading .flito-truck-arrow { display: none; }
    .flito-truck.no-heading .flito-truck-centre { display: block; }
    .flito-truck.stale .flito-truck-pulse { display: none; }
    .flito-truck.stale .flito-truck-body { background: #8A97A3; }
    @keyframes flito-pulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
    .flito-hint {
      position: absolute; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box; background: rgba(18, 22, 26, 0.5); color: #fff;
      font: 600 15px/1.4 sans-serif; text-align: center; opacity: 0; pointer-events: none; transition: opacity 0.2s;
    }
    .flito-hint.on { opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      .flito-truck-pulse { animation: none; opacity: 0.5; }
      .flito-truck-arrow, .flito-hint { transition: none; }
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
      var PICKUP_LABEL = ${escapeJs(labels.pickup || 'Pickup')};
      var DROPOFF_LABEL = ${escapeJs(labels.dropoff || 'Dropoff')};
      var DRIVER_LABEL = ${escapeJs(labels.driver || 'Truck')};
      var APPROXIMATE_LABEL = ${escapeJs(labels.approximate || 'approximate area')};
      var TWO_FINGERS_LABEL = ${escapeJs(labels.twoFingers || 'Use two fingers to move the map')};
      var CLICK_TO_ZOOM_LABEL = ${escapeJs(labels.clickToZoom || 'Click the map to zoom with the mouse wheel')};
      var GESTURES = ${escapeJs(gestures)};
      // A finger, not a mouse: phones, tablets and the Android app.
      var COARSE_POINTER = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

      var ROUTE_COLOR = '#1D6CA1';
      var DRIVEN_COLOR = '#8A97A3';
      var ANIMATION_MS = 1200;

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

      function pinIcon(color, label, approximate) {
        return L.divIcon({
          className: '',
          html: '<div class="flito-pin' + (approximate ? ' approx' : '') + '" style="background:' + color + '"><span>' + label + '</span></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
      }
      var truckIcon = L.divIcon({
        className: '',
        html: '<div class="flito-truck no-heading"><div class="flito-truck-pulse"></div><div class="flito-truck-body">'
          + '<svg class="flito-truck-arrow" viewBox="0 0 24 24"><path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="#fff"/></svg>'
          + '<div class="flito-truck-centre"></div></div></div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      var start = PICKUP || DROPOFF || INITIAL_PICKED || DEFAULT_CENTER;
      var map = L.map('map', { zoomControl: true, attributionControl: true })
        .setView([start.lat, start.lng], (PICKUP || DROPOFF) ? 12 : 14);

      // Tiles are fetched only once panning or zooming stops, and only one ring
      // beyond the screen is kept: fewer downloads on a phone's data plan and
      // less load on OpenStreetMap's free tile servers.
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        keepBuffer: 1,
        updateWhenIdle: true,
        updateWhenZooming: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);

      var pickupMarker = null;
      var dropoffMarker = null;
      var driverMarker = null;
      var accuracyCircle = null;
      var pickedMarker = null;
      var routeLine = null;
      var routeCasing = null;
      var routeAhead = null;
      var routeDriven = null;
      var follow = false;
      var animation = null;

      // Moves the page makes itself (fitting, following the truck) must not
      // count as the viewer looking around. Leaflet starts an animated zoom
      // on the next frame, so the page's own moves get a short grace period.
      var ownMoveUntil = 0;
      var viewerMoved = false;
      function moveOnPurpose(fn) {
        ownMoveUntil = Date.now() + 500;
        fn();
      }
      map.on('movestart', function () {
        if (Date.now() > ownMoveUntil) viewerMoved = true;
      });
      // Dragging (not zooming) is what takes the map off the truck.
      map.on('dragstart', function () { sendToHost({ type: 'userMoved' }); });

      // A map inside a scrolling page that takes every swipe or wheel turn
      // traps the page. Unless it has the screen to itself, a finger moves it
      // with two fingers (one scrolls the page past it) and a mouse wheel
      // zooms it only after a click, with a short hint when someone tries.
      var gestures = GESTURES;
      var hint = document.createElement('div');
      hint.className = 'flito-hint';
      document.body.appendChild(hint);
      var hintTimer = null;
      function showHint(text) {
        hint.textContent = text;
        hint.classList.add('on');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () { hint.classList.remove('on'); }, 1500);
      }
      function setGestures(mode) {
        gestures = mode === 'greedy' ? 'greedy' : 'cooperative';
        if (gestures === 'greedy' || !COARSE_POINTER) map.dragging.enable();
        else map.dragging.disable();
        if (gestures === 'greedy') map.scrollWheelZoom.enable();
        else map.scrollWheelZoom.disable();
      }
      setGestures(GESTURES);
      var container = map.getContainer();
      container.addEventListener('touchmove', function (e) {
        if (gestures === 'cooperative' && COARSE_POINTER && e.touches.length === 1) showHint(TWO_FINGERS_LABEL);
      }, { passive: true });
      container.addEventListener('wheel', function () {
        if (gestures === 'cooperative' && !map.scrollWheelZoom.enabled()) showHint(CLICK_TO_ZOOM_LABEL);
      }, { passive: true });
      map.on('click', function () {
        if (!COARSE_POINTER) map.scrollWheelZoom.enable();
      });
      container.addEventListener('mouseleave', function () {
        if (gestures === 'cooperative') map.scrollWheelZoom.disable();
      });

      function placeStop(marker, point, color, letter, label, approximate) {
        if (!point) {
          if (marker) map.removeLayer(marker);
          return null;
        }
        var text = approximate ? label + ' (' + APPROXIMATE_LABEL + ')' : label;
        if (marker) {
          marker.setLatLng([point.lat, point.lng]).setIcon(pinIcon(color, letter, approximate));
          marker.setPopupContent(text);
          return marker;
        }
        return L.marker([point.lat, point.lng], { icon: pinIcon(color, letter, approximate) }).addTo(map).bindPopup(text);
      }

      function setStops(pickup, dropoff, approximate) {
        approximate = approximate || {};
        pickupMarker = placeStop(pickupMarker, pickup, '#00D2A2', 'P', PICKUP_LABEL, approximate.pickup);
        dropoffMarker = placeStop(dropoffMarker, dropoff, '#E74C3C', 'D', DROPOFF_LABEL, approximate.dropoff);
      }

      function everything() {
        var all = [];
        if (pickupMarker) all.push(pickupMarker.getLatLng());
        if (dropoffMarker) all.push(dropoffMarker.getLatLng());
        if (driverMarker) all.push(driverMarker.getLatLng());
        if (routeLine && routeLine.length) {
          var routeBounds = L.latLngBounds(routeLine);
          all.push(routeBounds.getSouthWest(), routeBounds.getNorthEast());
        }
        return all;
      }

      function fitAll() {
        var all = everything();
        moveOnPurpose(function () {
          if (all.length > 1) map.fitBounds(all, { padding: [40, 40], maxZoom: 16 });
          else if (all.length === 1) map.setView(all[0], 14);
        });
      }

      setStops(PICKUP, DROPOFF);
      if (PICKUP && DROPOFF) fitAll();

      // The map's box changes size when a phone turns or the map is made
      // full screen: show the whole trip again in the new shape, or keep the
      // truck in the middle when following it, unless the viewer has moved it.
      map.on('resize', function () {
        if (follow && driverMarker) moveOnPurpose(function () { map.panTo(driverMarker.getLatLng(), { animate: false }); });
        else if (!viewerMoved) fitAll();
      });

      function setRoute(line) {
        routeLine = line;
        if (!routeCasing) {
          routeCasing = L.polyline([], { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(map);
          routeDriven = L.polyline([], { color: DRIVEN_COLOR, weight: 5, opacity: 0.8, dashArray: '2 8', lineCap: 'round', interactive: false }).addTo(map);
          routeAhead = L.polyline([], { color: ROUTE_COLOR, weight: 5, opacity: 0.95, lineJoin: 'round', interactive: false }).addTo(map);
        }
        routeCasing.setLatLngs(line);
        routeAhead.setLatLngs(line);
        routeDriven.setLatLngs([]);
        if (!viewerMoved) fitAll();
      }

      function clearRoute() {
        [routeCasing, routeAhead, routeDriven].forEach(function (l) { if (l) map.removeLayer(l); });
        routeCasing = routeAhead = routeDriven = null;
        routeLine = null;
      }

      // Splits the line at the truck: the road behind it dotted grey, the road
      // ahead in blue.
      function setProgress(index, point) {
        if (!routeLine || !routeAhead) return;
        if (index == null || !point) {
          routeAhead.setLatLngs(routeLine);
          routeDriven.setLatLngs([]);
          return;
        }
        routeDriven.setLatLngs(routeLine.slice(0, index + 1).concat([point]));
        routeAhead.setLatLngs([point].concat(routeLine.slice(index + 1)));
      }

      function animateTruck(to) {
        if (animation) { cancelAnimationFrame(animation); animation = null; }
        var from = driverMarker.getLatLng();
        var target = L.latLng(to[0], to[1]);
        // A long jump (the app was asleep, or the first fix after a gap) is
        // shown at once rather than as the truck flying across the map.
        if (from.distanceTo(target) > 2000) {
          driverMarker.setLatLng(target);
          if (accuracyCircle) accuracyCircle.setLatLng(target);
          return;
        }
        var startedAt = null;
        function step(now) {
          if (startedAt == null) startedAt = now;
          var k = Math.min(1, (now - startedAt) / ANIMATION_MS);
          var eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          var at = L.latLng(from.lat + (target.lat - from.lat) * eased, from.lng + (target.lng - from.lng) * eased);
          driverMarker.setLatLng(at);
          if (accuracyCircle) accuracyCircle.setLatLng(at);
          animation = k < 1 ? requestAnimationFrame(step) : null;
        }
        animation = requestAnimationFrame(step);
      }

      function setDriver(msg) {
        var at = [msg.lat, msg.lng];
        if (!driverMarker) {
          driverMarker = L.marker(at, { icon: truckIcon, zIndexOffset: 1000, keyboard: false }).addTo(map).bindPopup(DRIVER_LABEL);
        } else {
          animateTruck(at);
        }

        var el = driverMarker.getElement && driverMarker.getElement();
        var truck = el && el.querySelector('.flito-truck');
        if (truck) {
          var hasHeading = typeof msg.heading === 'number' && msg.heading >= 0;
          truck.classList.toggle('no-heading', !hasHeading);
          truck.classList.toggle('stale', !!msg.stale);
          if (hasHeading) truck.querySelector('.flito-truck-arrow').style.transform = 'rotate(' + msg.heading + 'deg)';
        }

        // How sure the phone is of the spot: a faint circle of that radius.
        var accuracy = typeof msg.accuracy === 'number' && msg.accuracy > 0 && msg.accuracy < 5000 ? msg.accuracy : null;
        if (accuracy) {
          if (accuracyCircle) accuracyCircle.setRadius(accuracy);
          else accuracyCircle = L.circle(at, { radius: accuracy, color: '#FF9F00', weight: 1, opacity: 0.5, fillOpacity: 0.12, interactive: false }).addTo(map);
          if (!animation) accuracyCircle.setLatLng(at);
        } else if (accuracyCircle) {
          map.removeLayer(accuracyCircle);
          accuracyCircle = null;
        }

        if (follow) moveOnPurpose(function () { map.panTo(at, { animate: true, duration: 1 }); });
      }

      function clearDriver() {
        if (animation) { cancelAnimationFrame(animation); animation = null; }
        if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
        if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
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
          setDriver(msg);
        } else if (msg.type === 'clearDriver') {
          clearDriver();
        } else if (msg.type === 'setStops') {
          setStops(msg.pickup, msg.dropoff, msg.approximate);
          if (!viewerMoved) fitAll();
        } else if (msg.type === 'setRoute') {
          if (msg.line && msg.line.length > 1) setRoute(msg.line);
        } else if (msg.type === 'clearRoute') {
          clearRoute();
        } else if (msg.type === 'setProgress') {
          setProgress(msg.index, msg.point);
        } else if (msg.type === 'follow') {
          follow = !!msg.on;
          if (follow && driverMarker) {
            moveOnPurpose(function () { map.setView(driverMarker.getLatLng(), Math.max(map.getZoom(), 15)); });
          }
        } else if (msg.type === 'setPicked') {
          setPicked(msg.lat, msg.lng);
          map.setView([msg.lat, msg.lng], Math.max(map.getZoom(), 15));
        } else if (msg.type === 'clearPicked') {
          if (pickedMarker) { map.removeLayer(pickedMarker); pickedMarker = null; }
        } else if (msg.type === 'center') {
          map.setView([msg.lat, msg.lng], msg.zoom || map.getZoom());
        } else if (msg.type === 'fitAll') {
          viewerMoved = false;
          fitAll();
        } else if (msg.type === 'gestures') {
          setGestures(msg.mode);
        }
      });

      sendToHost({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
