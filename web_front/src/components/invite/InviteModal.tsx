import React, { useState } from 'react';
import { X, Copy, Mail, Calendar, MessageCircle, Send, QrCode, Check, Loader } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { Meeting } from '../../types';
import { copyToClipboard } from '../../utils/meetingUtils';
import { downloadICS, getEmailInviteUrl, getWhatsAppShareUrl, getTelegramShareUrl } from '../../utils/calendarUtils';
import { useMeetings } from '../../context/MeetingContext';

interface Props {
  meeting: Meeting;
  onClose: () => void;
}

export default function InviteModal({ meeting, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const { sendInvites } = useMeetings();

  const handleCopy = async () => {
    await copyToClipboard(meeting.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailInvite = () => {
    window.open(getEmailInviteUrl(meeting), '_blank');
  };

  const handleCalendarDownload = () => {
    downloadICS(meeting);
  };

  const handleWhatsApp = () => {
    window.open(getWhatsAppShareUrl(meeting), '_blank');
  };

  const handleTelegram = () => {
    window.open(getTelegramShareUrl(meeting), '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invite People</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="link-copy">
            <code>{meeting.link}</code>
            <button className="btn btn-sm btn-primary" onClick={handleCopy}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>

          {emailResult && (
            <div style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 12,
              background: emailResult.startsWith('✓') ? 'rgba(0,200,83,0.1)' : 'rgba(255,50,50,0.1)',
              color: emailResult.startsWith('✓') ? 'var(--accent-green)' : 'var(--error)',
              fontSize: '0.85rem', textAlign: 'center'
            }}>
              {emailResult}
            </div>
          )}

          {showQR ? (
            <div className="qr-container">
              <QRCodeCanvas value={meeting.link} size={200} level="H" />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scan to join meeting</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowQR(false)}>Hide QR Code</button>
            </div>
          ) : (
            <div className="share-grid">
              <div className="share-option" onClick={handleEmailInvite} style={{ cursor: emailSending ? 'wait' : 'pointer' }}>
                {emailSending ? <Loader size={28} className="spinner" /> : <Mail size={28} color="var(--accent-red)" />}
                <span>{emailSending ? 'Sending...' : 'Email'}</span>
              </div>
              <div className="share-option" onClick={handleCalendarDownload}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.5 4H6.5C5.11929 4 4 5.11929 4 6.5V17.5C4 18.8807 5.11929 20 6.5 20H17.5C18.8807 20 20 18.8807 20 17.5V6.5C20 5.11929 18.8807 4 17.5 4Z" fill="#FFF" />
                  <path d="M4 8.5V6.5C4 5.11929 5.11929 4 6.5 4H17.5C18.8807 4 20 5.11929 20 6.5V8.5H4Z" fill="#4285F4" />
                  <path d="M16 2V6" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 2V6" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
                  <rect x="7" y="11" width="4" height="4" rx="1" fill="#EA4335" />
                  <rect x="13" y="11" width="4" height="4" rx="1" fill="#FBBC04" />
                  <rect x="7" y="16" width="4" height="4" rx="1" fill="#34A853" />
                  <rect x="13" y="16" width="4" height="4" rx="1" fill="#4285F4" />
                </svg>
                <span>Calendar</span>
              </div>
              <div className="share-option" onClick={handleWhatsApp}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#25D366">
                  <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.122.553 4.17 1.6 5.996L.234 23.473l5.59-1.468A11.968 11.968 0 0012.031 24c6.646 0 12.03-5.384 12.03-12.03S18.677 0 12.031 0zm0 22.012c-1.802 0-3.567-.485-5.115-1.4l-.367-.217-3.799.997.999-3.704-.238-.379a9.984 9.984 0 01-1.536-5.342c0-5.545 4.512-10.057 10.057-10.057s10.057 4.512 10.057 10.057-4.511 10.057-10.056 10.057z" />
                  <path d="M17.514 14.156c-.274-.137-1.623-.801-1.874-.892-.25-.091-.433-.137-.616.137-.183.274-.707.892-.867 1.074-.16.183-.32.206-.594.069-.274-.137-1.157-.426-2.204-1.36-.814-.726-1.364-1.624-1.524-1.898-.16-.274-.017-.423.12-.56.124-.124.274-.32.411-.48.137-.16.183-.274.274-.457.091-.183.046-.343-.023-.48-.069-.137-.616-1.486-.845-2.034-.223-.536-.449-.463-.616-.472-.16-.009-.343-.009-.526-.009s-.48.069-.731.343c-.25.274-.959.937-.959 2.285 0 1.348.982 2.651 1.119 2.834.137.183 1.931 2.948 4.675 4.132.654.283 1.164.452 1.562.578.657.208 1.255.178 1.725.108.525-.078 1.623-.663 1.851-1.303.228-.64.228-1.188.16-1.303-.068-.114-.25-.183-.524-.32z" fill="#FFF" />
                </svg>
                <span>WhatsApp</span>
              </div>
              <div className="share-option" onClick={handleTelegram}>
                <Send size={28} color="var(--accent-cyan)" />
                <span>Telegram</span>
              </div>
              <div className="share-option" onClick={() => setShowQR(true)} style={{ gridColumn: 'span 2' }}>
                <QrCode size={28} color="var(--text-secondary)" />
                <span>Show QR Code</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
