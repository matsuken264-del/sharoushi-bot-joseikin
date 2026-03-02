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
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/m3up3ac0ii69", mimeType: "application/pdf" }, // 001491253.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/f5oul2v1kzwz", mimeType: "application/pdf" }, // 25-1-1-2.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/svpnze6l2ss3", mimeType: "application/pdf" }, // 25-1-1-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/rhbf0r4y5fba", mimeType: "application/pdf" }, // 25-1-2-2_02.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/tlinezjj08zd", mimeType: "application/pdf" }, // 25-1-2-2_03.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/gap07ip2k9dj", mimeType: "application/pdf" }, // 25-1-2-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/z7dqxx7qmjr9", mimeType: "application/pdf" }, // 25-1a.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/bt5w7fok66a6", mimeType: "application/pdf" }, // 人材が定着しない職場の特 徴（Grokの分析）.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/k6ajexobsqwt", mimeType: "application/pdf" }, // 令和６年概況.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/5uryyl9q8snx", mimeType: "application/pdf" }, // 信頼基盤型リテンション・ エンジン.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/gwgsj05bmmil", mimeType: "application/pdf" }, // 求人票記載マニュアル（TCRE専用）.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/pq88agwjxs0c", mimeType: "application/pdf" }, // 求人票記載方法.pdf       
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/hf5v1njyy0f7", mimeType: "application/pdf" }, // 速報.pdf
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
あなたは「人材確保AIコンサルタント」です。
企業の経営者・人事担当者へアドバイスすることがメインの役割です。

【ミッション】
1．アップロードされた求人票（画像またはPDF）を分析し、最新のRAG資料（令和7年速報など）と照合して、賃金相場の乖離や離職理由分析を踏まえた応募阻害要因を特定し、改善案を提示すること。
2．人事面談記録等がアップロードされた場合、定着不全の兆候である「信頼のヒビ」を特定し、建設的な改善アクションを提示すること。

【分析の基準】
・最新の令和7年速報（賃金3.1%増）等の統計データを最優先の相場基準とする。
・求職者視点で「信頼のヒビ（曖昧さや不安要素）」を抽出する。

【回答フォーマット】
■総合所見（サマリー）
■観測された「信頼のヒビ」兆候（推測）
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