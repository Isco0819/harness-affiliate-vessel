// Instagram 5アカ アフィリ投稿スクリプト (W22 対応 / Phase 1: 単一画像 + キャプション)
// - W22 IG バッチ (yori/affiliate-ig-batch-w22-2026-05-25.md) の投稿を5アカに自動投稿
// - 画像URLは scripts/ig-image-urls.json から取得 (Gemini が Drive にアップ後ここに記録)
// - 法令ハードロック8種を投稿前実行
// - 重複検知 (logs/ig-posts.json で過去投稿テキストチェック)
// 実行: npx tsx harness-ig-post.ts [--dry-run] [--date YYYY-MM-DD]
//   --dry-run: 投稿せず内容と検証結果のみ表示
//   --date:    特定日付の投稿を実行 (省略時は今日)
//
// IG Graph API:
//   POST /{ig-user-id}/media         (image_url + caption) -> creation_id
//   GET  /{creation_id}?fields=status_code (containerが FINISHED になるまで wait)
//   POST /{ig-user-id}/media_publish (creation_id) -> media_id

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { postReel, postStory } from './ig-reels-stories.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── アカウント定義 ─────────────────────────────────
type Account = { id: string; handle: string; igUserId: string; token: string };

const ACCOUNTS: Account[] = [
  { id: 'A1', handle: 'kei_career30',    igUserId: process.env.IG_USER_ID_A1 ?? '', token: process.env.IG_TOKEN_A1 ?? '' },
  { id: 'A2', handle: 'taka_solo_biz',   igUserId: process.env.IG_USER_ID_A2 ?? '', token: process.env.IG_TOKEN_A2 ?? '' },
  { id: 'A3', handle: 'saas_solobiz',    igUserId: process.env.IG_USER_ID_A3 ?? '', token: process.env.IG_TOKEN_A3 ?? '' },
  { id: 'A4', handle: 'mai_lifestyle30', igUserId: process.env.IG_USER_ID_A4 ?? '', token: process.env.IG_TOKEN_A4 ?? '' },
  { id: 'A5', handle: 'saki_beauty28',   igUserId: process.env.IG_USER_ID_A5 ?? '', token: process.env.IG_TOKEN_A5 ?? '' },
];

// ─── BATCH 投稿定義 (W22: 5/26-6/1) ───────────────────
// バッチ MD: yori/affiliate-ig-batch-w22-2026-05-25.md と同期
type Post = {
  type: 'persona' | 'industry' | 'pr';
  caption: string;
  variant?: 'A' | 'B' | 'balancer';
  // format 省略時は 'feed'（既存バッチは無変更で feed として動く・後方互換）
  format?: 'feed' | 'story' | 'reel';
  // story/reel の公開メディアURL（feed は省略時 ig-image-urls.json から取得）
  // reel = 公開動画URL(9:16/5-90s) / story = 公開画像 or 動画URL
  media_url?: string;
};
type DailyPosts = Record<string, Post | Post[]>; // date -> post or post[] (複数フォーマット/複数回投稿対応)

