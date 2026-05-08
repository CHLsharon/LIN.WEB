const mongoose = require('mongoose');

// 連接 MongoDB (建議使用環境變數)
const uri = process.env.MONGODB_URI; 

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(uri);
    }

    const { email, password } = req.body;
    // 這裡寫你的 MongoDB 查詢邏輯，例如：
    // const user = await User.findOne({ email, password });
    
    // 暫時回傳成功範例
    return res.status(200).json({ success: true, username: "來自雲端的使用者" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}