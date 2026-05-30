// IG Reels & Stories publishing — graph.instagram.com/v21.0
// Antigravity がブラウザで解決できなかった「リール/ストーリー投稿」を公式APIで通す。
// ビジネスアカウント必須 / メディアは PUBLIC URL 必須（Reelは動画URL）。
//
// Reels:   POST /{ig-user-id}/media  media_type=REELS   video_url + caption  -> poll -> media_publish
// Stories: POST /{ig-user-id}/media  media_type=STORIES  image_url | video_url -> poll -> media_publish
//   (Stories は caption 不可)
//
// 統合パイプライン⑤の心臓。Gemini Omni が生成→公開URL化した素材を受け取って投稿する。

import 'dotenv/config';

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

async function fetchRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 15000));
    }
  }
  throw new Error(`${label} fetch failed after 3 attempts: ${(lastErr as Error)?.message}`);
}

async function postForm(path: string, params: URLSearchParams, label: string): Promise<any> {
  const res = await fetchRetry(`${GRAPH_BASE}/${path}?${params.toString()}`, { method: 'POST' }, label);
  const body = await res.text();
  if (!res.ok) throw new Error(`${label} failed: HTTP ${res.status} ${body.slice(0, 250)}`);
  return JSON.parse(body);
}

/** REELS コンテナ作成 → creation_id */
export async function createReelContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string,
  shareToFeed = true,
): Promise<string> {
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: String(shareToFeed),
    access_token: token,
  });
  const data = await postForm(`${igUserId}/media`, params, 'createReelContainer');
  if (!data.id) throw new Error(`Reel container id missing: ${JSON.stringify(data).slice(0, 200)}`);
  return data.id;
}

/** STORIES コンテナ作成 → creation_id（画像 or 動画・caption不可） */
export async function createStoryContainer(
  igUserId: string,
  token: string,
  media: { imageUrl?: string; videoUrl?: string },
): Promise<string> {
  const params = new URLSearchParams({ media_type: 'STORIES', access_token: token });
  if (media.videoUrl) params.set('video_url', media.videoUrl);
  else if (media.imageUrl) params.set('image_url', media.imageUrl);
  else throw new Error('createStoryContainer: imageUrl か videoUrl が必要');
  const data = await postForm(`${igUserId}/media`, params, 'createStoryContainer');
  if (!data.id) throw new Error(`Story container id missing: ${JSON.stringify(data).slice(0, 200)}`);
  return data.id;
}

/** コンテナが FINISHED になるまで待機（Reel動画は処理に時間がかかる→最大5分） */
export async function waitForContainerReady(containerId: string, token: string, maxWaitSec = 300): Promise<void> {
  const params = new URLSearchParams({ fields: 'status_code,status', access_token: token });
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWaitSec) {
    const res = await fetchRetry(`${GRAPH_BASE}/${containerId}?${params.toString()}`, { method: 'GET' }, 'waitForContainerReady');
    const body = await res.text();
    if (!res.ok) throw new Error(`status check failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    const data = JSON.parse(body) as { status_code?: string; status?: string };
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`container ERROR: ${data.status ?? body.slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`container ${containerId} not ready after ${maxWaitSec}s`);
}

/** publish → media_id */
export async function publishContainer(igUserId: string, token: string, creationId: string): Promise<string> {
  const params = new URLSearchParams({ creation_id: creationId, access_token: token });
  const data = await postForm(`${igUserId}/media_publish`, params, 'publishContainer');
  if (!data.id) throw new Error(`media id missing: ${JSON.stringify(data).slice(0, 200)}`);
  return data.id;
}

/** 高レベル: Reel を投稿（video_url は PUBLIC・9:16・5-90s・H.264推奨） */
export async function postReel(igUserId: string, token: string, videoUrl: string, caption: string): Promise<string> {
  const id = await createReelContainer(igUserId, token, videoUrl, caption);
  await waitForContainerReady(id, token);
  return publishContainer(igUserId, token, id);
}

/** 高レベル: Story を投稿（image_url か video_url・PUBLIC・24h で消える） */
export async function postStory(igUserId: string, token: string, media: { imageUrl?: string; videoUrl?: string }): Promise<string> {
  const id = await createStoryContainer(igUserId, token, media);
  await waitForContainerReady(id, token);
  return publishContainer(igUserId, token, id);
}

// ─── CLI テスト（投稿実行注意）─────────────────────────
// 使い方:
//   npx tsx ig-reels-stories.ts reel  <ACC> <PUBLIC_VIDEO_URL> "caption"
//   npx tsx ig-reels-stories.ts story <ACC> <PUBLIC_IMAGE_URL>
// ACC は A1..A5（IG_USER_ID_<ACC> / IG_TOKEN_<ACC> をenvから読む）
if (import.meta.url === `file://${process.argv[1]}`) {
  const [kind, acc, url, caption] = process.argv.slice(2);
  const igUserId = process.env[`IG_USER_ID_${acc}`];
  const token = process.env[`IG_TOKEN_${acc}`];
  if (!kind || !acc || !url) {
    console.log('usage: tsx ig-reels-stories.ts <reel|story> <A1..A5> <PUBLIC_URL> [caption]');
    process.exit(1);
  }
  if (!igUserId || !token) {
    console.error(`IG_USER_ID_${acc} / IG_TOKEN_${acc} 未設定`);
    process.exit(1);
  }
  (async () => {
    try {
      const isVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(url);
      let mediaId: string;
      if (kind === 'reel') {
        mediaId = await postReel(igUserId, token, url, caption ?? '');
      } else {
        mediaId = await postStory(igUserId, token, isVideo ? { videoUrl: url } : { imageUrl: url });
      }
      console.log(`✅ ${kind} published: ${mediaId} (https://www.instagram.com/p/${mediaId}/)`);
    } catch (e) {
      console.error(`❌ ${kind} failed:`, (e as Error).message);
      process.exit(1);
    }
  })();
}