const BATCH_POSTS: Record<string, DailyPosts> = {
  A1: {
    '2026-05-26': { type: 'persona', caption:
`年収交渉が苦手な人ほど「比較対象」を持ってない。

✓ 今の年収（額面+残業+賞与の3年平均）
✓ 同職種の市場相場（doda/マイナビ）
✓ 他社オファー1〜2社

3つ並べれば、相手側も提示レンジを動かしやすくなる。

#エンジニア転職 #年収交渉 #30代キャリア #IT転職 #SE転職 #ITエンジニア #フリーランスエンジニア #転職活動 #キャリアアップ #年収アップ` },

    '2026-05-27': { type: 'persona', caption:
`30代SEの「マネジメント vs 技術」分岐点で見るべき3問。

✓ 人を動かすのが面白い瞬間があるか
✓ 1年で潰したい技術課題が浮かぶか
✓ 5年後の名刺に書きたい言葉は何か

答えが揺れる人は「技術+プロジェクト主導」の中間ポジションが伸びる。

#30代キャリア #SE #エンジニア #IT転職 #SES #キャリアパス #マネジメント #技術職 #エンジニアキャリア #IT人材` },

    '2026-05-28': { type: 'pr', caption:
`30代エンジニアの「次の一手」を3問で振り分けるAI診断、W22版アップ。

→ 独立寄り：直案件型エージェント
→ 転職寄り：ハイクラス転職
→ 学び直し：AIスクール

30秒で完了。

プロフのリンク集から「30代エンジニアのキャリア診断」へ。

※リンクには広告が含まれます
#IT転職 #30代キャリア #エンジニア転職 #ハイクラス転職 #フリーランス #IT副業 #リスキリング #AIスクール #キャリア相談 #エンジニアキャリア` },

    '2026-05-29': { type: 'persona', caption:
`30代でクラウド/AI軸足を移すとき、「資格 vs 案件」どっちが先か。

自分の体感:
✓ 資格(SAA/PCA)は学習の地図
✓ ただし案件アサインの決定打にはならない
✓ 案件で実績 → 補強で資格、の順が効く

#クラウドエンジニア #リスキリング #AWS #GCP #IT資格 #エンジニア転職 #30代キャリア #IT副業 #AIエンジニア #データエンジニア` },

    '2026-05-30': { type: 'persona', caption:
`「副業案件が取れない」の共通点は「ポートフォリオが古い or ない」。

最低限揃えたい3点:
✓ GitHub直近3ヶ月のコミット
✓ Qiita/Zenn/ブログに記事1本
✓ LinkedIn職歴+技術スタック明記

これだけで提案通過率は体感2倍。

#副業エンジニア #ポートフォリオ #GitHub #Qiita #LinkedIn #IT副業 #フリーランス #エンジニア転職 #リスキリング #30代キャリア` },

    '2026-05-31': { type: 'industry', caption:
`2026年のIT人材市場、ざっと見ての傾向。

✓ 生成AI関連案件は単価が崩れ始め（参入者増）
✓ データエンジニア/SREは逆に単価上昇
✓ 「フルスタック+ドメイン知識」が引き合い強い

「AIを使う側」だけだと差別化しんどい時期。

#IT業界 #エンジニア #生成AI #データエンジニア #SRE #フルスタック #エンジニア転職 #ITニュース #2026 #キャリア戦略` },

    '2026-06-01': { type: 'persona', caption:
`30代エンジニアの「キャリア棚卸し」、自分は半年に1回やってる。

✓ 直近半年で身についた技術3つ
✓ 取った案件3つ
✓ 詰まったこと3つ
✓ 次半年で取りに行くもの3つ

書き出してみるだけで「次の動き」がクリアになる。

#30代キャリア #エンジニアキャリア #キャリア棚卸し #リスキリング #IT人材 #エンジニア転職 #自己分析 #フリーランス #SE #IT副業` },
  },

  A2: {
    '2026-05-26': { type: 'persona', caption:
`1人起業で「最初に契約書テンプレを整える」って地味だけどリターン大きかった。

✓ 業務委託契約書（受注/発注両方）
✓ NDA（出す用/もらう用）
✓ 見積/請求/領収（クラウド会計の標準書式）

最初の3案件で「契約書なし」で進めて1回トラブったので、揃えて以降ノートラブル。

#1人起業 #フリーランス #個人事業主 #契約書 #副業独立 #起業準備 #1人社長 #小規模事業 #ビジネス #ノマドワーカー` },

    '2026-05-27': { type: 'industry', caption:
`1人事業者の周辺で最近よく聞く話。

✓ インボイス対応で発注先選別が進んだ
✓ 売上1,000万到達直前で意図的に止める人増
✓ 複数収入源（受注+商品+発信）の3本立てがデフォ化

「単一案件で大きく」より「複数の細い柱」のほうが時代に合ってる。

#1人起業 #フリーランス事情 #インボイス #個人事業主 #副業 #複業 #小規模事業 #ビジネス #起業 #フリーランス` },

    '2026-05-28': { type: 'persona', caption:
`1人起業で「営業が苦手」を解決する一番現実的な方法は「文章で営業する仕組み」だった。

✓ LP1ページに事例+料金+申込導線
✓ SNSでLPの入口を3本（実績/失敗談/Tips）
✓ 問い合わせ→商談比率を月次で測る

対面営業を覚えるより遥かに再現性ある。

#1人起業 #営業 #LP #フリーランス #個人事業主 #SNS集客 #集客 #コンテンツマーケティング #副業独立 #1人社長` },

    '2026-05-29': { type: 'pr', caption:
`「副業から1人起業に踏み切るか迷ってる」人向けの3問AI診断、W22もアップ中。

→ 独立に踏み切る寄り：独立支援
→ 営業がネック：営業代行
→ 在宅でゆるく：在宅副業マッチング

30秒で機械的に振り分け。

プロフのリンク集から「1人起業 診断」へ。

※リンクには広告が含まれます
#副業独立 #1人起業 #フリーランス #個人事業主 #起業準備 #副業 #独立支援 #営業代行 #在宅副業 #キャリア相談` },

    '2026-05-30': { type: 'persona', caption:
`1人起業で「報酬の入金タイミング」を整えるのは、売上を上げるより資金繰り効果が大きい。

✓ 着手30%/中間40%/納品30%の3分割
✓ 月次運用は前月末締め当月10日払い
✓ 新規取引先は最初の1案件だけ着手金全額

これだけで「請求書出したけど入金2ヶ月後」事故が激減。

#1人起業 #資金繰り #フリーランス #個人事業主 #請求書 #キャッシュフロー #小規模事業 #副業 #ビジネス #起業` },

    '2026-05-31': { type: 'persona', caption:
`1人起業1年目で「これは投資して正解だった」やつ。

✓ クラウド会計（月千円台で年末詰まない）
✓ 名刺管理アプリ（紙名刺ゼロ）
✓ スポット税理士（確定申告だけ年5万円）
✓ 健康診断+歯科定期検診

派手さはないけど全部効いた。

#1人起業 #フリーランス #個人事業主 #クラウド会計 #freee #マネーフォワード #税理士 #健康管理 #副業 #起業準備` },

    '2026-06-01': { type: 'persona', caption:
`1人起業の月次振り返り、自分はこの4つだけ書いてる。

✓ 先月の売上/経費/利益
✓ 取った新規案件と経路（紹介/SNS/営業代行）
✓ 落とした案件と理由
✓ 来月の重点アクション1つ

A4 1枚に毎月積むと、半年後に「勝ち経路」が見える。

#1人起業 #月次振り返り #フリーランス #個人事業主 #PDCA #ビジネス #起業 #副業 #小規模事業 #1人社長` },
  },

  A3: {
    '2026-05-26': { type: 'persona', caption:
`1人事業でSaaSスタックを組むとき、自分が優先する順番。

1. 売上を作る系（CRM/メール配信/決済）
2. 売上を測る系（GA4/Stripe/会計）
3. 業務を回す系（タスク/カレンダー/チャット）

「業務効率系」を先に固めがちだけど、売上系が先のほうがROI計測しやすい。

#1人事業 #SaaS #個人事業主 #業務効率化 #DX #CRM #Stripe #GA4 #フリーランス #起業` },

    '2026-05-27': { type: 'persona', caption:
`「Notion 1つで全部やる派」と「ツール分散派」、自分は分散派寄り。

理由:
✓ 1ツール依存だと障害時に全部止まる
✓ ツールごとの強みを活かせない
✓ データエクスポートが効きやすい

ただし「同期する仕組み」は事前に組まないと工数で死ぬ。

#SaaS #業務効率 #Notion #Linear #Slack #業務効率化 #DX #1人事業 #個人事業主 #生産性向上` },

    '2026-05-28': { type: 'pr', caption:
`1人事業のSaaSスタックを「業種×規模」で振り分けるAI診断、W22もアップ中。

→ 顧客管理に困ってる：CRM系
→ 請求/決済を自動化：決済+会計連携
→ 複数ツール統合：iPaaS/自動化系

3問30秒で振り分け。

プロフのリンク集から「1人事業 SaaS 診断」へ。

※リンクには広告が含まれます
#1人事業 #SaaS #CRM #iPaaS #業務自動化 #DX #フリーランス #個人事業主 #ビジネスツール #生産性向上` },

    '2026-05-29': { type: 'persona', caption:
`1人事業のサブスク費、月3万円超えたら一度棚卸し。

棚卸しの基準:
✓ 直近30日で何回起動したか
✓ 代替できる無料/安価ツールがあるか
✓ 年契約で割引効いてるか

これだけで月1〜2万円カットできるケース多い。「使ってるつもり」コストは想像以上にデカい。

#1人事業 #サブスク見直し #SaaS #コスト削減 #節約 #個人事業主 #フリーランス #業務効率化 #DX #起業` },

    '2026-05-30': { type: 'industry', caption:
`1人事業/小規模事業者向けSaaSの最近の傾向。

✓ 「AI自動化が標準装備」化
✓ iPaaS（Zapier/Make/n8n）が個人事業の中核に
✓ 月額より「使った分だけ課金」モデル増
✓ 日本語UI弱い海外ツールは選ばれにくく

#SaaS #1人事業 #iPaaS #n8n #Zapier #Make #AI自動化 #業務効率化 #DX #個人事業主` },

    '2026-05-31': { type: 'persona', caption:
`1人事業でツールを増やすとき、毎回確認するチェック項目。

✓ データのエクスポート機能があるか
✓ API/Webhookがあるか
✓ 契約解除がワンクリックか
✓ サポートが日本語 or 24時間英語

これ満たさないツールは長期運用に乗せない。

#SaaS選定 #業務効率化 #1人事業 #フリーランス #個人事業主 #DX #ビジネスツール #生産性向上 #IT #起業` },

    '2026-06-01': { type: 'persona', caption:
`1人事業の「請求→入金→会計」を完全自動化したら、月末経理時間が30分に圧縮。

構成:
✓ Stripeで決済→freeeに自動連携
✓ サブスク売上は月初に自動仕訳
✓ 経費は法人カード明細から自動取込
✓ 確定申告だけスポット税理士

#1人事業 #経理自動化 #freee #Stripe #会計 #業務効率化 #DX #SaaS #個人事業主 #フリーランス` },
  },

  A4: {
    '2026-05-26': { type: 'persona', caption:
`30代になって「自分の時間の使い方」を見直すとき、私が意識しているのは3つ。

✓ 体力に投資する時間（運動/睡眠/食事）
✓ 関係性に投資する時間（家族/友人/パートナー）
✓ 未来に投資する時間（学び/副業/資産形成）

20代の「とにかく走る」から、30代の「配分を選ぶ」に切り替わる感覚。

#30代の暮らし #ライフプラン #30代女子 #自己投資 #ライフスタイル #暮らし #健康 #婚活 #副業 #貯金` },

    '2026-05-27': { type: 'persona', caption:
`30代になって意識的に減らしたもの。

✓ なんとなくのSNSスクロール時間
✓ 付き合いだけの飲み会
✓ 必要以上のサブスク
✓ 「いつかやる」と先延ばしてる予約

増やしたのは「自分のペースで休む時間」と「対面で会いたい人だけと会う時間」。

#30代女子 #ライフスタイル #暮らし #ミニマリスト #時間術 #自己投資 #健康 #ライフプラン #30代の暮らし #女性の暮らし` },

    '2026-05-28': { type: 'persona', caption:
`30代女子の「お金の不安」、漠然と感じるより数字に落としたほうが軽くなる。

✓ 毎月の固定費合計
✓ 現在の貯蓄額（円/ヶ月分の生活費）
✓ 60歳までの想定収入レンジ
✓ 万一の医療費/介護費の想定範囲

数字にすると意外と打ち手は限られる。

#30代女子 #お金の話 #貯金 #資産形成 #ライフプラン #家計簿 #女性の働き方 #ライフスタイル #自己投資 #FP相談` },

    '2026-05-29': { type: 'pr', caption:
`30代女子向けの「次の1年の自分への投資」を3問AI診断で振り分けるページ、W22もアップ中。

→ キャリア寄り：転職/スキルアップ
→ 関係性寄り：婚活/コミュニティ
→ 自分軸寄り：自己投資/心身ケア

30秒で機械的に振り分け。

プロフのリンク集から。

※リンクには広告が含まれます
#30代女子 #自己投資 #婚活 #転職 #ライフプラン #キャリア #女性の働き方 #暮らし #自分磨き #コーチング` },

    '2026-05-30': { type: 'persona', caption:
`30代になって「断ること」が上手くなった人が周りで増えてる。

✓ 自分の優先順位が言語化できてる
✓ 「断った後に説明しすぎない」
✓ 代替案を即提示できる
✓ 断ることに罪悪感を引きずらない

「断れる人のほうが信頼される」って分かってきた。

#30代女子 #ライフスタイル #自己投資 #コミュニケーション #人間関係 #女性の生き方 #大人女子 #暮らし #自分磨き #境界線` },

    '2026-05-31': { type: 'industry', caption:
`30代女性の最近の選択を見てて感じる傾向。

✓ 「結婚/出産/キャリア」を年単位で調整
✓ 複数収入源（本業+副業+投資）がデフォ
✓ 住む場所を「会社で決めない」人増
✓ 健康投資（パーソナル/婦人科/メンタル）が標準化

選択肢が増えた分、自分軸を持つ必要性も上がった。

#30代女子 #ライフスタイル #女性の生き方 #婚活 #キャリア #副業 #投資 #健康管理 #自己投資 #ライフプラン` },

    '2026-06-01': { type: 'persona', caption:
`30代の私が「やってよかった」と思う月1ルーチン。

✓ 健康診断/婦人科の予約状況確認
✓ 固定費棚卸し（サブスク含む）
✓ スケジュールの「自分時間」ブロック
✓ 家計簿の月次サマリー確認

派手じゃないけど、「気づいたら病院も貯金も後回し」事故がゼロになる。

#30代女子 #暮らしのコツ #ライフスタイル #健康管理 #家計簿 #自己投資 #女性の生き方 #大人女子 #ルーチン #丁寧な暮らし` },
  },

  A5: {
    '2026-05-26': { type: 'persona', caption:
`20代後半で「このまま今の会社にいていいのか」って迷い始めるタイミング、ありませんか？

私の周りで動いた人の共通点:
✓ 3年以上同じ業務に「飽きた」
✓ 上司のキャリアパスを見て「ああはなりたくない」と思う
✓ 他社の同世代と話してスキル/待遇に差を感じる

1つでも当てはまったら、転職活動「だけ」始めるのは早めがいい。

#20代女子 #キャリア #転職活動 #20代後半 #第二新卒 #女性の働き方 #キャリアアップ #転職 #働き方 #自己分析` },

    '2026-05-27': { type: 'persona', caption:
`20代女性の転職、一番もったいないのは「年収レンジを知らずに動く」こと。

✓ doda/マイナビ/リクナビNEXTの業界平均
✓ OpenWork/転職会議の口コミ年収
✓ 転職エージェントから出てくる提示レンジ

最低この3つ見てから判断したほうが、市場価値の解像度が上がる。

#20代キャリア #転職活動 #年収アップ #転職 #女性の働き方 #キャリアアップ #20代女子 #20代後半 #第二新卒 #働き方` },

    '2026-05-28': { type: 'industry', caption:
`20代女性の働き方、最近の傾向で気になるところ。

✓ ハイブリッド勤務（週2-3出社）がデフォ
✓ 「副業OK」を転職条件にする人急増
✓ 新卒で入った会社に5年いる確率が体感半分以下
✓ 「いつ結婚/出産」前提の設計が薄まった

選択肢が増えた分、優先順位を言語化する力が問われる。

#20代女子 #キャリア #働き方 #女性の働き方 #ハイブリッドワーク #副業 #20代後半 #転職 #ライフプラン #キャリアウーマン` },

    '2026-05-29': { type: 'persona', caption:
`20代女性が「学び直し」を考えるとき、私が見てる3つの軸。

✓ 現職で活かせるか（年収反映の最短ルート）
✓ 転職で武器になるか（職種を変えたい場合）
✓ 独立/副業の入口になるか（中長期）

これを意識すると「人気だからって講座選んで使わない」事故が減る。

#20代キャリア #リスキリング #20代女子 #学び直し #女性の働き方 #スキルアップ #キャリアアップ #副業 #自己投資 #大人女子` },

    '2026-05-30': { type: 'pr', caption:
`20代女性向けの「次のキャリアの一歩」を3問AI診断で振り分けるページ、W22もアップ中。

→ 転職寄り：20代特化型エージェント
→ スキルアップ寄り：オンラインスクール
→ 自分軸を整えたい：キャリアコーチング

30秒で機械的に振り分け。

プロフのリンク集から「20代女性のキャリア診断」へ。

※リンクには広告が含まれます
#20代女子 #キャリア #転職 #リスキリング #女性の働き方 #20代後半 #キャリアコーチング #スキルアップ #自己投資 #第二新卒` },

    '2026-05-31': { type: 'persona', caption:
`20代女性が「自分は何が得意か分からない」って詰まった時、試してよかった棚卸し方法。

✓ 直近半年で「人から褒められた」エピソード5つ
✓ 「やってて時間を忘れた」作業3つ
✓ 「これはやりたくない」業務3つ

正解は「褒められた×時間忘れる」の交差点にあることが多い。

#20代女子 #自己分析 #キャリア #20代後半 #自己理解 #働き方 #女性の働き方 #ライフプラン #自己投資 #大人女子` },

    '2026-06-01': { type: 'persona', caption:
`20代後半で「キャリアの軸」を作るとき、大事にしてる問い。

✓ 5年後、どんな働き方をしていたいか
✓ 10年後、どんな人と一緒にいたいか
✓ 60歳になったとき、「やってよかった」と言える仕事は何か

今日答えられなくていい。半年〜1年かけて少しずつ輪郭が出てくる。

#20代女子 #キャリア #ライフプラン #20代後半 #自己投資 #女性の働き方 #大人女子 #キャリアアップ #働き方 #自己分析` },
  },
};

