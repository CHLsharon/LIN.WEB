// 前端 index.js 正確內容
const API_URL = "https://lin-web.onrender.com"; // 你的 Render 網址

// 範例：處理 TTS (語音合成) 的前端請求
async function speakText(text, voice = "female", rate = 1) {
  try {
    const response = await fetch(`${API_URL}/api/chat/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, voice, rate })
    });

    const data = await response.json();

    if (data.audioContent) {
      // 播放從後端傳回來的聲音資料
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audio.play();
    } else {
      console.error("播放失敗:", data.error);
    }
  } catch (err) {
    console.error("無法連上伺服器:", err);
  }
}

// 這裡放你原本 index.js 其他處理網頁按鈕、對話框的邏輯...
console.log("前端 index.js 已啟動，連線至：" + API_URL);