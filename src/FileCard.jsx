import React from 'react';

export default function FileCard({ item, onClick, T, darkMode }) {
  const isPdf = item?.url?.toLowerCase().includes('.pdf') || item?.type?.toLowerCase().includes('pdf') || item?.title?.toLowerCase().includes('.pdf');
  const isImage = item?.url?.toLowerCase().match(/\.(png|jpe?g|webp|gif)/) || item?.type?.toLowerCase().includes('image');
  const icon = isPdf ? '📄' : isImage ? '🖼️' : '📁';

  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        background: T?.card || 'rgba(255,255,255,0.08)',
        border: `1px solid ${T?.cardBorder || 'rgba(255,255,255,0.14)'}`,
        borderRadius: '16px',
        padding: '16px',
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        boxShadow: T?.shadow || '0 10px 28px rgba(0,0,0,0.12)',
        textAlign: 'right',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        fontFamily: 'Cairo, sans-serif',
        color: T?.text || '#fff'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 34px rgba(0,0,0,0.15)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = T?.shadow || '0 10px 28px rgba(0,0,0,0.12)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, overflow: 'hidden' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(91,82,212,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: '15px', fontWeight: '700', color: T?.text || '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item?.title || item?.name || 'ملف بدون اسم'}
          </span>
          <span style={{ fontSize: '12px', color: T?.subtext || '#94a3b8', marginTop: '2px' }}>
            {isPdf ? 'ملف PDF' : isImage ? 'صورة' : 'ملف'} • اضغط للمعاينة
          </span>
        </div>
      </div>
      <span style={{ color: T?.accent || '#8b82e8', fontSize: '18px' }}>👁️</span>
    </button>
  );
}
