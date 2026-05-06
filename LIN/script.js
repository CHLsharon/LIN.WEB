  document.addEventListener('DOMContentLoaded', () => {
    // 1. 抓取 HTML 中的登入按鈕
    const loginBtn = document.querySelector('.login-btn');
    
    // 2. 從 localStorage 取得資料
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');

    // 3. 判斷是否已登入
    if (userId) {
      // 顯示使用者名稱（如果註冊/登入時有存 username），否則顯示「個人帳號」
      loginBtn.textContent = username ? `👤 ${username}` : '👤 個人帳號';
      
      // 修改按鈕行為：點擊後去個人檔案頁面或是顯示登出選單
      // 這裡暫時設定為點擊後詢問是否登出
      loginBtn.onclick = (e) => {
        e.preventDefault();
        if (confirm('您已登入，是否要登出？')) {
          localStorage.clear(); // 清除所有登入資訊
          location.reload();    // 重新整理頁面
        }
      };
      
      // 如果你有寫「個人頁面」，也可以改為跳轉：
      // loginBtn.setAttribute('href', 'profile.html');
    } else {
      // 若未登入，確保它是去登入頁面
      loginBtn.onclick = () => {
        window.location.href = 'login.html';
      };
    }
  });
