# Netlify「Gitリポジトリ連携による自動デプロイ」への切り替え手順

このサイトを **GitHub（ギットハブ）** に置き、**Netlify（ネットリファイ）が GitHub の更新を見て自動で公開する**仕組みに切り替えるための手順書です。

切り替えが完了すると、これまでやっていた **「手動アップロード（Netlify へ zip をドロップ）」は不要**になります。
さらに microCMS でブログ記事を「公開」すると、自動でビルド＆反映されるようになります。

```
[あなた]                [GitHub]              [Netlify]
 git push  ───────▶  ソースを保管  ───────▶  自動でビルドして公開
                                              （npm run build → dist を公開）
```

> ✅ **パソコン側の準備（git の初期化・初回コミット）はすでに完了しています。**
> あなたがこれから行うのは「GitHubアカウント作成 → リポジトリ作成 → プッシュ → Netlify連携」です。
> 順番にやれば大丈夫です。専門知識は不要です。

---

## 全体の流れ（やることリスト）

1. GitHub のアカウントを作る（無料）
2. GitHub で空のリポジトリ（ソースの置き場所）を作る
3. パソコンから GitHub へ初回プッシュ（アップロード）する
4. Netlify でこの GitHub リポジトリを連携する
5. Netlify に環境変数（microCMS のキー）を登録する
6. Netlify の Build hook を作り、microCMS の Webhook に登録する
7. microCMS で「公開」を押すと自動反映される運用へ

---

## 1. GitHub のアカウントを作る（無料）

