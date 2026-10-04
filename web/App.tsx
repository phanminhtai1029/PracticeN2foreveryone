import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { api, UNAUTHORIZED_EVENT, type User } from './api';
import { AuthContext } from './auth';
import { LoginPage } from './pages/LoginPage';
import { ExamListPage } from './pages/ExamListPage';
import { ExamSetupPage } from './pages/ExamSetupPage';
import { TakeExamPage } from './pages/TakeExamPage';
import { ResultPage } from './pages/ResultPage';
import { Spinner } from './components/ui';

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(
      (r) => setUser(r.user),
      () => setUser(null),
    );
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const logout = useCallback(() => {
    api.logout().finally(() => setUser(null));
  }, []);

  if (user === undefined) return <Spinner full />;
  if (user === null) return <LoginPage onLogin={setUser} />;

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <Routes>
        <Route path="/" element={<ExamListPage />} />
        <Route path="/exam/:examId" element={<ExamSetupPage />} />
        <Route path="/exam/:examId/take" element={<TakeExamPage />} />
        <Route path="/result/:attemptId" element={<ResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
