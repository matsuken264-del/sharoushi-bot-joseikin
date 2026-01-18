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
  { uri: "https://generativelanguage.googleapis.com/v1beta/files/1m09svghmvtm", mimeType: "application/pdf" }, // 001239584.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/wnrcnqxnmcaf", mimeType: "application/pdf" }, // 001239649.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/uu3623zaz3zu", mimeType: "application/pdf" }, // 001239651.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/zmsjl97zvkl3", mimeType: "application/pdf" }, // 001239656.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/yxvrig2cikzq", mimeType: "application/pdf" }, // 001239657.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/rdgeg6w4whfv", mimeType: "application/pdf" }, // 001239662.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/8ytibnebpqlv", mimeType: "application/pdf" }, // 001239682.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/gyl5iimjf3od", mimeType: "application/pdf" }, // 001239688.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/fgkuaxel0c94", mimeType: "application/pdf" }, // 001239689.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/dip8fd05ih0j", mimeType: "application/pdf" }, // 001239692.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/yhff5jhh7w7n", mimeType: "application/pdf" }, // 001239697.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/vtn9z0lbmylr", mimeType: "application/pdf" }, // 001239699.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/8azr2244c4ez", mimeType: "application/pdf" }, // 001239700.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/wgoqlf0qgrg8", mimeType: "application/pdf" }, // 001239702.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/46qjfxj34lpz", mimeType: "application/pdf" }, // 001239703.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/yq9n0pt31qci", mimeType: "application/pdf" }, // 001239712.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/qnjyy82unyft", mimeType: "application/pdf" }, // 001239713.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/vos2733o34yt", mimeType: "application/pdf" }, // 001245612.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/znhxt0bs0pwk", mimeType: "application/pdf" }, // 001245613.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/q7obwciwtgdm", mimeType: "application/pdf" }, // 001245614.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/i2argjhc1bkp", mimeType: "application/pdf" }, // 001245615.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/7s9zwsvg5f3z", mimeType: "application/pdf" }, // 001470637.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/0v0glb3g8hrv", mimeType: "application/pdf" }, // 001470638.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/e32ax7n2bzjw", mimeType: "application/pdf" }, // 001470639.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/sibvok2wpxxn", mimeType: "application/pdf" }, // 001470642.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/qcxkp321wy8i", mimeType: "application/pdf" }, // 001470647.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/5jytleim99aq", mimeType: "application/pdf" }, // 001472336.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/m2wmp0uz891c", mimeType: "application/pdf" }, // 001472337.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/8egch122mtm1", mimeType: "application/pdf" }, // 001472338.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/ryz3mos9fvcz", mimeType: "application/pdf" }, // 001472339.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/x1qeyg89kx1d", mimeType: "application/pdf" }, // 001474523.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/3mvwsdcrpl1q", mimeType: "application/pdf" }, // 001474534.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/i80x2np9fi3h", mimeType: "application/pdf" }, // 001474535.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/3yx44fnmqzsp", mimeType: "application/pdf" }, // 001474536.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/297mrlg1e4tg", mimeType: "application/pdf" }, // 001573592.pdf
　{ uri: "https://generativelanguage.googleapis.com/v1beta/files/0y65qlto0h5a", mimeType: "application/pdf" }, // 001573595.pdf
  // ↑↑↑ ここに貼り付け ↑↑↑
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
    const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

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
あなたは、社会保険・労働保険のプロとしての高度な専門知識を持つAIアシスタントです。

あなたには、以下の2種類の情報源が与えられています。
1. **[固定知識ベース]:** 業務取扱要領や法令などの膨大な専門資料（PDFファイル群）
2. **[追加資料]:** ユーザーが今、その場でアップロードした最新の資料（以下のテキストエリア）

ユーザーからの質問に対して、以下の優先順位とルールに従って回答してください。

【優先順位とルール】
1.  **情報源の特定:** 質問が「この資料」「アップロードした資料」などと特定の資料を指している場合は、[追加資料]の内容を最優先で確認してください。
2.  **情報源の統合:** 特定の指示がない場合は、[固定知識ベース]と[追加資料]の両方を組み合わせて回答してください。
3.  **情報の新旧:** 内容が矛盾する場合は、より新しい情報である可能性が高い[追加資料]の内容を優先してください。
4.  **根拠の明示:** 回答する際は、必ず「提供された資料（〇〇など）によると…」のように根拠を明示してください。特に[追加資料]に基づいている場合は、「アップロードされた追加資料によると…」と明記してください。
5.  **プロとしての態度:** 正確で断定的な表現を心がけてください。
6.  **Web検索による補完:** 提供された資料に記載がない事項については、Google検索機能を使用して最新の情報を収集し、それを基に回答してください。
7.  **限界の認識:** 明確な回答が困難な場合は、窓口等へ問い合わせるよう誘導すること。

あなたの使命は、これらの資料を駆使し、最も正確な回答を導き出すことです。

---
★★★【重要：今回ユーザーがアップロードした追加資料】★★★
${temporaryContext ? temporaryContext : "(なし)"}
---

【質問】
${question}

【AIへの補足指示】
もし上記【質問】が、アップロードされた資料に関する内容であれば、[固定知識ベース]の内容は一旦脇に置き、[追加資料]の内容のみに基づいて回答を作成してください。
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