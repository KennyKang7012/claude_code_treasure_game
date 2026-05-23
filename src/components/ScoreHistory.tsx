import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface ScoreRecord {
  id: number;
  score: number;
  outcome: 'win' | 'tie' | 'loss';
  boxes_opened: number;
  created_at: string;
}

const OUTCOME_LABEL: Record<string, string> = {
  win: '🏆 勝利',
  tie: '🤝 平局',
  loss: '💀 失敗',
};

interface Props {
  token: string;
}

export default function ScoreHistory({ token }: Props) {
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<ScoreRecord[]>('/api/scores/me', { token })
      .then(data => setRecords(data))
      .catch(() => setError('無法載入歷史分數'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <p className="text-amber-600 text-sm mt-4 animate-pulse">載入歷史分數中…</p>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm mt-4">{error}</p>;
  }

  if (records.length === 0) {
    return <p className="text-amber-600 text-sm mt-4">尚無歷史紀錄</p>;
  }

  const bestScore = Math.max(...records.map(r => r.score));

  return (
    <div className="mt-6 w-full max-w-lg">
      <h3 className="text-amber-900 font-semibold mb-2 text-center">
        📜 歷史分數紀錄
      </h3>
      <p className="text-center text-sm text-amber-700 mb-3">
        個人最高分：
        <span className={`font-bold ml-1 ${bestScore >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ${bestScore}
        </span>
      </p>

      <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-amber-200 overflow-hidden shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-100 text-amber-800">
              <th className="text-left px-4 py-2">日期</th>
              <th className="text-center px-4 py-2">分數</th>
              <th className="text-center px-4 py-2">結果</th>
              <th className="text-center px-4 py-2">開箱數</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={r.id}
                className={`border-t border-amber-100 ${i % 2 === 0 ? 'bg-white/50' : 'bg-amber-50/50'}`}
              >
                <td className="px-4 py-2 text-amber-700">
                  {new Date(r.created_at + 'Z').toLocaleString('zh-TW', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className={`px-4 py-2 text-center font-semibold ${r.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${r.score}
                </td>
                <td className="px-4 py-2 text-center">
                  {OUTCOME_LABEL[r.outcome] ?? r.outcome}
                </td>
                <td className="px-4 py-2 text-center text-amber-700">
                  {r.boxes_opened} / 3
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
