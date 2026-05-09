const mongoose = require('mongoose');

// 在函式外定義一個快取變數
let cachedDb = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const uri = process.env.MONGODB_URI;

  // 檢查是否有 URI
  if (!uri) {
    return res.status(500).json({ success: false, error: "未設定資料庫連線字串 (MONGODB_URI)" });
  }

  try {
    // 優化連線邏輯：如果已有連線就復用
    if (!cachedDb) {
      cachedDb = await mongoose.connect(uri);
      console.log("新建立資料庫連線");
    }

    const { email, password } = req.body;
    
    // 這裡建議加上簡單的驗證邏輯測試
    if (email === "test@example.com" && password === "123456") {
        return res.status(200).json({ 
            success: true, 
            userId: "user_01",
            username: "測試管理員" 
        });
    }

    // 預設回應
    return res.status(200).json({ success: true, username: "來自雲端的使用者" });

  } catch (error) {
    console.error("後端錯誤:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}