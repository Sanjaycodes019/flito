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
//   {type:'setDriver', lat, lng, heading?, accuracy?, stale?, label?}, {type:'clearDriver'}
//   {type:'setStops', pickup?, dropoff?, names?: {pickup, dropoff}, approximate?: {pickup, dropoff}}
//   {type:'setRoute', line: [[lat,lng], ...]}, {type:'clearRoute'}
//   {type:'setProgress', index, point: [lat,lng]} (where the truck is on the route)
//   {type:'follow', on}, {type:'fitAll'}, {type:'zoomIn'}, {type:'zoomOut'}
//   {type:'gestures', mode: 'cooperative'|'greedy'}
//   {type:'setPadding', topLeft: [x, y], bottomRight: [x, y]} (room to leave
//     around the trip when fitting it, for whatever the host draws on top)
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
//   theme: 'light' or 'dark', to match the app
//   zoomControl: whether the page draws its own + / - buttons (a host that
//     draws its own controls turns it off)
export const buildMapHtml = ({
  interactive = false,
  pickup = null,
  dropoff = null,
  initialPicked = null,
  labels = {},
  gestures = 'cooperative',
  theme = 'light',
  zoomControl = true,
} = {}) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #E9EDF0; }
    body.dark, body.dark #map { background: #171C21; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    /* OpenStreetMap's tiles are drawn for reading, not for carrying a route:
       toned down, the route, stops and truck stand out. In the dark theme the
       same tiles are inverted into a night map. */
    .leaflet-tile-pane { filter: saturate(0.55) contrast(0.94) brightness(1.04); }
    body.dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.86) saturate(0.4); }
    /* At a half zoom step the tiles are scaled and meet at fractions of a
       pixel, which leaves hairline seams along their edges under the filter
       above. One pixel wider and taller, each tile overlaps the next; drawn
       normally (not with Leaflet's plus-lighter blend, which would add the
       overlap up into a white line), the overlap just covers the seam. */
    .leaflet-container .leaflet-tile-container img.leaflet-tile {
      width: 257px !important; height: 257px !important; mix-blend-mode: normal;
    }

    /* Pins: a drop with the stop's symbol, and its name beside it. */
    .flito-pin svg { display: block; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35)); }
    .flito-pin.approx { opacity: 0.8; }
    .leaflet-tooltip.flito-label {
      background: #fff; color: #1E242B; border: 0; border-radius: 8px; padding: 3px 8px;
      font-size: 12px; font-weight: 600; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22); white-space: nowrap;
      max-width: 180px; overflow: hidden; text-overflow: ellipsis;
    }
    .leaflet-tooltip-top.flito-label::before { display: none; }
    body.dark .leaflet-tooltip.flito-label { background: #1E242B; color: #F4F6F8; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6); }

    /* The truck, seen from above, turned to where it is heading. */
    .flito-truck { position: relative; width: 52px; height: 52px; }
    .flito-truck-halo {
      position: absolute; left: 6px; top: 6px; width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255, 159, 0, 0.3); animation: flito-pulse 2s ease-out infinite;
    }
    .flito-truck-turn { position: absolute; left: 13px; top: 4px; width: 26px; height: 44px; transform-origin: 13px 22px; transition: transform 0.8s ease; }
    .flito-truck svg { display: block; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45)); }
    .flito-truck .cargo { fill: #FF9F00; stroke: #fff; stroke-width: 1.5; }
    .flito-truck .cab { fill: #E08F00; stroke: #fff; stroke-width: 1.5; }
    .flito-truck .ribs { stroke: rgba(255, 255, 255, 0.5); stroke-width: 1; }
    .flito-truck .glass { fill: #1E242B; opacity: 0.8; }
    .flito-truck.stale .flito-truck-halo { display: none; }
    .flito-truck.stale .cargo { fill: #8A97A3; }
    .flito-truck.stale .cab { fill: #6B7780; }
    @keyframes flito-pulse { 0% { transform: scale(0.55); opacity: 1; } 100% { transform: scale(1.45); opacity: 0; } }

    /* Time left, in a bubble above the truck. */
    .leaflet-tooltip.flito-eta {
      background: #1E242B; color: #fff; border: 0; border-radius: 10px; padding: 3px 9px;
      font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3); white-space: nowrap;
    }
    .leaflet-tooltip-top.flito-eta::before { border-top-color: #1E242B; }
    body.dark .leaflet-tooltip.flito-eta { background: #F4F6F8; color: #1E242B; }
    body.dark .leaflet-tooltip-top.flito-eta::before { border-top-color: #F4F6F8; }

    /* Leaflet's controls, in the app's style. */
    .leaflet-bar { border: 0 !important; border-radius: 12px !important; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important; }
    .leaflet-bar a, .leaflet-bar a:hover {
      width: 40px !important; height: 40px !important; line-height: 40px !important; font-size: 20px !important;
      color: #1E242B; background: #fff; border-bottom-color: rgba(30, 36, 43, 0.1) !important;
    }
    body.dark .leaflet-bar a, body.dark .leaflet-bar a:hover { color: #F4F6F8; background: #1E242B; border-bottom-color: rgba(244, 246, 248, 0.12) !important; }
    .leaflet-control-attribution {
      font-size: 10px; border-radius: 6px 6px 6px 0; background: rgba(255, 255, 255, 0.75) !important; color: #5D6E6F;
    }
    .leaflet-control-attribution a { color: #1D6CA1; }
    body.dark .leaflet-control-attribution { background: rgba(23, 28, 33, 0.75) !important; color: #9AA8AA; }
    body.dark .leaflet-control-attribution a { color: #5DB6F0; }
    .leaflet-control-scale-line {
      border-color: rgba(30, 36, 43, 0.55); color: #1E242B; background: rgba(255, 255, 255, 0.6); font-size: 10px;
    }
    body.dark .leaflet-control-scale-line { border-color: rgba(244, 246, 248, 0.6); color: #F4F6F8; background: rgba(23, 28, 33, 0.6); }
    .leaflet-popup-content-wrapper { border-radius: 10px; }
    body.dark .leaflet-popup-content-wrapper, body.dark .leaflet-popup-tip { background: #1E242B; color: #F4F6F8; }

    .flito-hint {
      position: absolute; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box; background: rgba(18, 22, 26, 0.35);
      opacity: 0; pointer-events: none; transition: opacity 0.2s;
    }
    .flito-hint span {
      max-width: 260px; padding: 10px 16px; border-radius: 12px; background: rgba(18, 22, 26, 0.88); color: #fff;
      font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    }
    .flito-hint.on { opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      .flito-truck-halo { animation: none; opacity: 0.5; }
      .flito-truck-turn, .flito-hint { transition: none; }
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
      var DARK = ${escapeJs(theme === 'dark')};
      var ZOOM_CONTROL = ${escapeJs(zoomControl)};
      // A finger, not a mouse: phones, tablets and the Android app.
      var COARSE_POINTER = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

      if (DARK) document.body.className = 'dark';
      var COLORS = DARK
        ? { route: '#5DB6F0', casing: '#0B0E11', driven: '#5D6E6F', pickup: '#00C495', dropoff: '#FF6B5B', picked: '#FFB733', truck: '#FFB733' }
        : { route: '#1D6CA1', casing: '#FFFFFF', driven: '#A3ADB5', pickup: '#00A884', dropoff: '#E74C3C', picked: '#FF9F00', truck: '#FF9F00' };
      var ANIMATION_MS = 1200;
      // How far a stop with no exact pin may be from where it is drawn.
      var APPROXIMATE_RADIUS_M = 1200;

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

      function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      // A drop-shaped pin with the stop's symbol: a parcel for the pickup, a
      // flag for the drop-off, a dot for a point being picked.
      function pinSvg(kind) {
        var color = COLORS[kind];
        var glyph = kind === 'pickup'
          ? '<path d="M11.5 13.2l4.5-2.3 4.5 2.3v5.2L16 20.7l-4.5-2.3z M11.5 13.2l4.5 2.3 4.5-2.3 M16 15.5v5.2" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round"/>'
          : kind === 'dropoff'
            ? '<path d="M13 21V10.5 M13 11h6.5l-1.6 2.3 1.6 2.3H13" fill="none" stroke="' + color + '" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>'
            : '<circle cx="16" cy="15.5" r="3.4" fill="' + color + '"/>';
        return '<svg width="32" height="42" viewBox="0 0 32 42">'
          + '<path d="M16 1C7.7 1 1 7.6 1 15.8 1 26.9 16 41 16 41s15-14.1 15-25.2C31 7.6 24.3 1 16 1z" fill="' + color + '" stroke="#fff" stroke-width="2"/>'
          + '<circle cx="16" cy="15.5" r="8.6" fill="#fff"/>' + glyph + '</svg>';
      }
      function pinIcon(kind, approximate) {
        return L.divIcon({
          className: '',
          html: '<div class="flito-pin' + (approximate ? ' approx' : '') + '">' + pinSvg(kind) + '</div>',
          iconSize: [32, 42],
          iconAnchor: [16, 41],
          popupAnchor: [0, -36],
          tooltipAnchor: [0, -44],
        });
      }

      var truckIcon = L.divIcon({
        className: '',
        html: '<div class="flito-truck"><div class="flito-truck-halo"></div><div class="flito-truck-turn">'
          + '<svg width="26" height="44" viewBox="0 0 26 44">'
          + '<rect class="cargo" x="3" y="14" width="20" height="28" rx="3"/>'
          + '<path class="ribs" d="M6 20h14M6 26h14M6 32h14M6 38h14"/>'
          + '<rect class="cab" x="4" y="2" width="18" height="13" rx="5"/>'
          + '<rect class="glass" x="6.5" y="4.5" width="13" height="4.5" rx="1.8"/>'
          + '</svg></div></div>',
        iconSize: [52, 52],
        iconAnchor: [26, 26],
        tooltipAnchor: [0, -22],
      });

      var start = PICKUP || DROPOFF || INITIAL_PICKED || DEFAULT_CENTER;
      // Half zoom steps, so a trip can fill the map instead of the nearest
      // whole step leaving it small in the middle.
      var map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.5 })
        .setView([start.lat, start.lng], (PICKUP || DROPOFF) ? 12 : 14);
      if (ZOOM_CONTROL) L.control.zoom({ position: 'topright' }).addTo(map);
      // Stop names sit above the route but under the pins and the truck, so a
      // name never hides the truck going past it.
      map.createPane('stopNames');
      map.getPane('stopNames').style.zIndex = 590;
      map.getPane('stopNames').style.pointerEvents = 'none';
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

      // Tiles are fetched only once panning or zooming stops, and only one ring
      // beyond the screen is kept: fewer downloads on a phone's data plan and
      // less load on OpenStreetMap's free tile servers.
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        keepBuffer: 1,
        updateWhenIdle: true,
        updateWhenZooming: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      var pickupMarker = null;
      var dropoffMarker = null;
      var pickupArea = null;
      var dropoffArea = null;
      var driverMarker = null;
      var accuracyCircle = null;
      var pickedMarker = null;
      var routeLine = null;
      var routeCasing = null;
      var routeAhead = null;
      var routeDriven = null;
      var follow = false;
      var animation = null;
      var shownHeading = null;

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
      var hintText = document.createElement('span');
      hint.appendChild(hintText);
      document.body.appendChild(hint);
      var hintTimer = null;
      function showHint(text) {
        hintText.textContent = text;
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

      // A stop: its pin, its name beside it, and for a stop with no exact pin
      // a dashed circle for the area it is somewhere in.
      function placeStop(marker, area, point, kind, label, name, approximate) {
        if (area) map.removeLayer(area);
        area = null;
        if (!point) {
          if (marker) map.removeLayer(marker);
          return { marker: null, area: null };
        }
        var popup = escapeHtml(name ? label + ': ' + name : label) + (approximate ? ' (' + escapeHtml(APPROXIMATE_LABEL) + ')' : '');
        if (marker) {
          marker.setLatLng([point.lat, point.lng]).setIcon(pinIcon(kind, approximate)).setPopupContent(popup);
        } else {
          marker = L.marker([point.lat, point.lng], { icon: pinIcon(kind, approximate), keyboard: false }).addTo(map).bindPopup(popup);
        }
        marker.unbindTooltip();
        // Above the pin: a road leaves a stop sideways far more often than
        // straight up, so the name rarely sits on the route.
        if (name) marker.bindTooltip(escapeHtml(name), { permanent: true, direction: 'top', className: 'flito-label', interactive: false, pane: 'stopNames' });
        if (approximate) {
          area = L.circle([point.lat, point.lng], {
            radius: APPROXIMATE_RADIUS_M, color: COLORS[kind], weight: 1.5, dashArray: '4 6', fillOpacity: 0.07, interactive: false,
          }).addTo(map);
        }
        return { marker: marker, area: area };
      }

      function setStops(pickup, dropoff, names, approximate) {
        names = names || {};
        approximate = approximate || {};
        var p = placeStop(pickupMarker, pickupArea, pickup, 'pickup', PICKUP_LABEL, names.pickup, approximate.pickup);
        pickupMarker = p.marker;
        pickupArea = p.area;
        var d = placeStop(dropoffMarker, dropoffArea, dropoff, 'dropoff', DROPOFF_LABEL, names.dropoff, approximate.dropoff);
        dropoffMarker = d.marker;
        dropoffArea = d.area;
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

      // Room is left at the top for the pins, their names and the status
      // chip, and on the right for the host's buttons, unless the host says
      // otherwise.
      var fitPadding = { topLeft: [72, 84], bottomRight: [72, 28] };
      // Only a fit someone asked for is animated. The page fits itself several
      // times as the stops, route and padding arrive, and Leaflet drops a fit
      // that comes while an earlier one is still animating.
      function fitAll(animate) {
        var all = everything();
        moveOnPurpose(function () {
          if (all.length > 1) {
            map.fitBounds(all, { paddingTopLeft: fitPadding.topLeft, paddingBottomRight: fitPadding.bottomRight, maxZoom: 16, animate: !!animate });
          } else if (all.length === 1) {
            map.setView(all[0], 14, { animate: !!animate });
          }
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
          routeCasing = L.polyline([], { color: COLORS.casing, weight: 10, opacity: 1, lineJoin: 'round', lineCap: 'round', interactive: false }).addTo(map);
          routeDriven = L.polyline([], { color: COLORS.driven, weight: 6, opacity: 1, lineJoin: 'round', lineCap: 'round', interactive: false }).addTo(map);
          routeAhead = L.polyline([], { color: COLORS.route, weight: 6, opacity: 1, lineJoin: 'round', lineCap: 'round', interactive: false }).addTo(map);
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

      // Splits the line at the truck: the road behind it grey, the road
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

      // Turns the truck the short way round (350 to 10 degrees is a 20 degree
      // turn, not 340 back the other way).
      function turnTruck(el, heading) {
        if (shownHeading == null) shownHeading = heading;
        else shownHeading += ((heading - shownHeading) % 360 + 540) % 360 - 180;
        el.style.transform = 'rotate(' + shownHeading + 'deg)';
      }

      function setDriver(msg) {
        var at = [msg.lat, msg.lng];
        if (!driverMarker) {
          driverMarker = L.marker(at, { icon: truckIcon, zIndexOffset: 1000, keyboard: false }).addTo(map).bindPopup(escapeHtml(DRIVER_LABEL));
        } else {
          animateTruck(at);
        }

        var el = driverMarker.getElement && driverMarker.getElement();
        var truck = el && el.querySelector('.flito-truck');
        if (truck) {
          truck.classList.toggle('stale', !!msg.stale);
          if (typeof msg.heading === 'number' && msg.heading >= 0) turnTruck(truck.querySelector('.flito-truck-turn'), msg.heading);
        }

        // Time left, above the truck.
        if (msg.label) {
          if (driverMarker.getTooltip()) driverMarker.setTooltipContent(escapeHtml(msg.label));
          else driverMarker.bindTooltip(escapeHtml(msg.label), { permanent: true, direction: 'top', className: 'flito-eta', interactive: false });
        } else if (driverMarker.getTooltip()) {
          driverMarker.unbindTooltip();
        }

        // How sure the phone is of the spot: a faint circle of that radius.
        var accuracy = typeof msg.accuracy === 'number' && msg.accuracy > 0 && msg.accuracy < 5000 ? msg.accuracy : null;
        if (accuracy) {
          if (accuracyCircle) accuracyCircle.setRadius(accuracy);
          else accuracyCircle = L.circle(at, { radius: accuracy, color: COLORS.truck, weight: 1, opacity: 0.6, fillOpacity: 0.12, interactive: false }).addTo(map);
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
        shownHeading = null;
      }

      function setPicked(lat, lng) {
        if (pickedMarker) pickedMarker.setLatLng([lat, lng]);
        else pickedMarker = L.marker([lat, lng], { icon: pinIcon('picked'), draggable: true }).addTo(map);
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
          setStops(msg.pickup, msg.dropoff, msg.names, msg.approximate);
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
        } else if (msg.type === 'zoomIn') {
          map.zoomIn();
        } else if (msg.type === 'zoomOut') {
          map.zoomOut();
        } else if (msg.type === 'setPicked') {
          setPicked(msg.lat, msg.lng);
          map.setView([msg.lat, msg.lng], Math.max(map.getZoom(), 15));
        } else if (msg.type === 'clearPicked') {
          if (pickedMarker) { map.removeLayer(pickedMarker); pickedMarker = null; }
        } else if (msg.type === 'center') {
          map.setView([msg.lat, msg.lng], msg.zoom || map.getZoom());
        } else if (msg.type === 'fitAll') {
          viewerMoved = false;
          fitAll(true);
        } else if (msg.type === 'gestures') {
          setGestures(msg.mode);
        } else if (msg.type === 'setPadding') {
          fitPadding = { topLeft: msg.topLeft || fitPadding.topLeft, bottomRight: msg.bottomRight || fitPadding.bottomRight };
          if (!viewerMoved) fitAll();
        }
      });

      sendToHost({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
