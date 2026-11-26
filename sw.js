/* 나의 화이트보드 — 서비스 워커
   - 앱 파일: 버전이 붙은 캐시에 저장, 새 버전을 올리면 CACHE_VERSION만 올리면 이전 캐시를 정리
   - Pretendard 폰트(CSS·woff2): 처음 한 번 받아 별도 캐시에 보관 → 이후 오프라인에서도 같은 폰트
   - 모든 경로는 상대 경로 (https://아이디.github.io/저장소이름/ 아래에서도 동작) */
const CACHE_VERSION = 'v1.0.0';
const APP_CACHE = 'myWhiteboard-app-' + CACHE_VERSION;
const FONT_CACHE = 'myWhiteboard-fonts-v1';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const FONT_HOST = 'cdn.jsdelivr.net';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('myWhiteboard-app-') && k !== APP_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) 폰트: 캐시 우선, 없으면 받아서 저장 (실패해도 앱은 대체 폰트로 동작)
  if (url.hostname === FONT_HOST && url.pathname.includes('/pretendard')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
          return res;
        }))
      ).catch(() => Response.error())
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 2) 페이지: 네트워크 우선(최신 버전 반영), 오프라인이면 캐시
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then(c => c.put('./index.html', copy)).catch(() => {}); }
        return res;
      }).catch(() => caches.match('./index.html', { ignoreSearch: true }).then(r => r || caches.match('./')))
    );
    return;
  }

  // 3) 나머지 앱 파일: 캐시 우선, 없으면 네트워크 후 저장
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }))
  );
});
