// src/components/features/card/BoardingPass.tsx
import React from 'react';

// 企画書に基づき、メインカラーをティールグリーン (#2b9b96) に設定
const PRIMARY_COLOR = '#2b9b96';

// 会員証のデータ型定義 (企画書の profiles テーブルに基づき抜粋)
interface MemberCardProps {
  memberCode: string; // 会員ID (member_code)
  displayName: string; // 表示名
  currentPoints: number; // 現在の保有ポイント
  rank: string; // 会員ランク
}

const BoardingPass: React.FC<MemberCardProps> = ({
  memberCode,
  displayName,
  currentPoints,
  rank,
}) => {
  return (
    <div className="flex justify-center p-4">
      {/* ベースコンテナ（シャドウとマージン） */}
      <div className="w-full max-w-sm">
        {/*
          カード本体:
          - 背景色をメインカラーに
          - 搭乗券モチーフのため、上部の切り欠きはCSSの擬似要素で実装
        */}
        <div
          className="relative rounded-t-xl p-6 shadow-2xl"
          style={{ backgroundColor: PRIMARY_COLOR }}
        >
          {/* 1. 搭乗券の上部（ユーザー情報とランク） */}
          <div className="flex justify-between items-start text-white mb-4">
            <div>
              <p className="text-xs opacity-75">PASSENGER / MEMBER ID</p>
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-sm opacity-90 tracking-wider mt-1">{memberCode}</p>
            </div>
            {/* ランク表示 */}
            <div className="text-right">
              <span className="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-white text-gray-800">
                {rank.toUpperCase()}
              </span>
            </div>
          </div>

          {/* 2. 区切り線（点線と円） */}
          <div className="relative my-4">
            <hr className="border-dashed border-t-2 border-gray-200 opacity-50" />
            {/* 左右の切り欠き風の円 */}
            <div className="absolute top-1/2 -mt-3 w-6 h-6 bg-white rounded-full -left-8" style={{ transform: 'translateY(-50%)' }} />
            <div className="absolute top-1/2 -mt-3 w-6 h-6 bg-white rounded-full -right-8" style={{ transform: 'translateY(-50%)' }} />
          </div>

          {/* 3. 搭乗券の下部（ポイント情報） */}
          <div className="grid grid-cols-2 gap-4 text-white pt-4">
            <div>
              <p className="text-xs opacity-75">CURRENT POINTS</p>
              <p className="text-3xl font-extrabold mt-1">{currentPoints.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">STATUS</p>
              <p className="text-lg font-medium mt-1">AVAILABLE</p>
            </div>
          </div>
        </div>
        
        {/*
          下部: QRコードエリア
          - 白背景でQRコードと説明文を表示
          - こちらも擬似要素で下部の切り欠きを再現可能
        */}
        <div className="bg-white p-6 rounded-b-xl shadow-xl">
          <p className="text-center text-sm mb-4 text-gray-500">
            {/* 企画書より: 会員証QRコードを表示 */}
            店舗スタッフに提示してください
          </p>
          {/* ここに会員証QRコードを挿入する */}
          <div className="flex justify-center py-4 bg-gray-50 border border-gray-200 rounded-lg">
            {/* 実際は <QRGenerator data={memberCode} /> などが入る */}
            <div className="w-40 h-40 bg-gray-300 flex items-center justify-center text-gray-600">
              [会員証QRコード]
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default BoardingPass;