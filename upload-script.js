// upload-script.js
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// .env または .env.local を読み込む
dotenv.config({ path: '.env.local' }); 
dotenv.config(); // .env も念のため

const apiKey = process.env.GOOGLE_API_KEY; 
if (!apiKey) {
    console.error("❌ エラー: GOOGLE_API_KEY が見つかりません。.envファイルを確認してください。");
    process.exit(1);
}

const fileManager = new GoogleAIFileManager(apiKey);
const storageDir = path.join(__dirname, "pdf_storage");

async function uploadAll() {
  console.log("🚀 pdf_storage フォルダ内のPDFをアップロードします...");

  // フォルダがあるか確認
  if (!fs.existsSync(storageDir)) {
      console.error(`❌ エラー: ${storageDir} が見つかりません。フォルダ名を確認してください。`);
      return;
  }

  // PDFファイルだけを抽出
  const files = fs.readdirSync(storageDir).filter(file => file.toLowerCase().endsWith(".pdf"));

  if (files.length === 0) {
      console.log("⚠️ PDFファイルが見つかりませんでした。");
      return;
  }

  console.log(`📄 対象ファイル数: ${files.length}件\n`);
  console.log("▼▼▼ 下記の出力結果をコードにコピペしてください ▼▼▼\n");

  for (const file of files) {
    const filePath = path.join(storageDir, file);
    try {
      const uploadResponse = await fileManager.uploadFile(filePath, {
        mimeType: "application/pdf",
        displayName: file,
      });

      // コピペしやすい形式で出力
      console.log(`{ uri: "${uploadResponse.file.uri}", mimeType: "application/pdf" }, // ${file}`);
      
    } catch (error) {
      console.error(`❌ アップロード失敗 (${file}):`, error.message);
    }
  }
  console.log("\n▲▲▲ コピー範囲終了 ▲▲▲");
}

uploadAll();