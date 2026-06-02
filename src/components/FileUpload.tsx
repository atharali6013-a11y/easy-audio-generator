'use client';

import React, { useRef, useState, useCallback, type DragEvent } from 'react';
import { formatFileSize, getFileTypeIcon } from '@/lib/utils';

// ─── Props ──────────────────────────────────────────────────────────────────

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onRemove: () => void;
}

// ─── Accepted File Types ────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.ppt,.pptx';
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// ─── FileUpload Component ───────────────────────────────────────────────────

export default function FileUpload({
  onFileSelect,
  selectedFile,
  onRemove,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate file type
  const validateFile = useCallback((file: File): boolean => {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    const validExtensions = ACCEPTED_TYPES.split(',');

    if (!validExtensions.includes(ext) && !ACCEPTED_MIME_TYPES.has(file.type)) {
      setError(`Unsupported file type. Please upload: ${validExtensions.join(', ')}`);
      return false;
    }

    setError(null);
    return true;
  }, []);

  // Handle file selection
  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  // Input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFile]
  );

  // Drag events
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle keyboard activation on the drop zone
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker]
  );

  // ── Render: Selected File Card ──────────────────────────────────────────
  if (selectedFile) {
    return (
      <div className="animate-fade-in-up w-full">
        <div className="glass rounded-2xl p-6 hover-lift">
          <div className="flex items-start gap-4">
            {/* File type icon */}
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-3xl">
              {getFileTypeIcon(selectedFile.name)}
            </div>

            {/* File info */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-white">
                {selectedFile.name}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={openFilePicker}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-gray-300 transition-all hover:border-purple-500/30 hover:bg-white/5 hover:text-white"
                aria-label="Replace selected file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Replace
              </button>
              <button
                onClick={onRemove}
                className="flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300"
                aria-label="Remove selected file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Remove
              </button>
            </div>
          </div>
        </div>

        {/* Hidden file input for replace */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    );
  }

  // ── Render: Drop Zone ───────────────────────────────────────────────────
  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          group relative cursor-pointer rounded-2xl border-2 border-dashed
          p-10 text-center transition-all duration-300
          ${
            isDragActive
              ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
              : 'border-purple-500/30 hover:border-purple-400/50 hover:bg-white/[0.02]'
          }
        `}
        aria-label="Upload document. Drag and drop or click to browse. Accepted formats: PDF, DOC, DOCX, TXT, PPT, PPTX"
      >
        {/* Upload icon */}
        <div
          className={`
            mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full
            transition-all duration-300
            ${isDragActive ? 'bg-purple-500/20 scale-110' : 'bg-purple-500/10 group-hover:bg-purple-500/15'}
          `}
          aria-hidden="true"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-all duration-300 ${
              isDragActive
                ? 'text-purple-300 -translate-y-1'
                : 'text-purple-400 group-hover:-translate-y-0.5'
            }`}
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        {/* Text */}
        <p className="mb-1 text-base font-semibold text-white">
          {isDragActive ? 'Drop your file here' : 'Upload PDF / Docs'}
        </p>
        <p className="text-sm text-gray-400">
          {isDragActive
            ? 'Release to upload'
            : 'Drag & drop or click to browse'}
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Supports PDF, DOC, DOCX, TXT, PPT, PPTX
        </p>

        {/* Animated border glow on drag */}
        {isDragActive && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl animate-pulse-glow"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-3 animate-fade-in text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
