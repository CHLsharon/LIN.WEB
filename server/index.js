const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google-generative-ai");

const app = express();

// --- 中間件設定 ---
app.use(cors()); // 允許跨域請求
app.use(express.json()); // 解析 JSON 格式

const client = new MongoClient(process.env.MONGODB_URI);
let db;
let articlesCollection;

// 1. 資料庫連線
async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    articlesCollection = db.collection("articles");
    console.log("✅ MongoDB connected to:", process.env.DB_NAME);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
}

// --- 文章相關 API ---
app.get("/api/chat/articles", async (req, res) => {
  try {
    const articles = await articlesCollection.find().toArray();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chat/articles/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 使用者登入/註冊 API (對應前端的 /api/chat/...) ---
app.post("/api/chat/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await db.collection("user").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "此 Email 已被註冊" });
    }
    const result = await db.collection("user").insertOne({
      username, email, password, createdAt: new Date()
    });
    res.json({ success: true, message: "註冊成功！", userId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "註冊失敗：" + err.message });
  }
});

app.post("/api/chat/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection("user").findOne({ email, password });
    if (user) {
      res.json({ success: true, userId: user._id, username: user.username });
    } else {
      res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
    }
  } catch (err) {
    res.status(500).json({ error: "登入失敗" });
  }
});

// --- AI 解釋功能 ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.post("/api/chat/explain", async (req, res) => {
  const { selectedText, articleTitle, userId, articleId, mode } = req.body;
  let prompt = mode === "summary" 
    ? `為《${articleTitle}》做摘要：\n${selectedText}`
    : `討論文章《${articleTitle}》。使用者問：${selectedText}\n請用繁體中文回答。`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // 存入軌跡
    if (db && userId) {
      await db.collection("activity").insertOne({
        userId, articleId, action: mode === "summary" ? "AI_SUMMARY" : "AI_CHAT",
        userQuestion: selectedText, aiResponse: text, timestamp: new Date()
      });
    }
    res.json({ explanation: text });
  } catch (err) {
    res.status(503).json({ error: "AI 服務暫時不可用" });
  }
});
// --- 語音合成 API (放在 server/index.js) ---
const textToSpeech = require("@google-cloud/text-to-speech");
const ttsClient = new textToSpeech.TextToSpeechClient();

app.post("/api/chat/tts", async (req, res) => {
  try {
    const { text, voice = "female", rate = 1 } = req.body;
    const voiceName = voice === "male" ? "cmn-TW-Wavenet-B" : "cmn-TW-Wavenet-A";

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "cmn-TW", name: voiceName },
      audioConfig: { audioEncoding: "MP3", speakingRate: Number(rate) }
    });

    res.json({ audioContent: response.audioContent.toString("base64") });
  } catch (err) {
    console.error("TTS 錯誤:", err);
    res.status(500).json({ error: "語音產生失敗" });
  }
});

// 根目錄測試
app.get("/", (req, res) => res.send("伺服器運行中！🚀"));

// --- 啟動伺服器 ---
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});