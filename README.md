# Harness Affiliate Vessel

**目的:** IGアフィリ・ハーネス（A1-A5）を **Manusのクラウドサンドボックスで24時間動かす**ための単体バンドル。
会社のモノレポから切り出した自己完結セット（**secretゼロ**）。秘密情報は `.env`（スコープ限定IGトークン）で外から注入する。

## 中身
- `harness-ig-post.ts` — IG Graph API 投稿本体（自己完結・`graph.instagram.com/v21.0`・3ステップ container publish・法令ハードロック8種・重複検知）
- `affiliate-ig-batches/*.json` — 週次投稿バッチ（投稿文・secretなし）
- `ig-image-urls.json` — 画像URLマップ（公開URL）
- `.env.example` — IGトークンのテンプレ（A1-A5）
- `logs/` — 投稿ログ（実行時生成・gitignore）

## Manusサンドボックスでのブートストラップ
```bash
# 1. 取得（このリポをclone）
git clone <THIS_REPO_URL> ~/manus-vessel/harness-affiliate && cd $_

# 2. 依存導入
npm install

# 3. 認証（スコープ限定IGトークンをenvで注入。repoには絶対入れない）
cp .env.example .env && $EDITOR .env   # or env変数を直接export

# 4. ドライラン（投稿せず検証のみ）
npm run post:dry

# 5. 本番投稿（その日のバッチをA1-A5へ）
npm run post                # = tsx harness-ig-post.ts
# 特定日付: npx tsx harness-ig-post.ts --date=2026-06-01
```

## 安全
- `.env`・`logs/` は gitignore。**実トークンはコミットしない。**
- IGトークンは**アフィリ専用アカウント（A1-A5）にスコープ**されたもののみ。メイン/事業用認証は置かない。
- サンドボックスが毎回リセットなら、上記1-3を毎実行のブートストラップにする。

## 由来
`claude-company/scripts/harness-ig-post.ts` から 2026-05-30 に切り出し。
モノレポ側が正本だが、クラウド実行用にこの単体版を運用（差分が出たら同期）。
