'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/actions/chat'
import { IcChevRight } from '@/components/ui/Icons'

interface Profile { id: string; full_name: string | null; avatar_initials: string | null; role: string | null }
interface Message { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; sender?: Profile | null }

interface Props {
  conversationId: string
  title: string
  isGroup: boolean
  initialMessages: Message[]
  currentUserId: string
  currentProfile: Profile | null
  profileMap: Record<string, Profile>
  memberCount: number
}

export default function ChatWindow({
  conversationId, title, isGroup, initialMessages,
  currentUserId, currentProfile, profileMap, memberCount,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message
          // Avoid duplicates (optimistic update)
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, { ...msg, sender: profileMap[msg.sender_id] ?? null }]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, profileMap])

  function handleSend() {
    const text = input.trim()
    if (!text) return

    // Optimistic update
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      sender: currentProfile,
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    inputRef.current?.focus()

    startTransition(async () => {
      await sendMessage(conversationId, text)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.msgs.push(msg)
    else grouped.push({ date, msgs: [msg] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 32px)' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <Link href="/chat" style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', textDecoration: 'none', fontSize: 13, gap: 4 }}>
          ← Chat
        </Link>
        <span style={{ color: 'var(--border)' }}>/</span>

        <div style={{
          width: 36, height: 36, borderRadius: isGroup ? 8 : '50%',
          background: isGroup ? 'linear-gradient(135deg,#7B5FFF,#00D4AA)' : 'var(--gradient)',
          display: 'grid', placeItems: 'center',
          color: '#0a0a0b', fontWeight: 700, fontSize: 12, flexShrink: 0,
        }}>
          {isGroup ? title.slice(0, 2).toUpperCase() : (profileMap[Object.keys(profileMap).find(id => id !== currentUserId) ?? '']?.avatar_initials ?? '?')}
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {isGroup ? `${memberCount} miembros` : 'Mensaje directo'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 40 }}>
            Sé el primero en escribir algo 👋
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'capitalize' }}>{date}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {msgs.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId
                const prevMsg = msgs[i - 1]
                const sameAsPrev = prevMsg?.sender_id === msg.sender_id
                const sender = msg.sender ?? profileMap[msg.sender_id] ?? null

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: 8,
                      marginTop: sameAsPrev ? 2 : 12,
                    }}
                  >
                    {/* Avatar — only show if first in a run */}
                    {!isMe && (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: sameAsPrev ? 'transparent' : 'var(--gradient)',
                        display: 'grid', placeItems: 'center',
                        color: '#0a0a0b', fontWeight: 700, fontSize: 10,
                        flexShrink: 0,
                        visibility: sameAsPrev ? 'hidden' : 'visible',
                      }}>
                        {sender?.avatar_initials ?? '?'}
                      </div>
                    )}

                    <div style={{ maxWidth: '65%' }}>
                      {/* Sender name — only for groups, first in run */}
                      {isGroup && !isMe && !sameAsPrev && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 3, marginLeft: 2 }}>
                          {sender?.full_name ?? '—'}
                        </div>
                      )}

                      <div style={{
                        padding: '9px 14px',
                        borderRadius: isMe
                          ? '16px 16px 4px 16px'
                          : '16px 16px 16px 4px',
                        background: isMe
                          ? 'var(--teal)'
                          : 'rgba(255,255,255,0.06)',
                        color: isMe ? '#0a0a0b' : 'var(--fg)',
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        border: isMe ? 'none' : '1px solid var(--border-soft)',
                      }}>
                        {msg.content}
                      </div>

                      <div style={{
                        fontSize: 10.5, color: 'var(--muted-2)',
                        marginTop: 3, textAlign: isMe ? 'right' : 'left',
                        paddingRight: isMe ? 2 : 0, paddingLeft: isMe ? 0 : 2,
                      }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 28px', borderTop: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            rows={1}
            style={{
              flex: 1, resize: 'none', background: 'transparent',
              border: 'none', outline: 'none', color: 'var(--fg)',
              fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
              maxHeight: 120, overflowY: 'auto',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || pending}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: input.trim() ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
              color: input.trim() ? '#0a0a0b' : 'var(--muted)',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'grid', placeItems: 'center',
              transition: 'background 150ms, color 150ms',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 6, paddingLeft: 2 }}>
          Enter para enviar · Shift+Enter para nueva línea
        </div>
      </div>
    </div>
  )
}
