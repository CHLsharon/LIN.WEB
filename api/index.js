const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
// 注意：官方套件名稱通常是 @google/generative-ai
const { GoogleGenerativeAI } = require("@google/generative-ai");

const textToSpeech = require("@google-cloud/text-to-speech");

const app = express();

app.use(cors());
app.use(express.json());

// --- MongoDB 設定 ---
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
  console.error("❌ MONGODB_URI is missing");
}

if (!dbName) {
  console.error("❌ DB_NAME is missing");
}

let client;
let db;
let articlesCollection;
let clientPromise;

// Vercel Serverless 環境下，避免每個 request 重複建立連線
async function connectDB() {
  if (db && articlesCollection) {
    return { db, articlesCollection };
  }

  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  if (!dbName) {
    throw new Error("DB_NAME is missing");
  }

  if (!clientPromise) {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    clientPromise = client.connect();
  }

  await clientPromise;

  db = client.db(dbName);
  articlesCollection = db.collection("articles");

  console.log("✅ MongoDB connected to:", dbName);

  return { db, articlesCollection };
}

// --- 測試 API ---
app.get("/api/db-test", async (req, res) => {
  try {
    const { db } = await connectDB();

    res.json({
      ok: true,
      message: "MongoDB connected successfully",
      dbName: db.databaseName,
    });
  } catch (err) {
    console.error("❌ DB test failed:", err);

    res.status(500).json({
      ok: false,
      name: err.name,
      message: err.message,
    });
  }
});

// --- 文章相關 API ---
app.get("/api/chat/articles", async (req, res) => {
  try {
    const { articlesCollection } = await connectDB();

    const articles = await articlesCollection.find().toArray();
    res.json(articles);
  } catch (err) {
    console.error("❌ Get articles failed:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get("/api/chat/articles/:id", async (req, res) => {
  try {
    const { articlesCollection } = await connectDB();

    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "無效的文章 ID",
      });
    }

    const article = await articlesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "找不到文章",
      });
    }

    res.json(article);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// --- 使用者註冊 API ---
app.post("/api/chat/register", async (req, res) => {
  try {
    const { db } = await connectDB();

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "請填寫 username、email、password",
      });
    }

    const existingUser = await db.collection("user").findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "此 Email 已被註冊",
      });
    }

    const result = await db.collection("user").insertOne({
      username,
      email,
      password,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: "註冊成功！",
      userId: result.insertedId,
    });
  } catch (err) {
    console.error("❌ Register failed:", err);

    res.status(500).json({
      success: false,
      error: "註冊失敗：" + err.message,
    });
  }
});

// --- 使用者登入 API ---
app.post("/api/chat/login", async (req, res) => {
  try {
    const { db } = await connectDB();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "請輸入 email 和 password",
      });
    }

    const user = await db.collection("user").findOne({
      email,
      password,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "帳號或密碼錯誤",
      });
    }

    res.json({
      success: true,
      userId: user._id,
      username: user.username,
    });
  } catch (err) {
    console.error("❌ Login failed:", err);

    res.status(500).json({
      success: false,
      error: "登入失敗：" + err.message,
    });
  }
});

// --- AI 解釋功能 ---
app.post("/api/chat/explain", async (req, res) => {
  try {
    const { db } = await connectDB();

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is missing",
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { selectedText, articleTitle, userId, articleId, mode } = req.body;

    if (!selectedText) {
      return res.status(400).json({
        success: false,
        message: "selectedText is required",
      });
    }

    const prompt =
      mode === "summary"
        ? `為《${articleTitle}》做摘要：\n${selectedText}`
        : `討論文章《${articleTitle}》。使用者問：${selectedText}\n請用繁體中文回答。`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (userId) {
      await db.collection("activity").insertOne({
        userId,
        articleId,
        action: mode === "summary" ? "AI_SUMMARY" : "AI_CHAT",
        userQuestion: selectedText,
        aiResponse: text,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      explanation: text,
    });
  } catch (err) {
    console.error("❌ AI explain failed:", err);

    res.status(503).json({
      success: false,
      error: "AI 服務暫時不可用：" + err.message,
    });
  }
});

// --- 語音合成 API ---
app.post("/api/chat/tts", async (req, res) => {
  try {
    const { text, voice = "female", rate = 1 } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "text is required",
      });
    }

    const ttsClient = new textToSpeech.TextToSpeechClient();

    const voiceName =
      voice === "male" ? "cmn-TW-Wavenet-B" : "cmn-TW-Wavenet-A";

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "cmn-TW",
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number(rate),
      },
    });

    res.json({
      success: true,
      audioContent: response.audioContent.toString("base64"),
    });
  } catch (err) {
    console.error("❌ TTS failed:", err);

    res.status(500).json({
      success: false,
      error: "語音產生失敗：" + err.message,
    });
  }
});

// --- Vercel 必須匯出 app ---
module.exports = app;