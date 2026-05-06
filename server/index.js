const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db;
let articlesCollection;

// 1. 資料庫連線
async function connectDB() {
  await client.connect();
  db = client.db(process.env.DB_NAME); // 使用 .env 裡的 reading_platform
  articlesCollection = db.collection("articles");
  console.log("✅ MongoDB connected to:", process.env.DB_NAME);
}

// --- 文章相關 API ---
app.get("/api/articles", async (req, res) => {
  try {
    const articles = await articlesCollection.find().toArray();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/articles/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 筆記與活動軌跡 API ---

// 取得筆記
app.get("/api/notes/:userId/:articleId", async (req, res) => {
  try {
    const { userId, articleId } = req.params;
    const note = await db.collection("notes").findOne({ userId, articleId });
    res.json(note || { content: "" });
  } catch (err) {
    res.status(500).json({ error: "讀取筆記失敗" });
  }
});
// --- 使用者相關 API ---

// 1. 註冊 API (將使用者資料上傳到 MongoDB)
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 檢查 email 是否已存在
    const existingUser = await db.collection("user").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "此 Email 已被註冊" });
    }

    // 插入新使用者資料
    const result = await db.collection("user").insertOne({
      username,
      email,
      password, // 實務建議使用 bcrypt 加密，開發測試可先用明碼
      createdAt: new Date()
    });

    res.json({ success: true, message: "註冊成功！", userId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "註冊失敗：" + err.message });
  }
});

// 2. 登入 API (驗證並回傳 userId)
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 在 user 集合中尋找匹配的帳密
    const user = await db.collection("user").findOne({ email, password });

    if (user) {
      res.json({ 
        success: true, 
        userId: user._id, 
        username: user.username 
      });
    } else {
      res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
    }
  } catch (err) {
    res.status(500).json({ error: "登入失敗" });
  }
});

app.post("/api/register", async (req, res) => {
  console.log("--- 收到新的請求 ---"); // 監視器 A
  console.log("收到的資料為:", req.body); // 監視器 B

  try {
    const { username, email, password } = req.body;
    const db = client.db(process.env.DB_NAME);
    const result = await db.collection("user").insertOne({
      username, email, password, createdAt: new Date()
    });
    res.json({ success: true, userId: result.insertedId });
  } catch (err) {
    console.log("後端報錯：", err.message);
    res.status(500).json({ success: false });
  }
});

// 儲存筆記並記錄軌跡
app.post("/api/notes/save", async (req, res) => {
  try {
    const { userId, articleId, content, actionType } = req.body;

    // 1. 更新筆記內容 (一般集合)
    await db.collection("notes").updateOne(
      { userId, articleId },
      { 
        $set: { 
          content, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );

    // 2. 記錄活動軌跡
    await db.collection("activity").insertOne({
      userId,
      articleId,
      action: actionType || "SAVE_NOTE",
      timestamp: new Date() // 這裡對應當初建立 activity 時設定的 timeField
    });

    res.json({ success: true, message: "筆記與軌跡已存檔" });
  } catch (err) {
    console.error("儲存失敗:", err);
    res.status(500).json({ error: "儲存失敗" });
  }
});

// --- AI 解釋與聊天功能 (串接 Gemini 並存檔) ---

// 注意：確保頂部引用是 const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/api/explain", async (req, res) => {
  // 💡 從前端接收 userId 和 articleId 以便存檔
  const { selectedText, articleTitle, userId, articleId, mode } = req.body;
  
  // 根據模式調整指令 (mode 可由前端傳入 "summary" 或 "chat")
  let prompt = "";
  if (mode === "summary") {
    prompt = `你是一位閱讀助手。請為文章《${articleTitle}》做摘要。內容如下：\n${selectedText}`;
  } else {
    prompt = `你是一位專業的閱讀助手。正在討論文章《${articleTitle}》。\n使用者問：${selectedText}\n請用繁體中文回答，並保持白話易懂。`;
  }

  // 嘗試使用的模型清單
  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // 💡 關鍵：AI 回應後，自動存入後台 activity 集合
      if (db && userId) {
        await db.collection("activity").insertOne({
          userId: userId,
          articleId: articleId,
          action: mode === "summary" ? "AI_SUMMARY" : "AI_CHAT",
          userQuestion: selectedText,
          aiResponse: text,
          timestamp: new Date() // 確保符合你的時序資料庫設定
        });
      }

      return res.json({ explanation: text, model: modelName });
    } catch (err) {
      console.log(`模型 ${modelName} 失敗: ${err.message}`);
      // 如果不是 503 等暫時性錯誤，就跳出
      if (!err.message.includes("503") && !err.message.includes("429")) {
        continue;
      }
    }
  }
  res.status(503).json({ error: "AI 服務目前無法連線，請稍後再試" });
});

// --- 啟動伺服器 ---

connectDB()
  .then(() => {
    app.listen(3000, () => {
      console.log("🚀 Server running on http://localhost:3000");
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connect failed:", err.message);
  });