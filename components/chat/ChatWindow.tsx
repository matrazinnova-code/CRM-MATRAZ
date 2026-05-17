'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/actions/chat'
import { IcX } from '@/components/ui/Icons'
import GroupMembersPanel from './GroupMembersPanel'

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
  allUsers: Profile[]
  isCreator: boolean
  memberProfiles: Profile[]
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
  </svg>
)

const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M21.5 18a4.5 4.5 0 0 0-6-4.2"/>
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

export default function ChatWindow({
  conversationId, title, isGroup, initialMessages,
  currentUserId, currentProfile, profileMap, memberCount,
  allUsers, isCreator, memberProfiles,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom
  useEffect(() => {
    if (!searchQuery) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, searchQuery])

  // Mark conversation as read + request notification permission
  useEffect(() => {
    const supabase = createClient()
    supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)
      .then(() => {})

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [conversationId, currentUserId])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, { ...msg, sender: profileMap[msg.sender_id] ?? null }]
          })

          // Mark as read immediately if window is focused
          if (!document.hidden) {
            supabase.from('conversation_members')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', currentUserId)
              .then(() => {})
          }

          // Browser notification when tab is in background
          if (
            msg.sender_id !== currentUserId &&
            document.hidden &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            const sender = profileMap[msg.sender_id]
            new Notification(sender?.full_name ?? 'Nuevo mensaje', {
              body: msg.content,
              icon: '/assets/matraz-innova-logo.png',
              tag: conversationId,
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, currentUserId, profileMap])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearchQuery('')
  }, [searchOpen])

  function handleSend() {
    const text = input.trim()
    if (!text) return

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
    // Reset height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

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

  // Filter messages by search
  const filtered = searchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  // Group by date
  const grouped: { date: string; msgs: Message[] }[] = []
  for (const msg of filtered) {
    const date = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) last.msgs.push(msg)
    else grouped.push({ date, msgs: [msg] })
  }

  function highlight(text: string) {
    if (!searchQuery.trim()) return text
    const idx = text.toLowerCase().indexOf(searchQuery.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(0,212,170,0.3)', borderRadius: 2, color: 'inherit' }}>
          {text.slice(idx, idx + searchQuery.length)}
        </mark>
        {text.slice(idx + searchQuery.length)}
      </>
    )
  }

  const otherMemberId = !isGroup
    ? Object.keys(profileMap).find(id => id !== currentUserId)
    : undefined
  const avatarInitials = isGroup
    ? title.slice(0, 2).toUpperCase()
    : (profileMap[otherMemberId ?? '']?.avatar_initials ?? '?')

  return (
    <div style={{ display: 'flex', height: '100%', maxHeight: 'calc(100vh - 32px)' }}>

      {/* Main chat area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <Link href="/chat" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Chat
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>

          <div style={{
            width: 34, height: 34, borderRadius: isGroup ? 8 : '50%',
            background: isGroup ? 'linear-gradient(135deg,#7B5FFF,#00D4AA)' : 'var(--gradient)',
            display: 'grid', placeItems: 'center',
            color: '#0a0a0b', fontWeight: 700, fontSize: 11, flexShrink: 0,
          }}>
            {avatarInitials}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {isGroup ? `${memberCount} miembros` : 'Mensaje directo'}
            </div>
          </div>

          {/* Header actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setSearchOpen(v => !v)}
              title="Buscar en conversación"
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: searchOpen ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.06)',
                color: searchOpen ? 'var(--teal)' : 'var(--muted)',
                display: 'grid', placeItems: 'center', transition: 'all 150ms',
              }}
            >
              <SearchIcon />
            </button>

            {isGroup && (
              <button
                onClick={() => setShowMembers(v => !v)}
                title="Miembros del grupo"
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: showMembers ? 'rgba(123,95,255,0.15)' : 'rgba(255,255,255,0.06)',
                  color: showMembers ? '#7B5FFF' : 'var(--muted)',
                  display: 'grid', placeItems: 'center', transition: 'all 150ms',
                }}
              >
                <UsersIcon />
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div style={{
            padding: '10px 24px', borderBottom: '1px solid var(--border-soft)',
            background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <SearchIcon />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar mensajes..."
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--fg)', fontSize: 13, fontFamily: 'inherit',
              }}
            />
            {searchQuery && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => setSearchOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
            >
              <IcX size={14} />
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 40 }}>
              {searchQuery ? `Sin resultados para "${searchQuery}"` : 'Sé el primero en escribir algo 👋'}
            </div>
          )}

          {grouped.map(({ date, msgs }) => (
            <div key={date}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
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
                      {!isMe && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--gradient)',
                          display: 'grid', placeItems: 'center',
                          color: '#0a0a0b', fontWeight: 700, fontSize: 10,
                          flexShrink: 0,
                          visibility: sameAsPrev ? 'hidden' : 'visible',
                        }}>
                          {sender?.avatar_initials ?? '?'}
                        </div>
                      )}

                      <div style={{ maxWidth: '65%' }}>
                        {isGroup && !isMe && !sameAsPrev && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 3, marginLeft: 2 }}>
                            {sender?.full_name ?? '—'}
                          </div>
                        )}

                        <div style={{
                          padding: '9px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMe ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
                          color: isMe ? '#0a0a0b' : 'var(--fg)',
                          fontSize: 13.5, lineHeight: 1.45, wordBreak: 'break-word',
                          border: isMe ? 'none' : '1px solid var(--border-soft)',
                        }}>
                          {highlight(msg.content)}
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
          padding: '14px 24px', borderTop: '1px solid var(--border)',
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
              placeholder="Escribe un mensaje..."
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
              <SendIcon />
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 5, paddingLeft: 2 }}>
            Enter para enviar · Shift+Enter para nueva línea
          </div>
        </div>
      </div>

      {/* Group members panel */}
      {isGroup && showMembers && (
        <GroupMembersPanel
          conversationId={conversationId}
          currentUserId={currentUserId}
          isCreator={isCreator}
          members={memberProfiles}
          allUsers={allUsers}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  )
}