1. [https://github.com/signup](https://github.com/signup) を開く
2. メールアドレス・パスワード・ユーザー名を入力して、案内に従って登録する
   - ここで決めた **ユーザー名** を、あとの手順（プッシュ）で使います。控えておきましょう。
3. メール認証まで完了すれば準備OK（無料プランでまったく問題ありません）

---

## 2. GitHub で空のリポジトリを作る

「リポジトリ」とは、ソースコード（ホームページのファイル）の置き場所のことです。

1. GitHub にログインした状態で、右上の「**＋**」→「**New repository**」を開く
   - または [https://github.com/new](https://github.com/new) を開く
2. 次のように入力する
   - **Repository name（リポジトリ名）**：`shoei-toso-website`
   - **Public / Private**：どちらでもOK
     - **Public（公開）**：世界中の誰でもソースコードを見られます（中身は公開ホームページなので問題は少ない）。
     - **Private（非公開）**：あなたと許可した人だけが見られます。**迷ったら Private がおすすめ**です。
       （どちらを選んでも、Netlify での連携・公開には影響しません）
   - **Add a README file**：**チェックしない**
   - **Add .gitignore**：**「None」のまま（追加しない）**
   - **Add a license**：**追加しない**

   > ⚠ 重要：README や .gitignore を「追加」してしまうと、リポジトリが空でなくなり、
   > 次の手順のプッシュでエラーになることがあります。**必ず「何も追加しない＝空のリポジトリ」**で作ってください。

3. 「**Create repository（リポジトリを作成）**」を押す
4. 作成後の画面に表示される URL（`https://github.com/あなたのユーザー名/shoei-toso-website.git`）を控えておく

---

## 3. パソコンから GitHub へ初回プッシュする

パソコンの「ターミナル」アプリを開き、次のコマンドを **1行ずつ** 実行します。
（`<あなたのGitHubユーザー名>` の部分は、手順1で決めた自分のユーザー名に置き換えてください）

```bash
cd ~/Desktop/昇栄塗装ホームページ
git remote add origin https://github.com/<あなたのGitHubユーザー名>/shoei-toso-website.git
git push -u origin main
```

- 1行目：このプロジェクトのフォルダに移動します。
- 2行目：「アップロード先（origin）」として、手順2で作った GitHub リポジトリを登録します。
- 3行目：実際に GitHub へアップロード（プッシュ）します。

> 💡 もし 2行目で `error: remote origin already exists`（既に登録済み）と出たら、
> 代わりに次のコマンドで上書きしてから 3行目を実行してください。
> `git remote set-url origin https://github.com/<あなたのGitHubユーザー名>/shoei-toso-website.git`

### プッシュ時の「認証（ログイン確認）」について

GitHub は **パスワードでのプッシュを廃止**しています。初回プッシュのときに、次のいずれかが求められます。

- **（おすすめ）ブラウザ認証**：
  Mac には「Git Credential Manager」やキーチェーンの仕組みがあり、初回プッシュ時に
  **自動でブラウザが開いて GitHub のログイン画面が出る**ことがあります。
  画面の指示どおりログイン＆許可すれば、それ以降は自動でログイン状態が保存されます。

- **Personal Access Token（PAT）を使う方法**：
  ブラウザ認証が出ず「Username / Password」を聞かれた場合は、
  - Username：あなたの GitHub ユーザー名
  - Password：**パスワードではなく「個人アクセストークン（PAT）」を貼り付ける**
  PAT は GitHub の [https://github.com/settings/tokens](https://github.com/settings/tokens) で発行できます
  （「Generate new token」→ `repo` 権限にチェック → 発行された文字列をコピー）。
  発行した文字列は一度しか表示されないのでメモしておきましょう。

- **コマンドが難しいと感じたら（GitHub Desktop を使う）**：
  [https://desktop.github.com/](https://desktop.github.com/) から「GitHub Desktop」アプリを入れると、
  ボタン操作だけでログイン・プッシュができます。コマンドが苦手な場合はこちらが簡単です。

プッシュが成功すると、GitHub のリポジトリ画面を再読み込みしたときにファイル一覧が表示されます。

---

## 4. Netlify でこの GitHub リポジトリを連携する

1. [https://app.netlify.com/](https://app.netlify.com/) にログイン
2. 「**Add new site（サイトを追加）**」→「**Import an existing project（既存プロジェクトを取り込む）**」を選ぶ
3. 「**Deploy with GitHub**」を選び、GitHub との連携（認可）を許可する
   - 初回は GitHub のログイン＆「Netlify にアクセスを許可するか」の確認が出ます。許可してください。
   - リポジトリの選択画面で `shoei-toso-website` が見えない場合は、
     「Configure the Netlify app on GitHub」から、このリポジトリへのアクセスを許可してください。
4. 一覧から **`shoei-toso-website`** を選ぶ
5. ビルド設定を次のとおりにする（多くの場合 `netlify.toml` から自動で入りますが、念のため確認）
   - **Build command（ビルドコマンド）**：`npm run build`
   - **Publish directory（公開ディレクトリ）**：`dist`
6. 「**Deploy（デプロイ）**」を押す

> 📌 この時点で環境変数（microCMS のキー）がまだ未登録だと、ブログ記事が 0 件になることがあります。
> その場合は次の「手順5」を行ってから、もう一度デプロイ（再ビルド）してください。

---

## 5. Netlify に環境変数を登録する

ブログ機能（microCMS）を動かすために、APIキーなどを Netlify に登録します。

1. 連携したサイトを開き、「**Site configuration（サイト設定）**」→「**Environment variables（環境変数）**」を開く
2. 「**Add a variable**」→「**Add a single variable**」で、次の2つを登録する

| Key（名前） | Value（値） |
|---|---|
| `MICROCMS_SERVICE_DOMAIN` | あなたの microCMS サービスドメイン（例 `shoei-toso`） |
| `MICROCMS_API_KEY` | あなたの microCMS APIキー（長い英数字） |

3. 保存する
4. 「**Deploys**」→「**Trigger deploy → Deploy site**」で一度再ビルドし、記事が反映されるか確認する

> 名前（Key）は **スペル・大文字小文字を正確に** 入力してください。1文字でも違うと動きません。
> 値（APIキー）は「パスワード」と同じ秘密情報です。人に見せないでください。

---

## 6. Build hook と microCMS の Webhook を登録する

microCMS で「公開」を押したときに、Netlify が自動でビルドするようにします。

1. **Netlify 側**：「**Build & deploy**」→「**Build hooks**」→「**Add build hook**」
   - 名前：例 `microcms-publish`／ブランチ：`main`
   - 作成すると `https://api.netlify.com/build_hooks/xxxxxxxx` のような URL が出るので **コピー**
2. **microCMS 側**：`blogs` の API設定 →「**Webhook**」→「追加」
   - URL に、上でコピーした Build hook の URL を貼り付ける
   - 通知タイミングは少なくとも **「公開・更新時」** と **「削除時」** にチェック
   - 保存する

> この手順5・6は、既存の **`ブログ機能セットアップ.md` の手順4〜7** と同じ内容です。
> より詳しい説明やつまずいたときの対処は、そちらも参照してください（重複する部分はこの手順書では省略しています）。

---

## 7. これ以降の運用フロー（毎日の使い方）

1. スマホ／PC で microCMS にログインして記事を書く
2. 「**公開**」を押す
3. **これだけ**。microCMS の Webhook → Netlify の Build hook → 自動ビルド → 数分でホームページに反映されます

パソコンでのコマンド実行や、zip の手動アップロードは **もう不要**です。

---

## ⚠ 切り替え時の注意（公開先サイトの扱い）

これまで「手動アップロード（Netlify Drop）」で運用していた場合、**そのサイトとは別に、今回 Git 連携した新しいサイトができます**。
公開先（実際に見えるホームページ）が、どちらのサイトになるかに注意してください。選択肢は次の2つです。

- **(A) 新しい Git 連携サイトに、独自ドメインを付け替える**（おすすめ）
  - 新サイトが正しくビルド・表示されることを確認してから、
    独自ドメイン（例 `〇〇.com`）の設定を、旧サイトから新サイトへ移します。
  - 旧サイト（手動アップロード版）は、移行が落ち着いたら削除してOKです。

- **(B) 既存サイトに Git 連携を「上書き」する**
  - 既存サイトの「Site configuration → Build & deploy」から、後付けで GitHub リポジトリを接続する方法です。
  - こちらはドメインの付け替えが不要ですが、設定が少し分かりにくいことがあります。

> 迷ったら **(A)** が安全です。「新サイトが正しく表示されること」を確認してからドメインを移せば、
> 表示が一時的に崩れる心配がありません。

---

## 補足：パソコン側で完了している準備（参考）

このプロジェクトでは、すでに次の準備が済んでいます（あなたが追加で行う必要はありません）。

- このフォルダを独立した Git リポジトリとして初期化（デフォルトブランチ `main`）
- `.gitignore` の整備（`.env`・`node_modules/`・`dist/`・`netlify-deploy.zip` などを除外）
- 初回コミットの作成（秘密情報や巨大ファイルを含まないことを確認済み）

そのため、あなたは **手順1（GitHubアカウント作成）から** 始めれば大丈夫です。