// ─── 画像 URL マップ (Gemini が Drive アップ後ここに書き込む) ─
const IMAGE_URLS_PATH = path.resolve(__dirname, 'ig-image-urls.json');

type ImageMap = Record<string, Record<string, string>>; // account -> date -> URL

function loadImageUrls(): ImageMap {
  if (!fs.existsSync(IMAGE_URLS_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(IMAGE_URLS_PATH, 'utf-8')); }
  catch { return {}; }
}

// ─── 法令ハードロック 8種 ─────────────────────────
const BANNED_WORDS = [
  '絶対', '必ず', '100%', '永久', '完璧', '確実に', '劇的に',
  '世界一', '日本一', 'No.1', 'ナンバーワン',
  '副作用なし', '副作用ゼロ',
  '治る', '治療', '治癒', '完治', '医薬品', '医薬部外品',
  'アンチエイジング効果', '美白効果', '痩身効果',
  '驚きの効果', 'みるみる',
];

const PR_NOTICE_PATTERN = /※\s*リンクには広告/;

type GuardResult = { ok: boolean; reason?: string };

function graphemeLen(s: string): number {
  return [...s].length;
}

function runGuards(post: Post): GuardResult {
  // G1: 2200 char limit (IG caption)
  const len = graphemeLen(post.caption);
  if (len > 2200) return { ok: false, reason: `Over 2200 chars (${len})` };

  // G2: PR notice required for 'pr' type
  if (post.type === 'pr' && !PR_NOTICE_PATTERN.test(post.caption)) {
    return { ok: false, reason: 'PR post missing 広告 notice' };
  }

  // G3: Banned words
  for (const word of BANNED_WORDS) {
    if (post.caption.includes(word)) {
      return { ok: false, reason: `Banned word: "${word}"` };
    }
  }

  // G4: 虚偽体験談禁止
  const fakeExpPatterns = ['実際に使ってみた', '使ってよかった', '私も使ってる'];
  for (const p of fakeExpPatterns) {
    if (post.caption.includes(p)) {
      return { ok: false, reason: `Fake experience: "${p}"` };
    }
  }

  // G5: Hashtag count (IG hard cap = 30)
  const hashtagCount = (post.caption.match(/#[^\s#]+/g) ?? []).length;
  if (hashtagCount > 30) return { ok: false, reason: `Hashtags over 30 (${hashtagCount})` };

  return { ok: true };
}

// ─── IG Graph API 実行 ─────────────────────────

async function fetchRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      const msg = (e as Error).message;
      console.log(`  ⚠️  ${label} fetch attempt ${attempt}/3 failed: ${msg.slice(0, 80)}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 15000));
    }
  }
  throw new Error(`${label} fetch failed after 3 attempts: ${(lastErr as Error)?.message}`);
}

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

async function createIgMediaContainer(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption: caption,
    access_token: token,
  });
  const url = `${GRAPH_BASE}/${igUserId}/media?${params.toString()}`;
  const res = await fetchRetry(url, { method: 'POST' }, 'createIgMediaContainer');
  const textBody = await res.text();
  if (!res.ok) throw new Error(`IG media container creation failed: HTTP ${res.status} ${textBody.slice(0, 200)}`);
  const data = JSON.parse(textBody) as { id?: string };
  if (!data.id) throw new Error(`IG container ID missing: ${textBody.slice(0, 200)}`);
  return data.id;
}

async function waitForContainerReady(containerId: string, token: string, maxWaitSec = 60): Promise<void> {
  const params = new URLSearchParams({
    fields: 'status_code',
    access_token: token,
  });
  const url = `${GRAPH_BASE}/${containerId}?${params.toString()}`;
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWaitSec) {
    const res = await fetchRetry(url, { method: 'GET' }, 'waitForContainerReady');
    const textBody = await res.text();
    if (!res.ok) throw new Error(`Container status check failed: HTTP ${res.status} ${textBody.slice(0, 200)}`);
    const data = JSON.parse(textBody) as { status_code?: string };
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Container processing ERROR: ${textBody.slice(0, 200)}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Container ${containerId} not ready after ${maxWaitSec}s`);
}

async function publishIgMediaContainer(
  igUserId: string,
  token: string,
  containerId: string
): Promise<string> {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: token,
  });
  const url = `${GRAPH_BASE}/${igUserId}/media_publish?${params.toString()}`;
  const res = await fetchRetry(url, { method: 'POST' }, 'publishIgMediaContainer');
  const textBody = await res.text();
  if (!res.ok) throw new Error(`IG publish failed: HTTP ${res.status} ${textBody.slice(0, 200)}`);
  const data = JSON.parse(textBody) as { id?: string };
  if (!data.id) throw new Error(`IG media ID missing: ${textBody.slice(0, 200)}`);
  return data.id;
}

