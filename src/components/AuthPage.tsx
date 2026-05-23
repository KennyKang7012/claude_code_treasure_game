import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type TabType = 'login' | 'register';

export default function AuthPage() {
  const { login, register, playAsGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('login');

  // 登入表單狀態
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 註冊表單狀態
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginUsername, loginPassword);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '登入失敗，請稍後再試');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);
    try {
      await register(regUsername, regPassword);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : '註冊失敗，請稍後再試');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center p-6">
      {/* 標題 */}
      <div className="text-center mb-8">
        <h1 className="text-4xl mb-2 text-amber-900">🏴‍☠️ Treasure Hunt Game 🏴‍☠️</h1>
        <p className="text-amber-700 text-sm">登入以儲存分數，或以訪客身分直接開始遊戲</p>
      </div>

      {/* 登入 / 註冊卡片（固定寬度 420px） */}
      <Card
        className="border-amber-300 shadow-xl bg-white/85 backdrop-blur-sm"
        style={{ width: '420px', maxWidth: 'calc(100vw - 48px)' }}
      >
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-amber-900 text-xl">歡迎</CardTitle>
          <CardDescription className="text-amber-700">
            登入或建立帳號來記錄你的冒險歷程
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* 自訂 Tab 切換按鈕 */}
          <div className="flex rounded-lg overflow-hidden border-2 border-amber-200 mb-6">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setLoginError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'login'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-700 hover:bg-amber-50'
              }`}
            >
              🔑 登入
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setRegError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === 'register'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-700 hover:bg-amber-50'
              }`}
            >
              🗺️ 註冊
            </button>
          </div>

          {/* 登入表單 */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-username" className="text-amber-800 font-medium">
                  使用者名稱
                </Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder="輸入使用者名稱"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  className="border-amber-300 focus-visible:ring-amber-400"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-amber-800 font-medium">
                  密碼
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="輸入密碼"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="border-amber-300 focus-visible:ring-amber-400"
                  autoComplete="current-password"
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {loginError}
                </p>
              )}
              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold mt-2"
              >
                {loginLoading ? '登入中…' : '🔑 登入'}
              </Button>
            </form>
          )}

          {/* 註冊表單 */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-amber-800 font-medium">
                  使用者名稱
                </Label>
                <Input
                  id="reg-username"
                  type="text"
                  placeholder="3–20 個英數字元"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  className="border-amber-300 focus-visible:ring-amber-400"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-amber-800 font-medium">
                  密碼
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="至少 6 個字元"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  className="border-amber-300 focus-visible:ring-amber-400"
                  autoComplete="new-password"
                  required
                />
              </div>
              {regError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠️ {regError}
                </p>
              )}
              <Button
                type="submit"
                disabled={regLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold mt-2"
              >
                {regLoading ? '建立中…' : '🗺️ 建立帳號'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 訪客模式連結 */}
      <button
        type="button"
        onClick={playAsGuest}
        className="mt-5 text-amber-700 hover:text-amber-900 text-sm underline underline-offset-4 transition-colors cursor-pointer"
      >
        以訪客身分繼續（不儲存分數）→
      </button>
    </div>
  );
}
