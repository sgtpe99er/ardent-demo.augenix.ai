'use client';

import { useRef, useState } from 'react';
import {
  IoCheckmarkCircle,
  IoChevronDown,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoSparklesOutline,
} from 'react-icons/io5';

import { cn } from '@/utils/cn';

const MOCK_EXTRACTION = `Statement for Parts Supplier A
Period: Apr 2026
Total Due: 12,494.75

Invoices:
  PSA-2026-0415    1,247.50
  PSA-2026-0418      875.00
  PSA-2026-0420    2,999.75    (note tax adjustment)
  PSA-2026-0422    1,590.25
  PSA-2026-0425    2,890.00`;

type Phase = 'idle' | 'uploaded' | 'extracting' | 'extracted';

/**
 * UI-only placeholder for the future OCR pipeline. Simulates a vendor statement
 * upload + extraction flow with a pre-defined mock output.
 */
export function OcrUpload() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(file: File) {
    setFileName(file.name);
    setPhase('uploaded');
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }

  function simulate() {
    setPhase('extracting');
    setTimeout(() => setPhase('extracted'), 1800);
  }

  function reset() {
    setPhase('idle');
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className='mt-8 rounded-sm border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='flex w-full items-center justify-between gap-3 px-5 py-3 text-left'
      >
        <div className='flex items-center gap-3'>
          <IoDocumentTextOutline className='h-5 w-5 text-on-surface-variant dark:text-neutral-400' />
          <div>
            <p className='text-sm font-semibold text-on-surface dark:text-white'>
              Upload vendor statement (PDF / image)
            </p>
            <p className='text-xs text-on-surface-variant dark:text-neutral-400'>
              Drop a statement file and simulate OCR extraction.
            </p>
          </div>
        </div>
        <IoChevronDown
          className={cn(
            'h-4 w-4 text-on-surface-variant transition-transform dark:text-neutral-400',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className='border-t border-zinc-200 p-5 dark:border-zinc-800'>
          {phase === 'idle' && (
            <label
              htmlFor='ocr-file-input'
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors',
                isDragging
                  ? 'border-on-surface bg-zinc-50 dark:border-white dark:bg-zinc-900'
                  : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
              )}
            >
              <IoCloudUploadOutline className='h-8 w-8 text-on-surface-variant dark:text-neutral-400' />
              <p className='mt-3 text-sm font-medium text-on-surface dark:text-white'>
                Drop a PDF or image here
              </p>
              <p className='mt-1 text-xs text-on-surface-variant dark:text-neutral-400'>
                or click to browse &nbsp;·&nbsp; max 10 MB
              </p>
              <input
                ref={inputRef}
                id='ocr-file-input'
                type='file'
                accept='application/pdf,image/*'
                className='hidden'
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) acceptFile(f);
                }}
              />
            </label>
          )}

          {phase !== 'idle' && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded-sm bg-zinc-50 px-4 py-3 dark:bg-zinc-900'>
                <div className='flex items-center gap-3'>
                  <IoDocumentTextOutline className='h-5 w-5 text-on-surface-variant dark:text-neutral-400' />
                  <div>
                    <p className='text-sm font-medium text-on-surface dark:text-white'>
                      {fileName ?? 'statement.pdf'}
                    </p>
                    <p className='text-xs text-on-surface-variant dark:text-neutral-400'>
                      Ready for extraction
                    </p>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={reset}
                  className='text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-on-surface dark:text-neutral-400 dark:hover:text-white'
                >
                  Remove
                </button>
              </div>

              {phase === 'uploaded' && (
                <button
                  type='button'
                  onClick={simulate}
                  className='inline-flex items-center gap-2 rounded-sm bg-on-surface px-4 py-2 text-sm font-semibold text-white hover:bg-on-surface/90 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
                >
                  <IoSparklesOutline className='h-4 w-4' /> Simulate OCR
                </button>
              )}

              {phase === 'extracting' && (
                <div className='flex items-center gap-2 text-sm text-on-surface-variant dark:text-neutral-400'>
                  <IoSparklesOutline className='h-4 w-4 animate-pulse' />
                  Extracting text from document…
                </div>
              )}

              {phase === 'extracted' && (
                <div>
                  <div className='mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300'>
                    <IoCheckmarkCircle className='h-4 w-4' />
                    Extraction preview
                  </div>
                  <pre className='whitespace-pre-wrap rounded-sm border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-on-surface-variant dark:border-zinc-800 dark:bg-zinc-950 dark:text-neutral-400'>
                    {MOCK_EXTRACTION}
                  </pre>
                  <p className='mt-3 text-xs italic text-on-surface-variant dark:text-neutral-500'>
                    This is a mock preview for demo purposes. Real OCR via vision models will be
                    wired up in a future milestone.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
