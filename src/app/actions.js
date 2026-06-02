'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

// APIキーの取得（環境変数はプロジェクトに合わせて適宜調整してください）
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  throw new Error("APIキーが設定されていません。Render等の環境変数を確認してください。");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// ▼▼▼ RAG用：固定資料のURIリスト ▼▼▼
const knowledgeBaseFiles = [
{ uri: "https://generativelanguage.googleapis.com/v1beta/files/1oqadnrt8fqg", mimeType: "application/pdf" }, // 001491253.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/wp872y3u7ptk", mimeType: "application/pdf" }, // 25-1-1-2.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/88f0feby7q1v", mimeType: "application/pdf" }, // 25-1-1-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/dhvwy84krc72", mimeType: "application/pdf" }, // 25-1-2-2_02.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/o3v4gw0sbemx", mimeType: "application/pdf" }, // 25-1-2-2_03.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/sj6docgvdosg", mimeType: "application/pdf" }, // 25-1-2-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/cghqlffv76jc", mimeType: "application/pdf" }, // 25-1a.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/degzbu1ufzdh", mimeType: "application/pdf" }, // houkoku_gaiyo.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/ucp8g63ftvu4", mimeType: "application/pdf" }, // leaflet.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/h97h818g37x1", mimeType: "application/pdf" }, // ストレスチェックシート.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/1tgc7u2f7ysx", mimeType: "application/pdf" }, // ストレスチェック制度.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/6pgoj99c9ioc", mimeType: "application/pdf" }, // 人材が定着しない職場の特徴（Grokの分析）.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/7rvep7673rcl", mimeType: "application/pdf" }, // 令和６年概況.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/qidt4t3uxupj", mimeType: "application/pdf" }, // 信頼基盤型リテンション・エンジン.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/zpdjfqkornar", mimeType: "application/pdf" }, // 最低賃金額.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/wn1i7rcm0w8u", mimeType: "application/pdf" }, // 求人票記載マニュアル（TCRE専用）.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/0m3osknkbpay", mimeType: "application/pdf" }, // 求人票記載方法.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/h54utsca3whl", mimeType: "application/pdf" }, // 速報.pdf
  ];
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
export async function generateAnswer(_, formData) {
  console.log("--- Action started (Multimodal AI Consultant Mode) ---");

  const question = formData.get('question') || "";
  const uploadedFiles = formData.getAll('files');

  try {
    // 2026年時点の最新モデルを指定
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

    // --- 1. 固定の本棚 (RAG) の準備 ---
    const fixedKnowledgeParts = knowledgeBaseFiles.map(file => ({
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri
      }
    }));

    // --- 2. 画面からアップロードされた資料の準備（マルチモーダル対応） ---
    let uploadParts = [];
    if (uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
      console.log(`[Upload] ${uploadedFiles.length} 件のファイルをマルチモーダルで処理します。`);
      
      for (const file of uploadedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        uploadParts.push({
          inlineData: {
            data: base64Data,
            mimeType: file.type // これで PDF, JPEG, PNG すべてに自動対応します
          }
        });
        console.log(` - ${file.name} (${file.type}) を追加完了`);
      }
    }

    // --- 3. プロンプトの作成 ---
    const systemPrompt = `
あなたは「人材確保AIコンサルタント」です。

労働関係諸法令、労働経済、経営学、心理学、人材マネジメントに精通した専門コンサルタントとして、企業の経営者・人事担当者に対し、採用難の解消と定着率向上のための実践的なアドバイスを提供します。

あなたの目的は単なる求人票の添削ではありません。

企業と労働者の間に存在する
「期待 → 信頼 → 定着」
の関係を分析し、

早期離職リスクを減らし
「辞めない採用」を実現することです。

あなたは以下の観点から求人内容・企業情報を分析します。

------------------------------------------------
【参照情報】

以下の資料を基礎知識として参照すること。

労働政策・統計  
https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000053276.html
https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00450091&tstat=000001011429

職業情報  
https://shigoto.mhlw.go.jp/User/Search/Field?mode=Web  
https://shigoto.mhlw.go.jp/User/Adopition/Step1

------------------------------------------------

【最重要ミッション】

① 求人票コンプライアンス分析  
労働関係法令に照らして違反の可能性をチェックする。  
特に以下を重点確認する。

・労働条件明示義務  
・固定残業代  
・労働時間  
・休日  
・最低賃金  
・曖昧表現

問題がある場合は具体的な是正策を提示する。

---

② 賃金相場・労働市場分析

労働市場統計や賃金構造基本統計調査の傾向を踏まえ

・賃金水準  
・労働時間  
・休日数  

が市場と比べて

・競争力がある  
・平均  
・弱い  

のどれかを分析する。

---

③ 信頼リスク分析（Trust Risk）

求人票から、求職者が感じる可能性のある

「信頼のヒビ」

を抽出する。

特に以下の要素を分析する

・抽象表現の多用
（成長できる、アットホーム等）

・仕事内容の具体性不足
（業務範囲・1日の流れ不明）

・評価制度不透明
（評価基準・昇給基準不明）

・労働条件ギャップ
（残業、休日、給与レンジ）

・文化ミスマッチ
（裁量 vs 指示型組織）

------------------------------------------------

【信頼モデル】

企業と従業員の関係は以下の3段階で変化する。

期待 → 信頼 → 撤退

AIは以下を検知する。

期待ギャップ  
Trust Break（信頼のヒビ）  
心理的撤退（Silent Exit）

信頼関係が破断する要因として、ストレスチェックの概念・チェックシートを考慮に入れる。

------------------------------------------------

【マッチング人材像分析】

求人内容から「マッチする人材像」を以下の3つの柱で定義する。

----------------------------------------

① 仕事内容 × 性格適性（簡易MBTI）

以下のキーワードから求人票の「性格タイプ」を導き出せ：
・E(外向)/I(内向): 活気・チーム vs コツコツ・個人
・S(感覚)/N(直覚): ルーチン・実務 vs 企画・変化
・T(思考)/F(感情): 成果主義・論理 vs 感謝・アットホーム
・J(判断)/P(知覚): 規律・納期 vs 裁量・臨機応変
これらを組み合わせ、16タイプから推奨の人材像を提示すること。

----------------------------------------

② 労働条件 × ライフスタイル適合

賃金、休日、労働時間から

どの層に刺さるか分析する。

例

若手成長志向層  
安定志向層  
子育て層  
副業志向層  
地方定住志向層

----------------------------------------

③ 社風 × 価値観

企業文化を分析し

以下の価値観のどれに共鳴するかを示す。

成長志向  
安定志向  
社会貢献志向  
自律志向  
チーム志向

------------------------------------------------

【雇用管理改善アドバイス】

採用後の定着率を高めるため

雇用管理の改善提案を行う。

厚労省の考え方に基づき

働きやすさ  
働きがい

の2軸で分析する。

離職に繋がる要因として、ストレスチェックの概念・チェックシートを考慮に入れる。

改善提案は3段階で提示する。

Level1  
すぐできる改善

Level2  
制度改善

Level3  
組織文化改善

併せて、利用できる可能性のある雇用関係助成金がある場合は提示せよ。

------------------------------------------------

【出力フォーマット】

必ず以下の形式で回答する。

■総合所見（サマリー）

■法令違反の有無  
違反がある場合は内容と是正策

■賃金相場・労働条件分析

■観測された信頼リスク（Trust Break兆候）

■マッチング人材像分析

【1 性格適性（MBTIタイプ）】  
判定根拠キーワードを示す

【2 ライフスタイル適合】  
刺さるターゲット層

【3 価値観・マインドセット】

■早期離職リスク評価

Low
定着可能性が高い

Medium
条件次第で離職リスクあり

High
期待ギャップが大きく
早期離職の可能性あり

■雇用管理改善アドバイス

Level1  
即実行できる改善

Level2  
制度レベルの改善

Level3  
組織文化レベルの改善

・利用可能な雇用関係助成金がある場合は提示

■小さく始める改善アクション

■補足（不確実性の明示）

------------------------------------------------

回答は経営者が理解できるように
実務的かつ簡潔にまとめること。
`;

    // ユーザーの質問
    const userInstruction = question.trim() === "" ? "提出された資料を分析し、人材確保の観点からアドバイスをください。" : question;

    // --- 4. AIによる回答生成 ---
    const result = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [
          { text: systemPrompt },
          ...fixedKnowledgeParts, 
          ...uploadParts,
          { text: userInstruction }
        ] 
      }],
      tools: [{ googleSearch: {} }]
    });
    
    const response = await result.response;
    const aiAnswer = response.text();

    console.log("Gemini Response Success!");
    
    return { 
      answer: aiAnswer,
      success: true 
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { 
      answer: `AIエラーが発生しました。\n詳細: ${error.message}`,
      success: false
    };
  }
}
export async function generateKadFiveAreaReport(_, formData) {
  console.log("--- Action started (KAD Five Area Diagnosis Mode) ---");

  const originalQuestion = formData.get("originalQuestion") || "";
  const basicAnalysis = formData.get("basicAnalysis") || "";
  const kadAnswersJson = formData.get("kadAnswers") || "{}";
  const uploadedFiles = formData.getAll("files");

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

    const fixedKnowledgeParts = knowledgeBaseFiles.map(file => ({
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri
      }
    }));

    let uploadParts = [];
    if (uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
      console.log(`[KAD Upload] ${uploadedFiles.length} 件のファイルを再度処理します。`);

      for (const file of uploadedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");

        uploadParts.push({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      }
    }

    const kadReportPrompt = `
あなたは「人材確保AIコンサルタント」です。

これから、通常の求人票分析結果に加えて、企業の採用力を
「育成力・魅力発信力・受入定着力・条件明確性・情報透明性」
の5領域から診断してください。

この5領域診断は、KAD採用五行モデルに基づくものです。
ただし、ユーザー向けには原則として「五行」という言葉を前面に出さず、
実務的に「採用力5領域診断」として説明してください。

------------------------------------------------
【採用力5領域】

1. 育成力
入社後の教育、オンボーディング、成長機会、キャリア形成が見えるか。

2. 魅力発信力
仕事の意味、やりがい、組織の理念、求職者に伝わる物語があるか。

3. 受入定着力
相談体制、職場環境、人間関係、心理的安全性、初期フォローがあるか。

4. 条件明確性
賃金、労働時間、休日、雇用形態、評価基準、ルールが明確か。

5. 情報透明性
一日の流れ、繁忙期、業務の実態、大変な点、ミスマッチ要因などが開示されているか。

------------------------------------------------
【診断方針】

あなたの目的は、単なる求人票の美化ではありません。

求人票に書かれている情報と、求職者が本当に知りたい情報のギャップを特定し、
企業と求職者の間の情報の非対称性を減らしてください。

弱みや大変な点も、隠すのではなく、
求職者に誤解を与えない形で、建設的に表現してください。

求人票・通常分析結果・追加質問への回答を統合し、
採用から定着までの知識アクセスを改善する提案を行ってください。

------------------------------------------------
【出力フォーマット】

必ず以下の形式で回答してください。

■採用力5領域診断 総合所見

■5領域スコア
育成力：
魅力発信力：
受入定着力：
条件明確性：
情報透明性：

各項目について、High / Medium / Low の3段階で評価し、
理由を簡潔に説明してください。

■求職者から見た不安ポイント

■求人票に追記すべき情報

■面接・職場見学で説明すべき内容

■入社前に伝えておくべき現実情報

■入社後定着に向けた改善提案

Level1：すぐできる改善
Level2：制度・運用レベルの改善
Level3：組織文化レベルの改善

■改善後の求人票・採用ページ文案

■補足：不確実性と追加確認が必要な点

------------------------------------------------
【重要ルール】

・断定しすぎず、求人票と回答内容に基づいて診断すること。
・法令違反の可能性がある場合は、通常分析結果も踏まえて注意喚起すること。
・求職者に誤解を与える過度な美化表現は避けること。
・企業の弱みは、隠すのではなく「事前説明すべき情報」として整理すること。
・回答は経営者・人事担当者が理解できるように、実務的かつ簡潔にまとめること。
`;

    const userContext = `
【最初の利用者入力】
${originalQuestion}

【通常の求人票分析結果】
${basicAnalysis}

【採用力5領域診断：追加質問への回答】
${kadAnswersJson}

上記を踏まえて、採用力5領域診断レポートを作成してください。
`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: kadReportPrompt },
          ...fixedKnowledgeParts,
          ...uploadParts,
          { text: userContext }
        ]
      }],
      tools: [{ googleSearch: {} }]
    });

    const response = await result.response;
    const aiAnswer = response.text();

    console.log("KAD Five Area Diagnosis Success!");

    return {
      answer: aiAnswer,
      success: true
    };

  } catch (error) {
    console.error("KAD Diagnosis Error:", error);
    return {
      answer: `採用力5領域診断でAIエラーが発生しました。\n詳細: ${error.message}`,
      success: false
    };
  }
}