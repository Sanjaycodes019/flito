// A minimal canvas signature pad, hosted the same way the map pages are (see
// components/map/mapHtml.js) — inside a native WebView or a web iframe via
// MapCanvas, with the same postMessage bridge. Reusing that bridge here
// avoids writing a second host/transport layer for what is, mechanically,
// the same "embed an HTML page, exchange JSON messages" problem as the map.
//
// Commands in: {type:'clear'}, {type:'requestSave'}.
// Events out: {type:'ready'}, {type:'signature', dataUrl, empty}.

export const buildSignaturePadHtml = () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { height: 100%; margin: 0; padding: 0; background: #fff; overflow: hidden; }
    canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  </style>
</head>
<body>
  <canvas id="pad"></canvas>
  <script>
    (function () {
      var canvas = document.getElementById('pad');
      var ctx = canvas.getContext('2d');
      var drawing = false;
      var hasDrawn = false;
      var last = null;

      function resize() {
        // A canvas's backing-store size and its CSS size are independent —
        // without this it stays blurry/mis-scaled on a resized or high-DPI view.
        var ratio = window.devicePixelRatio || 1;
        var priorDataUrl = hasDrawn ? canvas.toDataURL() : null;
        canvas.width = canvas.clientWidth * ratio;
        canvas.height = canvas.clientHeight * ratio;
        ctx.scale(ratio, ratio);
        paintBackground();
        if (priorDataUrl) {
          var img = new Image();
          img.onload = function () { ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight); };
          img.src = priorDataUrl;
        }
      }

      function paintBackground() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

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

      function pointFromEvent(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }

      function start(e) {
        drawing = true;
        last = pointFromEvent(e);
      }
      function move(e) {
        if (!drawing) return;
        var p = pointFromEvent(e);
        ctx.strokeStyle = '#1E242B';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
        hasDrawn = true;
      }
      function end() { drawing = false; last = null; }

      canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); start(e); });
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);

      onHostMessage(function (msg) {
        if (msg.type === 'clear') {
          hasDrawn = false;
          paintBackground();
        } else if (msg.type === 'requestSave') {
          sendToHost({ type: 'signature', dataUrl: canvas.toDataURL('image/png'), empty: !hasDrawn });
        }
      });

      window.addEventListener('resize', resize);
      resize();
      sendToHost({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
