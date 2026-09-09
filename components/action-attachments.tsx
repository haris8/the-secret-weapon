'use client';

import { useRef, useState } from 'react';
import { Download, FileText, ImageIcon, Paperclip, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { attachmentFileError, fileSize, MAX_ATTACHMENTS, type QueuedAttachment, type TaskAttachment } from '@/lib/attachments';

type Props = {
  attachments: TaskAttachment[];
  queued: QueuedAttachment[];
  removed: string[];
  disabled: boolean;
  demo: boolean;
  onQueue: (files: QueuedAttachment[]) => void;
  onRemove: (ids: string[]) => void;
  onDownload: (file: TaskAttachment) => Promise<void>;
};

export function ActionAttachments({ attachments, queued, removed, disabled, demo, onQueue, onRemove, onDownload }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const count = attachments.filter(file => !removed.includes(file.id)).length + queued.length;

  function addFiles(files: File[]) {
    if (disabled || !files.length) return;
    if (count + files.length > MAX_ATTACHMENTS) { setError('Each action can hold up to 10 files. Remove a file or choose fewer files.'); return; }
    for (const file of files) { const problem = attachmentFileError(file); if (problem) { setError(problem); return; } }
    onQueue([...queued, ...files.map(file => ({ id: crypto.randomUUID(), file }))]);
    setError('');
  }

  async function download(file: TaskAttachment) {
    setDownloading(file.id); setError('');
    try { await onDownload(file); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not download this file.'); }
    finally { setDownloading(null); }
  }

  return <section className="action-attachments" aria-labelledby="attachments-heading">
    <div className="attachments-heading"><h3 id="attachments-heading"><Paperclip size={17} />Attachments <span>{count}/{MAX_ATTACHMENTS}</span></h3></div>
    <div className={`attachment-dropzone ${dragging ? 'is-dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); if (!disabled && event.dataTransfer.types.includes('Files')) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
      <Button type="button" variant="outline" disabled={disabled || count >= MAX_ATTACHMENTS} onClick={() => picker.current?.click()}><Paperclip size={16} />Add files</Button>
      <span>or drop files here</span>
      <input ref={picker} type="file" multiple hidden aria-label="Choose attachments" disabled={disabled} onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      <p>PDFs, images, documents, and other files · up to 10 MB each</p>
    </div>
    {(attachments.length > 0 || queued.length > 0) && <ul className="attachment-list">
      {attachments.map(file => {
        const removing = removed.includes(file.id);
        return <li key={file.id}><Attachment className={`action-file ${removing ? 'pending-removal' : ''}`}>
          <AttachmentMedia>{file.contentType.startsWith('image/') ? <ImageIcon /> : <FileText />}</AttachmentMedia>
          <AttachmentContent><AttachmentTitle title={file.name}>{file.name}</AttachmentTitle><AttachmentDescription>{fileSize(file.size)} · {removing ? 'Removed when you save' : downloading === file.id ? 'Downloading…' : 'Saved'}</AttachmentDescription></AttachmentContent>
          <AttachmentActions>
            {!removing && <AttachmentAction type="button" size="icon" disabled={disabled || downloading !== null} aria-label={`Download ${file.name}`} onClick={() => void download(file)}><Download /></AttachmentAction>}
            <AttachmentAction type="button" size="icon" disabled={disabled} aria-label={`${removing ? 'Keep' : 'Remove'} ${file.name}`} onClick={() => {
              if (removing && count >= MAX_ATTACHMENTS) { setError('Remove another file before keeping this one. Each action can hold up to 10 files.'); return; }
              onRemove(removing ? removed.filter(id => id !== file.id) : [...removed, file.id]); setError('');
            }}>{removing ? <RotateCcw /> : <X />}</AttachmentAction>
          </AttachmentActions>
        </Attachment></li>;
      })}
      {queued.map(({ id, file }) => <li key={id}><Attachment state="idle" className="action-file">
        <AttachmentMedia>{file.type.startsWith('image/') ? <ImageIcon /> : <FileText />}</AttachmentMedia>
        <AttachmentContent><AttachmentTitle title={file.name}>{file.name}</AttachmentTitle><AttachmentDescription>{fileSize(file.size)} · Ready to upload</AttachmentDescription></AttachmentContent>
        <AttachmentActions><AttachmentAction type="button" size="icon" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => { onQueue(queued.filter(item => item.id !== id)); setError(''); }}><X /></AttachmentAction></AttachmentActions>
      </Attachment></li>)}
    </ul>}
    {(queued.length > 0 || removed.length > 0) && <p className="attachment-hint">File changes apply when you save. If you reload first, reselect your unsaved files and removals.</p>}
    {demo && <p className="attachment-hint">Example files are temporary and disappear when you leave or reload.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
