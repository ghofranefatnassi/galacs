import React from 'react';
import ReactDOM from 'react-dom';

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  backdropFilter: 'blur(4px)',
};

const containerStyle = {
  backgroundColor: '#1F2937',
  borderRadius: '24px',
  padding: '24px 32px',
  maxWidth: '450px',
  width: '90%',
  boxShadow: '0 20px 35px -10px rgba(0,0,0,0.4)',
  textAlign: 'center',
  border: '1px solid #374151',
};

const titleStyle = {
  fontSize: '1.8rem',
  fontWeight: 'bold',
  marginBottom: '12px',
  color: '#F3F4F6',
};

const messageStyle = {
  color: '#9CA3AF',
  marginBottom: '24px',
  lineHeight: 1.5,
};

const actionsStyle = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'center',
  marginTop: '8px',
};

const buttonStyle = {
  padding: '10px 20px',
  borderRadius: '40px',
  border: 'none',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '0.9rem',
  transition: '0.2s',
};

const cancelButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#374151',
  color: '#E5E7EB',
};

const confirmButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#F59E0B',
  color: '#000',
};

const csvButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#22C55E',
  color: 'white',
};

const pdfButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#EF4444',
  color: 'white',
};

export const ExportConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onCancel}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '16px' }}>
          <svg fill="currentColor" viewBox="0 0 24 24" width="48" height="48" style={{ fill: '#F59E0B' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        <h2 style={titleStyle}>Exporter les données</h2>
        <p style={messageStyle}>
          Voulez-vous exporter les commissions (6 mois) et les indicateurs clés ?
        </p>
        <div style={actionsStyle}>
          <button style={cancelButtonStyle} onClick={onCancel}>Annuler</button>
          <button style={confirmButtonStyle} onClick={onConfirm}>Exporter</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ExportFormatModal = ({ isOpen, onSelect, onCancel }) => {
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onCancel}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Choisir le format</h2>
        <div style={actionsStyle}>
          <button style={csvButtonStyle} onClick={() => onSelect('csv')}>📄 CSV</button>
          <button style={pdfButtonStyle} onClick={() => onSelect('pdf')}>🖨️ PDF (Impression)</button>
          <button style={cancelButtonStyle} onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </div>,
    document.body
  );
};