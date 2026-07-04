import React from 'react';
import ReactDOM from 'react-dom';

export const ConfirmDeleteModal = ({ isOpen, contactName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay-crm" onClick={onCancel}>
      <div className="modal-container-crm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-crm">
          {/* Trash / delete icon */}
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            width="48"
            height="48"
            style={{ fill: '#ef4444' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              clipRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              fillRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="modal-title-crm">Êtes-vous sûr ?</h2>
        <p className="modal-message-crm">
          Supprimer <strong>{contactName}</strong> ? Cette action est irréversible.
        </p>
        <div className="modal-actions-crm">
          <button className="modal-btn-crm modal-btn-cancel" onClick={onCancel}>
            Annuler
          </button>
          <button className="modal-btn-crm modal-btn-confirm" onClick={onConfirm}>
            Confirmer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const SuccessToast = ({ message, onClose, visible }) => {
  if (!visible) return null;

  return ReactDOM.createPortal(
    <div className="toast-crm">
      <div className="toast-content-crm">
        <div className="toast-icon-crm">
          {/* Checkmark icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            width="18"
            height="18"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        </div>
        <div>
          <p className="toast-title-crm">Contact supprimé</p>
          <p className="toast-desc-crm">{message}</p>
        </div>
        <button className="toast-close-crm" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
};