// ─── 週次バッチ JSON 取り込み（W23 以降） ─────────────────────────────────
// W22 までは BATCH_POSTS にハードコード / W23 以降は scripts/affiliate-ig-batches/w{N}.json で外出し
const BATCHES_DIR = path.resolve(__dirname, 'affiliate-ig-batches');

function loadWeeklyBatches(): void {
  if (!fs.existsSync(BATCHES_DIR)) return;
  const files = fs.readdirSync(BATCHES_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BATCHES_DIR, file), 'utf-8')) as Record<string, any>;
      for (const [accId, daily] of Object.entries(data)) {
        if (accId.startsWith('_')) continue;
        if (!BATCH_POSTS[accId]) BATCH_POSTS[accId] = {};
        for (const [dateStr, post] of Object.entries(daily as Record<string, any>)) {
          if (BATCH_POSTS[accId][dateStr]) continue; // hardcoded を優先
          BATCH_POSTS[accId][dateStr] = post as Post;
        }
      }
    } catch (e) {
      console.error(`⚠️  batch ${file} load failed:`, (e as Error).message);
    }
  }
}

loadWeeklyBatches();

// ─── 重複検知 ─────────────────────────────────
// standalone vessel: logs live inside the bundle (was '..','logs' in the monorepo)
const LOG_PATH = path.resolve(__dirname, 'logs', 'ig-posts.json');

