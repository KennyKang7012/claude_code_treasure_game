import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AuthPage() {
  const { login, register, playAsGuest } = useAuth();

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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center p-8">
      {/* 標題 */}
      <div className="text-center mb-8">
        <h1 className="text-4xl mb-2 text-amber-900">🏴‍☠️ Treasure Hunt Game 🏴‍☠️</h1>
        <p className="text-amber-700 text-sm">登入以儲存分數，或以訪客身分直接開始遊戲</p>
      </div>

      {/* 登入 / 註冊卡片 */}
      <Card className="w-full max-w-md border-amber-300 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-amber-900 text-xl">歡迎</CardTitle>
          <CardDescription className="text-amber-700">
            登入或建立帳號來記錄你的冒險歷程
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-amber-100">
              <TabsTrigger value="login" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                登入
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                註冊
              </TabsTrigger>
            </TabsList>

            {/* 登入分頁 */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="login-username" className="text-amber-800">使用者名稱</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="輸入使用者名稱"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    className="border-amber-300 focus:border-amber-500"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="login-password" className="text-amber-800">密碼</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="輸入密碼"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="border-amber-300 focus:border-amber-500"
                    autoComplete="current-password"
                    required
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    ⚠️ {loginError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {loginLoading ? '登入中…' : '🔑 登入'}
                </Button>
              </form>
            </TabsContent>

            {/* 註冊分頁 */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="reg-username" className="text-amber-800">使用者名稱</Label>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder="3–20 個英數字元"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    className="border-amber-300 focus:border-amber-500"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-password" className="text-amber-800">密碼</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="至少 6 個字元"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className="border-amber-300 focus:border-amber-500"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {regError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    ⚠️ {regError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={regLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {regLoading ? '建立中…' : '🗺️ 建立帳號'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 訪客模式連結 */}
      <button
        onClick={playAsGuest}
        className="mt-6 text-amber-700 hover:text-amber-900 text-sm underline underline-offset-4 transition-colors"
      >
        以訪客身分繼續（不儲存分數）→
      </button>
    </div>
  );
}
