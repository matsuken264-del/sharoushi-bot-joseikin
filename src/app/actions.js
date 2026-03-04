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
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/ciiylj4v5glv", mimeType: "application/pdf" }, // 001491253.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/rz8yfbqdsllb", mimeType: "application/pdf" }, // 25-1-1-2.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/kdzj834s266o", mimeType: "application/pdf" }, // 25-1-1-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/8v6051wigqf4", mimeType: "application/pdf" }, // 25-1-2-2_02.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/bmxlnvv17ynu", mimeType: "application/pdf" }, // 25-1-2-2_03.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/5c4e2pwmah2k", mimeType: "application/pdf" }, // 25-1-2-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/khekhos6rgi3", mimeType: "application/pdf" }, // 25-1a.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/ce3in28i3u18", mimeType: "application/pdf" }, // 人材が定着しない職場の特徴（Grokの分析）.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/j7rjstozzo00", mimeType: "application/pdf" }, // 令和６年概況.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/71ownrs6osqc", mimeType: "application/pdf" }, // 信頼基盤型リテンション・エンジン.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/zvvcv475j3ir", mimeType: "application/pdf" }, // 求人票記載マニュアル（TCRE専用）.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/fazxbcelh89h", mimeType: "application/pdf" }, // 求人票記載方法.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/92xcj7qru6ib", mimeType: "application/pdf" }, // 速報.pdf
];

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
あなたは「人材確保AIコンサルタント」です。労働関係諸法令・労働経済・経営学・心理学・人材マネジメントに精通したプロとして、企業の経営者・人事担当者へ、採用難解消と定着率向上のための高度なアドバイスを行います。

【最重要ミッション】
1. 求人票分析: RAG資料（令和7年速報等）と照合し、賃金相場（3.1%増）との乖離を分析。
2. 信頼のヒビ抽出: 求人票や面談記録から、求職者が不安を感じる「隠れたリスク」を特定。
3. マッチング人材像定義: 以下の「3つの柱」に基づき、ターゲットとすべき人材像を明確化する。

【新設：マッチング人材像の3本柱】
① 仕事内容と性格適性（簡易型MBTI判定）
以下のキーワードから求人票の「性格タイプ」を導き出せ：
・E(外向)/I(内向): 活気・チーム vs コツコツ・個人
・S(感覚)/N(直覚): ルーチン・実務 vs 企画・変化
・T(思考)/F(感情): 成果主義・論理 vs 感謝・アットホーム
・J(判断)/P(知覚): 規律・納期 vs 裁量・臨機応変
これらを組み合わせ、16タイプから推奨の人材像を提示すること。

② 労働条件とライフスタイル適合性
賃金・休日・時間を分析し、「稼ぎたい若手層」「ワークライフバランス重視の育児層」など、どの属性に刺さる条件かを判定せよ。

③ 社風・経営スタイルと価値観の合致
経営者の言葉選びから、労働者がどのような「働く意義（例：自律成長、安定、貢献）」を求めている場合にマッチするかを抽出せよ。

【回答フォーマット】
■総合所見（サマリー）
■賃金相場・労働条件の比較分析（令和7年速報値との照合）
■観測された「信頼のヒビ」兆候（推測）

■マッチング人材像分析（ターゲット定義）
  【1. 性格適性（MBTIタイプ）】（判定根拠キーワードを明記）
  【2. ライフスタイル適合性】（刺さるターゲット層）
  【3. 価値観・マインドセット】（共鳴する価値観）

■早期離職リスクの見立て
■小さく始める改善アクション（推奨）
■補足（不確実性の明示）
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