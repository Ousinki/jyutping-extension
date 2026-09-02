'use client';

import React, { useState, useRef } from 'react';
import { X, Paperclip, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const MAX_FILES = 3;
  const MAX_SINGLE_SIZE = 3 * 1024 * 1024; // 3MB
  const MAX_TOTAL_SIZE = 4.5 * 1024 * 1024; // 4.5MB

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setStatusMsg('');
    const newFiles = Array.from(fileList);
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const updated = [...attachments];

    for (const file of newFiles) {
      if (updated.length >= MAX_FILES) {
        setStatusMsg('最多只能附帶 3 張截圖');
        break;
      }
      if (!validTypes.includes(file.type)) {
        setStatusMsg('僅支持 PNG、JPG、WEBP 格式的圖片');
        continue;
      }
      if (file.size > MAX_SINGLE_SIZE) {
        setStatusMsg('單張圖片不能超過 3MB');
        continue;
      }
      const total = updated.reduce((acc, f) => acc + f.size, 0);
      if (total + file.size > MAX_TOTAL_SIZE) {
        setStatusMsg('所有圖片總和不能超過 4.5MB');
        break;
      }
      updated.push(file);
    }
    setAttachments(updated);
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
    setStatusMsg('');
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile();
        if (f) pastedFiles.push(f);
      }
    }
    if (pastedFiles.length > 0) {
      const dt = new DataTransfer();
      pastedFiles.forEach((file) => dt.items.add(file));
      handleAddFiles(dt.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('loading');
    setStatusMsg('');

    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('message', message);
      if (attachments[0]) formData.append('attachment', attachments[0]);
      if (attachments[1]) formData.append('attachment_2', attachments[1]);
      if (attachments[2]) formData.append('attachment_3', attachments[2]);

      const res = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setStatusMsg(data.message || '發送成功！感謝您的寶貴反饋！');
        setMessage('');
        setEmail('');
        setAttachments([]);
        setTimeout(() => {
          onClose();
          setStatus('idle');
          setStatusMsg('');
        }, 3000);
      } else {
        setStatus('error');
        setStatusMsg(data.message || '發送失敗，請稍後重試');
      }
    } catch {
      setStatus('error');
      setStatusMsg('網絡連接異常，請稍後重試');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-[#1c1b1e] border border-slate-300 dark:border-[#333138] shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">意見與反饋</h3>
            <p className="text-xs text-slate-500 mt-0.5">您的建議將幫助我們改進粵語詞典！</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#262529] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              聯絡電郵 <span className="font-normal text-slate-400">(選填，方便回覆您)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#333138] rounded-lg focus:outline-none focus:border-[#8A1C1C] text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                反饋內容 <span className="text-[#8A1C1C] dark:text-[#f87171]">*</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_FILES}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-dashed transition-all ${
                  attachments.length >= MAX_FILES
                    ? 'opacity-50 cursor-not-allowed border-slate-300 dark:border-slate-700 text-slate-400'
                    : 'border-slate-300 dark:border-[#333138] text-slate-600 dark:text-slate-300 hover:border-[#8A1C1C] hover:text-[#8A1C1C] cursor-pointer'
                }`}
              >
                <Paperclip className="w-3 h-3" />
                <span>附帶截圖 ({attachments.length}/3)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp, image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder="請填寫您的建議或遇到的問題...（支持 Cmd/Ctrl+V 粘貼截圖）"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#333138] rounded-lg focus:outline-none focus:border-[#8A1C1C] text-slate-900 dark:text-white resize-y"
            />
          </div>

          {/* Attachment Preview Grid */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-[#333138] min-w-0"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-7 h-7 object-cover rounded shrink-0 border border-slate-200 dark:border-[#333138] bg-white"
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                    <p className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="text-slate-400 hover:text-[#8A1C1C] text-xs shrink-0 cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Status Banners */}
          {statusMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                status === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-[#8A1C1C] dark:text-[#f87171]'
              }`}
            >
              {status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === 'loading' || !message.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-[#8A1C1C] hover:bg-[#B42929] disabled:opacity-50 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>發送中...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>發送反饋</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
