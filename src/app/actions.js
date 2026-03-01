'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
// PDFをテキスト化するためのライブラリ
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  throw new Error("GOOGLE_API_KEY が .env.local に設定されていません。");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// ★ここに、upload_files.js で作成した最新のURIリストを貼り付けてください！★
const knowledgeBaseFiles = [
  // 例: { uri: "...", mimeType: "..." },
  // ↓↓↓ ここに貼り付け ↓↓↓
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/p5r6rfw7545z", mimeType: "application/pdf" }, // 001491253.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/2xn3o46qkr20", mimeType: "application/pdf" }, // 25-1-1-2.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/ccvxrfnpiav5", mimeType: "application/pdf" }, // 25-1-1-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/sv06ig0vga5z", mimeType: "application/pdf" }, // 25-1-2-2_02.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/ufqp6ua06ik3", mimeType: "application/pdf" }, // 25-1-2-2_03.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/pj0qvoahx6uu", mimeType: "application/pdf" }, // 25-1-2-3.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/9re80nk5kzsv", mimeType: "application/pdf" }, // 25-1a.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/i4p259g1murg", mimeType: "application/pdf" }, // 令和６年概況.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/2c8bbs1epbp3", mimeType: "application/pdf" }, // 求人票記載方法.pdf
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/zie31f17xukw", mimeType: "application/pdf" }, // 速報.pdf


]; 
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// ↑ この「];」が消えていたのがエラーの原因の可能性が高いです

 
/**
 * 画面からアップロードされたPDFファイルからテキストを抽出する関数
 */
async function extractTextFromPdf(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDocument = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  } catch (error) {
    console.error("PDF Text Extraction Error:", error);
    return `(PDFファイルの読み込みに失敗しました: ${file.name})\n`;
  }
}

// Server Action
export async function generateAnswer(_, formData) {
  console.log("--- Action started (Hybrid Mode: RAG + Upload) ---");

  const question = formData.get('question');
  const uploadedFiles = formData.getAll('files');

  try {
    console.log("Connecting to Gemini API...");
    // 2026年時点の最新モデルを指定
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

    // --- 1. 固定の本棚 (RAG) の準備 ---
    const fixedKnowledgeParts = knowledgeBaseFiles.map(file => ({
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri
      }
    }));
    console.log(`[RAG] ${fixedKnowledgeParts.length} 冊の固定資料を準備しました。`);

    // --- 2. 画面からアップロードされた一時資料の準備 ---
    let temporaryContext = "";
    if (uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0].size > 0) {
        console.log(`[Upload] ${uploadedFiles.length} 件の一時ファイルがアップロードされました。`);
        for (const file of uploadedFiles) {
            if (file.type === 'application/pdf') {
                const text = await extractTextFromPdf(file);
                temporaryContext += `\n【追加資料: ${file.name}】\n${text}\n`;
            } else {
                console.warn(`[Upload] 未対応またはPDF以外のファイル形式です: ${file.name}`);
            }
        }
    }

    // --- 3. プロンプトの作成 ---
    const prompt = `
あなたは「人材確保AIコンサルタント」です。
企業の経営者・人事担当者へアドバイスすることがメインの役割です。
主な場面は1と2の二つ
1．アップロードされた求人票について分析し、応募者数・定着率の向上を目指し、アドバイスする。その際に、RAGの資料を参照・活用すること。RAGの資料と求人票を比較し、賃金相場との乖離状況を分析、離職率・離職理由の情報と求人票を比較し、応募を阻害している事項や求人票の改善点を分析・アドバイスすること。アドバイスする際は、現在の求人票での応募者見込み、改善点、改善した場合の応募者見込みを可能な限り提示する。
2．人事面談記録等をアップロードされた場合。RAGの資料を参照・活用し、下記のプロンプトに基づいてアドバイスすること。

役割：
・企業の採用難、早期離職、定着不全の兆候を早期発見する
・求人票・面談記録・ヒアリング記録・現場ログから「信頼のヒビ（求人票から予測できる将来の予見含め）」を非攻撃的に抽出する
・経営者や管理職が防御反応を起こさない言い回しで示唆を提示する
・断定や犯人探しは行わない
・必ず改善余地という建設的フレーミングで出力する

最重要原則：
1. 責めない
2. 決めつけない
3. 恐怖を煽らない
4. 現場の温度感を尊重する
5. 小さな改善行動に落とす

分析観点：
以下の5軸で「信頼のヒビ兆候」を評価する

【評価軸】
A. 心理的安全性の揺らぎ
B. 評価・承認の不足感
C. 業務負荷と裁量の不均衡
D. 上司部下間の認識ズレ
E. 早期離職リスクシグナル

出力スタイル：
・経営者が読んでも身構えない表現
・現場が読んでも納得感がある表現
・推測であることを明示
・優先度を示す
・具体的な次の一手を提示

禁止事項：
・人格否定
・断定的な組織批判
・「問題」「失敗」など強すぎる言葉の多用
・法的判断の断定

テンプレ
以下は、ある企業の面談記録です。

【目的】
人材確保・定着の観点から、
「信頼のヒビ」の兆候を非攻撃的に分析してください。

【出力要件】
・推測ベースであることを明示
・優先度（高・中・低）
・経営者が身構えない表現
・具体的な改善アクションを提示

【面談記録】
{{RAGで取得したテキスト}}

回答フォーマット
■総合所見（サマリー）

（ここに全体の温度感を柔らかく記述）

---

■観測された「信頼のヒビ」兆候（推測）

① 心理的安全性の揺らぎ  
【優先度】中  
【観測根拠】  
（引用ベース）

【示唆】  
（非断定）

---

② 評価・承認の不足感  
【優先度】高  
【観測根拠】

【示唆】

---

■早期離職リスクの見立て

（高・中・低＋理由）

---

■小さく始める改善アクション（推奨）

・アクション①（低負荷）
・アクション②（管理職向け）
・アクション③（組織施策）

---

■補足（不確実性の明示）

本分析は面談記録ベースの推測であり、
追加ヒアリングにより解像度が上がる可能性があります。    

`;

    // --- 4. AIによる回答生成 ---
    const textPart = { text: prompt };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [textPart, ...fixedKnowledgeParts] }],
      tools: [
        { googleSearch: {} }
      ]
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
    let errorMessage = error.message;
    
    if (error.message.includes("429")) {
        errorMessage = "申し訳ありません。現在アクセスが集中しており、AIが回答できません。(429 Too Many Requests)";
    } else if (error.message.includes("403")) {
        errorMessage = "ファイルのアクセス権限エラーが発生しました。管理者にご連絡ください。(403 Forbidden)";
    } else if (error.message.includes("400") && error.message.includes("file")) {
         errorMessage = "ファイルの処理中にエラーが発生しました。";
    }

    return { 
      answer: `AIエラーが発生しました。\n詳細: ${errorMessage}`,
      success: false
    };
  }
}