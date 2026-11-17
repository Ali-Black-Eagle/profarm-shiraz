'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface InlineEditableTextProps {
  value: string;
  onChange: (newValue: string) => void;
  isEditing?: boolean;
  isTextarea?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  label?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
}

export default function InlineEditableText({
  value,
  onChange,
  isEditing = true,
  isTextarea = false,
  placeholder = 'برای ویرایش متن کلیک کنید...',
  className = '',
  inputClassName = '',
  label,
  as: Component = 'span',
}: InlineEditableTextProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [currentVal, setCurrentVal] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCurrentVal(value);
  }, [value]);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isFocused]);

  if (!isEditing) {
    return <Component className={className}>{value || placeholder}</Component>;
  }

  const handleCommit = () => {
    setIsFocused(false);
    if (currentVal !== value) {
      onChange(currentVal);
    }
  };

  const handleCancel = () => {
    setIsFocused(false);
    setCurrentVal(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTextarea && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isFocused) {
    return (
      <div className="relative inline-block w-full group/inline my-0.5">
        {label && (
          <span className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-0.5 select-none">
            {label}
          </span>
        )}
        <div className="relative flex items-center">
          {isTextarea ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={currentVal}
              rows={Math.max(2, currentVal.split('\n').length)}
              onChange={(e) => {
                setCurrentVal(e.target.value);
                onChange(e.target.value); // live update
              }}
              onBlur={handleCommit}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full px-2.5 py-1.5 rounded-lg border-2 border-emerald-500 bg-white text-gray-900 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-inherit font-inherit leading-relaxed resize-y ${inputClassName}`}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={currentVal}
              onChange={(e) => {
                setCurrentVal(e.target.value);
                onChange(e.target.value); // live update
              }}
              onBlur={handleCommit}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full px-2 py-1 rounded-lg border-2 border-emerald-500 bg-white text-gray-900 shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-inherit font-inherit ${inputClassName}`}
            />
          )}

          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-0.5 rounded-md border border-gray-200 shadow-sm z-20">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCommit();
              }}
              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
              title="تایید تغییرات"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              className="p-1 text-rose-600 hover:bg-rose-50 rounded"
              title="انصراف"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Component
      onClick={() => setIsFocused(true)}
      title="برای ویرایش کلیک کنید"
      className={`relative group/editable cursor-pointer transition-all rounded-md px-1 -mx-1 hover:outline-dashed hover:outline-2 hover:outline-emerald-500/70 hover:bg-emerald-500/10 ${className}`}
    >
      {value || <span className="opacity-50 italic">{placeholder}</span>}
      <span className="opacity-0 group-hover/editable:opacity-100 transition-opacity inline-flex items-center justify-center mr-1.5 p-1 rounded-md bg-emerald-700 text-white text-xs shadow-sm align-middle select-none pointer-events-none">
        <Edit2 className="w-2.5 h-2.5" />
      </span>
    </Component>
  );
}