type LogEntry = {
  account: string;
  date: string;
  type: string;
  variant?: string;
  caption: string;
  captionHash: string;
  imageUrl?: string;
  mediaId?: string;
  error?: string;
  postedAt: string;
};

function loadLog(): LogEntry[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')); }
  catch { return []; }
}

function saveLog(entries: LogEntry[]) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2));
}

function hashText(text: string): string {
  let h = 0;
  for (const c of text) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return h.toString(36);
}

function isDuplicate(accountId: string, captionHash: string, log: LogEntry[]): boolean {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return log.some(e =>
    e.account === accountId &&
    e.captionHash === captionHash &&
    new Date(e.postedAt).getTime() > sevenDaysAgo &&
    !e.error
  );
}

// ─── メイン ────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateArg = args.find(a => a.startsWith('--date='))?.split('=')[1];
  // JST date (UTC+9)
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const targetDate = dateArg ?? nowJst.toISOString().slice(0, 10);

  console.log(`\n=== Instagram 5アカ アフィリ投稿 ===`);
  console.log(`日付: ${targetDate} ${dryRun ? '(DRY-RUN)' : '(本番)'}`);
  console.log(``);

  const log = loadLog();
  const imageUrls = loadImageUrls();
  const newEntries: LogEntry[] = [];

  for (const acc of ACCOUNTS) {
    const rawEntry = BATCH_POSTS[acc.id]?.[targetDate];
    if (!rawEntry) {
      console.log(`⏭️  ${acc.id} @${acc.handle.padEnd(20)} 投稿なし (バッチに該当日なし)`);
      continue;
    }
    const candidates: Post[] = Array.isArray(rawEntry) ? rawEntry : [rawEntry];
    // format で振り分け。format 省略は feed（既存バッチ後方互換）。
    const feeds   = candidates.filter(p => (p.format ?? 'feed') === 'feed');
    const stories = candidates.filter(p => p.format === 'story');
    const reels   = candidates.filter(p => p.format === 'reel');

    // ===== FEED（既存挙動。IIFEで包み feed の早期return が story/reel をスキップしないように） =====
    await (async () => {
      if (!feeds.length) return;
      let post: Post | null = null;
      let captionHash = '';
      for (const candidate of feeds) {
        const candHash = hashText(candidate.caption);
        if (!isDuplicate(acc.id, candHash, log)) { post = candidate; captionHash = candHash; break; }
      }
      if (!post) { console.log(`⏭️  ${acc.id} @${acc.handle.padEnd(20)} feed:本日分は投稿済み`); return; }
      const guards = runGuards(post);
      if (!guards.ok) {
        console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} feed ${guards.reason}`);
        newEntries.push({ account: acc.id, date: targetDate, type: post.type, variant: post.variant, caption: post.caption, captionHash, error: guards.reason, postedAt: new Date().toISOString() });
        return;
      }
      const imageUrl = post.media_url ?? imageUrls[acc.id]?.[targetDate];
      if (!imageUrl) {
        console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} feed 画像URL未登録 (ig-image-urls.json か media_url)`);
        newEntries.push({ account: acc.id, date: targetDate, type: post.type, variant: post.variant, caption: post.caption, captionHash, error: 'Image URL not registered', postedAt: new Date().toISOString() });
        return;
      }
      if (dryRun) {
        const tokenStatus = (acc.igUserId && acc.token) ? 'token=OK' : 'token=MISSING';
        console.log(`✅ ${acc.id} @${acc.handle.padEnd(20)} [DRY] feed ${post.type}${post.variant ? `[${post.variant}]` : ''} cap=${graphemeLen(post.caption)}字 img=${imageUrl.slice(0, 50)}... ${tokenStatus}`);
        return;
      }
      if (!acc.igUserId || !acc.token) { console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} feed IG_*_${acc.id} 未設定`); return; }
      try {
        console.log(`▶️  ${acc.id} @${acc.handle} feed コンテナ作成中...`);
        const containerId = await createIgMediaContainer(acc.igUserId, acc.token, imageUrl, post.caption);
        await waitForContainerReady(containerId, acc.token);
        const mediaId = await publishIgMediaContainer(acc.igUserId, acc.token, containerId);
        console.log(`✅ ${acc.id} @${acc.handle.padEnd(20)} feed ${post.type}${post.variant ? `[${post.variant}]` : ''} → https://www.instagram.com/p/${mediaId}/`);
        newEntries.push({ account: acc.id, date: targetDate, type: post.type, variant: post.variant, caption: post.caption, captionHash, imageUrl, mediaId, postedAt: new Date().toISOString() });
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} feed ${msg.slice(0, 150)}`);
        newEntries.push({ account: acc.id, date: targetDate, type: post.type, variant: post.variant, caption: post.caption, captionHash, imageUrl, error: msg, postedAt: new Date().toISOString() });
      }
      if (!dryRun) await new Promise(r => setTimeout(r, 10000));
    })();

    // ===== STORY（postStory。画像/動画の公開URL。Storyはcaption不可） =====
    for (const story of stories) {
      const mediaUrl = story.media_url;
      if (!mediaUrl) { console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} story: media_url 未設定`); continue; }
      const cHash = hashText('story:' + mediaUrl);
      if (isDuplicate(acc.id, cHash, log)) { console.log(`⏭️  ${acc.id} @${acc.handle.padEnd(20)} story:投稿済み`); continue; }
      const isVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(mediaUrl);
      if (dryRun) { console.log(`✅ ${acc.id} @${acc.handle.padEnd(20)} [DRY] story ${isVideo ? 'video' : 'image'}=${mediaUrl.slice(0, 50)}... ${(acc.igUserId && acc.token) ? 'token=OK' : 'token=MISSING'}`); continue; }
      if (!acc.igUserId || !acc.token) { console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} story IG_*_${acc.id} 未設定`); continue; }
      try {
        const mediaId = await postStory(acc.igUserId, acc.token, isVideo ? { videoUrl: mediaUrl } : { imageUrl: mediaUrl });
        console.log(`✅ ${acc.id} @${acc.handle.padEnd(20)} story → ${mediaId}`);
        newEntries.push({ account: acc.id, date: targetDate, type: 'story', caption: story.caption ?? '', captionHash: cHash, imageUrl: mediaUrl, mediaId, postedAt: new Date().toISOString() });
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} story ${msg.slice(0, 150)}`);
        newEntries.push({ account: acc.id, date: targetDate, type: 'story', caption: story.caption ?? '', captionHash: cHash, imageUrl: mediaUrl, error: msg, postedAt: new Date().toISOString() });
      }
      if (!dryRun) await new Promise(r => setTimeout(r, 10000));
    }

    // ===== REEL（postReel。公開動画URL + caption。法令ガード適用） =====
    for (const reel of reels) {
      const mediaUrl = reel.media_url;
      if (!mediaUrl) { console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} reel: media_url 未設定`); continue; }
      const cHash = hashText('reel:' + mediaUrl);
      if (isDuplicate(acc.id, cHash, log)) { console.log(`⏭️  ${acc.id} @${acc.handle.padEnd(20)} reel:投稿済み`); continue; }
      const g = runGuards(reel);
      if (!g.ok) { console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} reel ${g.reason}`); newEntries.push({ account: acc.id, date: targetDate, type: 'reel', variant: reel.variant, caption: reel.caption, captionHash: cHash, error: g.reason, postedAt: new Date().toISOString() }); continue; }
      if (dryRun) { console.log(`✅ ${acc.id} @${acc.handle.padEnd(20)} [DRY] reel video=${mediaUrl.slice(0, 50)}... cap=${graphemeLen(reel.caption)}字 ${(acc.igUserId && acc.token) ? 'token=OK' : 'token=MISSING'}`); continue; }
      if (!acc.igUserId || !acc.token) { console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} reel IG_*_${acc.id} 未設定`); continue; }
      try {
        const mediaId = await postReel(acc.igUserId, acc.token, mediaUrl, reel.caption);
        console.log(`✅ ${acc.id} @${acc.handle.padEnd(20)} reel → https://www.instagram.com/reel/${mediaId}/`);
        newEntries.push({ account: acc.id, date: targetDate, type: 'reel', variant: reel.variant, caption: reel.caption, captionHash: cHash, imageUrl: mediaUrl, mediaId, postedAt: new Date().toISOString() });
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`❌ ${acc.id} @${acc.handle.padEnd(20)} reel ${msg.slice(0, 150)}`);
        newEntries.push({ account: acc.id, date: targetDate, type: 'reel', variant: reel.variant, caption: reel.caption, captionHash: cHash, imageUrl: mediaUrl, error: msg, postedAt: new Date().toISOString() });
      }
      if (!dryRun) await new Promise(r => setTimeout(r, 10000));
    }
  }

  if (!dryRun && newEntries.length > 0) {
    saveLog([...log, ...newEntries]);
    console.log(`\nログ保存: ${LOG_PATH}`);
  }

  const errors = newEntries.filter(e => e.error).length;
  const success = newEntries.filter(e => !e.error).length;
  console.log(`\n=== 完了: 成功 ${success} / エラー ${errors} ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
