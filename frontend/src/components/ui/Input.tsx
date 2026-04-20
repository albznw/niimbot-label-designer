import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`bg-[#1a1a1a] border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-accent ${className}`}
        {...props}
      />
    </div>
  )
}
