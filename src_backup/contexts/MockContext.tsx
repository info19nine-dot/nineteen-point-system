import React, { createContext, useContext, useState, ReactNode } from 'react';

// 型定義
export type UserRole = 'admin' | 'member';

export interface Transaction {
  id: number;
  type: 'EARN' | 'USE';
  amount: number;
  date: string;
  isCancelled?: boolean; // 新規: 取消フラグ
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  memberCode?: string; // 会員のみ
  email: string;
  // 以下新規追加
  points?: number; // 会員ごとのポイント
  transactions?: Transaction[]; // 会員ごとの取引履歴
  blacklist?: boolean; // ブラックリストフラグ
  staffMemo?: string; // スタッフ用メモ
}

export interface Course {
  id: string;
  label: string;
  points: number;
}

interface MockContextType {
  user: User | null;
  points: number;
  transactions: Transaction[];
  courses: Course[];
  login: (role: UserRole) => Promise<void>;
  logout: () => void;
  addPoints: (amount: number) => void;
  usePoints: (amount: number) => boolean; // ポイント不足ならfalse
  addCourse: (course: Omit<Course, 'id'>) => void;
  updateCourse: (id: string, data: Partial<Omit<Course, 'id'>>) => void;
  deleteCourse: (id: string) => void;
  // 会員管理用
  members: User[];
  searchMembers: (query: string) => User[];
  getMember: (id: string) => User | undefined;
  updateMemberMemo: (id: string, memo: string) => void;
  toggleBlacklist: (id: string) => void;
  cancelTransaction: (memberId: string, transactionId: number) => void;
}

const MockContext = createContext<MockContextType | undefined>(undefined);

// 初期モックデータ
const INITIAL_MEMBERS: User[] = [
  { 
    id: '1', name: '山田 太郎', role: 'member', memberCode: '829013', email: 'yamada@example.com',
    points: 2500,
    transactions: [
      { id: 1, type: 'EARN', amount: 500, date: '2025-12-10 10:00' }
    ],
    staffMemo: '',
    blacklist: false
  },
  { 
    id: '2', name: '鈴木 花子', role: 'member', memberCode: '102938', email: 'suzuki@example.com',
    points: 500, transactions: [], staffMemo: '常連様です', blacklist: false
  },
  { 
    id: '3', name: '佐藤 健', role: 'member', memberCode: '554422', email: 'sato@example.com',
    points: 0, transactions: [], blacklist: true // ブラックリストテスト用
  },
  { id: '4', name: '田中 未来', role: 'member', memberCode: '998877', email: 'tanaka@example.com', points: 1200, transactions: [] },
  { id: '5', name: '高橋 優', role: 'member', memberCode: '123456', email: 'takahashi@example.com', points: 300, transactions: [] },
];

export const MockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<User[]>(INITIAL_MEMBERS);
  
  // コース初期値
  const [courses, setCourses] = useState<Course[]>([
      { id: '70min', label: '70分', points: 1000 },
      { id: '100min', label: '100分', points: 1500 },
  ]);

  // 現在のユーザー情報（ポイント・履歴）をmembersステートと同期させるための派生値
  const currentUserMemberData = user?.role === 'member' 
    ? members.find(m => m.id === user.id) 
    : null;

  const points = currentUserMemberData?.points || 0;
  const transactions = currentUserMemberData?.transactions || [];

  // モックログイン処理
  const login = async (role: UserRole) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (role === 'admin') {
      setUser({
        id: 'admin-1',
        name: '店舗スタッフ',
        role: 'admin',
        email: 'admin@example.com',
      });
    } else {
      // 会員ログイン: ID '1' の山田太郎としてログイン
      const member = members.find(m => m.id === '1');
      if (member) {
        setUser(member);
      }
    }
  };

  const logout = () => {
    setUser(null);
  };

  // ポイント追加 (現在のログインユーザーに対して)
  const addPoints = (amount: number) => {
    if (!user || user.role !== 'member') return;

    setMembers(prev => prev.map(m => {
      if (m.id === user.id) {
        // ブラックリストの場合（念のためここでもブロック）
        if (m.blacklist) return m; 

        return {
          ...m,
          points: (m.points || 0) + amount,
          transactions: [
            { id: Date.now(), type: 'EARN', amount, date: new Date().toLocaleString() },
            ...(m.transactions || [])
          ]
        };
      }
      return m;
    }));
  };

  // ポイント利用 (現在のログインユーザーに対して)
  const usePoints = (amount: number) => {
    if (!user || user.role !== 'member') return false;
    
    // state更新関数内でチェック
    const currentMember = members.find(m => m.id === user.id);
    // ブラックリスト(利用停止)チェックを追加
    if (!currentMember || currentMember.blacklist) return false;
    // ポイント不足チェック
    if ((currentMember.points || 0) < amount) return false;

    setMembers(prev => prev.map(m => {
      if (m.id === user.id) {
        return {
          ...m,
          points: (m.points || 0) - amount,
          transactions: [
            { id: Date.now(), type: 'USE', amount, date: new Date().toLocaleString() },
            ...(m.transactions || [])
          ]
        };
      }
      return m;
    }));
    return true;
  };

  // コース管理
  const addCourse = (data: Omit<Course, 'id'>) => {
    const newCourse = { ...data, id: Date.now().toString() };
    setCourses(prev => [...prev, newCourse]);
  };

  const updateCourse = (id: string, data: Partial<Omit<Course, 'id'>>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  // 会員検索
  const searchMembers = (query: string): User[] => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return members.filter(m => 
      m.name.includes(query) || 
      (m.memberCode && m.memberCode.includes(lowerQuery))
    );
  };

  const getMember = (id: string) => members.find(m => m.id === id);

  // 以下、管理者機能

  // メモ更新
  const updateMemberMemo = (id: string, memo: string) => {
    setMembers(prev => prev.map(m => 
      m.id === id ? { ...m, staffMemo: memo } : m
    ));
  };

  // ブラックリスト切り替え
  const toggleBlacklist = (id: string) => {
    setMembers(prev => prev.map(m => 
      m.id === id ? { ...m, blacklist: !m.blacklist } : m
    ));
  };

  // 取引取り消し
  const cancelTransaction = (memberId: string, transactionId: number) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;

      const targetTx = m.transactions?.find(t => t.id === transactionId);
      if (!targetTx || targetTx.isCancelled) return m;

      // ポイント計算の巻き戻し
      // EARNを取り消す -> ポイントを減らす
      // USEを取り消す -> ポイントを戻す
      let newPoints = m.points || 0;
      if (targetTx.type === 'EARN') {
        newPoints -= targetTx.amount;
      } else {
        newPoints += targetTx.amount;
      }

      // 履歴の更新
      const newTransactions = m.transactions?.map(t => 
        t.id === transactionId ? { ...t, isCancelled: true } : t
      );

      return {
        ...m,
        points: newPoints,
        transactions: newTransactions
      };
    }));
  };

  return (
    <MockContext.Provider value={{ 
        user, points, transactions, courses, 
        login, logout, addPoints, usePoints,
        addCourse, updateCourse, deleteCourse,
        members, searchMembers, getMember,
        updateMemberMemo, toggleBlacklist, cancelTransaction
    }}>
      {children}
    </MockContext.Provider>
  );
};

export const useMock = () => {
  const context = useContext(MockContext);
  if (!context) {
    throw new Error('useMock must be used within a MockProvider');
  }
  return context;
};
