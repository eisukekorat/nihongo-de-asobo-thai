// タイごと にほんご であそぼ Service Worker v1
const CACHE_NAME = 'nihongo-thai-v1';
const ASSETS = [
  'index.html',
  'camera.html',
  'camera-dictionary.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

// インストール：コアアセットをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('[SW] キャッシュ追加で一部エラー:', err);
      });
    })
  );
  self.skipWaiting();
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// フェッチ：HTML・JSはネットワーク優先、その他はキャッシュ優先
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Google TTS Worker, 外部API, chrome-extension は素通し
  if (
    url.includes('workers.dev') ||
    url.includes('texttospeech.googleapis.com') ||
    url.startsWith('chrome-extension') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  // 同一オリジンのHTML・JSはネットワーク優先（コード更新をすぐ反映）
  const isSameOrigin = url.startsWith(self.location.origin);
  const isHtmlOrJs = url.endsWith('.html') || url.endsWith('.js');

  if (isSameOrigin && isHtmlOrJs) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // 成功したらキャッシュを更新して返す
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(e.request).then((cached) => {
            if (cached) return cached;
            // HTMLリクエストでキャッシュもない場合はindex.htmlを返す
            if (e.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/nihongo-de-asobo-thai/index.html');
            }
          });
        })
    );
    return;
  }

  // フォント・画像・アイコン等はキャッシュ優先
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request)
        .then((response) => {
          // 正常なレスポンスのみキャッシュ（Google Fontsや同一オリジン）
          if (
            response.ok &&
            (isSameOrigin ||
              url.includes('fonts.googleapis.com') ||
              url.includes('fonts.gstatic.com'))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // オフライン時はindex.htmlを返す
          if (e.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/nihongo-de-asobo-thai/index.html');
          }
        });
    })
  );
});
