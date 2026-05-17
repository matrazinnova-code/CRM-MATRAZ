'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/actions/chat'

interface Profile { id: string; full_name: string | null; avatar_initials: string | null }
interface Conv {
  id: string; type: string; name: string | null; label: string; initials: string
  lastMsg: string; lastTime: string; unread: number
}
interface Msg {
  id: string; sender_id: string; content: string; created_at: string
  senderInitials: string; senderName: string
}

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

interface Props { open: boolean; onClose: () => void }

export default function ChatDrawer({ open, onClose }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [conversations, setConversations] = useState<Conv[]>([])
  const [activeConv, setActiveConv] = useState<Conv | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get current user once
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  // Load conversations when drawer opens
  useEffect(() => {
    if (open && currentUserId) loadConversations()
  }, [open, currentUserId])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime for active conversation
  useEffect(() => {
    if (!activeConv || !currentUserId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`drawer:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const m = payload.new as any
        setMessages(prev => {
          if (prev.some(x => x.id === m.id)) return prev
          return [...prev, {
            id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at,
            senderInitials: profileMap[m.sender_id]?.avatar_initials ?? '?',
            senderName: profileMap[m.sender_id]?.full_name ?? '—',
          }]
        })
        supabase.from('conversation_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', activeConv.id).eq('user_id', currentUserId).then(() => {})
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeConv?.id, currentUserId])

  async function loadConversations() {
    if (!currentUserId) return
    const supabase = createClient()
    setLoading(true)

    const { data: memberships } = await supabase
      .from('conversation_members').select('conversation_id, last_read_at').eq('user_id', currentUserId)

    if (!memberships?.length) { setConversations([]); setLoading(false); return }

    const convIds = memberships.map(m => m.conversation_id)
    const lastReadMap = Object.fromEntries(memberships.map(m => [m.conversation_id, m.last_read_at]))

    const [{ data: convs }, { data: allMembers }] = await Promise.all([
      supabase.from('conversations').select('*').in('id', convIds).order('created_at', { ascending: false }),
      supabase.from('conversation_members').select('conversation_id, user_id').in('conversation_id', convIds),
    ])

    const memberIds = Array.from(new Set((allMembers ?? []).map(m => m.user_id)))
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_initials').in('id', memberIds)
    const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    setProfileMap(pMap)

    const { data: lastMsgs } = await supabase
      .from('messages').select('conversation_id, content, sender_id, created_at')
      .in('conversation_id', convIds).order('created_at', { ascending: false })

    const lastMsgMap: Record<string, any> = {}
    for (const m of (lastMsgs ?? [])) {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
    }

    const result: Conv[] = (convs ?? []).map(conv => {
      let label = conv.name ?? ''
      let initials = ''
      if (conv.type === 'direct') {
        const otherId = (allMembers ?? []).find(m => m.conversation_id === conv.id && m.user_id !== currentUserId)?.user_id
        label = otherId ? (pMap[otherId]?.full_name ?? '—') : '—'
        initials = otherId ? (pMap[otherId]?.avatar_initials ?? '?') : '?'
      } else {
        initials = (conv.name ?? 'G').slice(0, 2).toUpperCase()
      }
      const last = lastMsgMap[conv.id]
      const lastRead = lastReadMap[conv.id]
      const unread = (lastMsgs ?? []).filter(m =>
        m.conversation_id === conv.id && m.sender_id !== currentUserId &&
        (!lastRead || m.created_at > lastRead)
      ).length
      return {
        id: conv.id, type: conv.type, name: conv.name, label, initials,
        lastMsg: last ? (last.sender_id === currentUserId ? 'Tú: ' : '') + last.content : 'Sin mensajes',
        lastTime: last ? new Date(last.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
        unread,
      }
    })

    setConversations(result)
    setLoading(false)
  }

  async function openConversation(conv: Conv) {
    const supabase = createClient()
    setActiveConv(conv)
    setView('chat')
    setMessages([])

    supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conv.id).eq('user_id', currentUserId!).then(() => {})

    const { data: rawMsgs } = await supabase
      .from('messages').select('*').eq('conversation_id', conv.id)
      .order('created_at', { ascending: true }).limit(60)

    const senderIds = Array.from(new Set((rawMsgs ?? []).map((m: any) => m.sender_id)))
    const missing = senderIds.filter(id => !profileMap[id])
    let pMap = { ...profileMap }
    if (missing.length) {
      const { data: extra } = await supabase.from('profiles').select('id, full_name, avatar_initials').in('id', missing)
      for (const p of (extra ?? [])) pMap[p.id] = p
      setProfileMap(pMap)
    }

    setMessages((rawMsgs ?? []).map((m: any) => ({
      id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at,
      senderInitials: pMap[m.sender_id]?.avatar_initials ?? '?',
      senderName: pMap[m.sender_id]?.full_name ?? '—',
    })))
  }

  function handleSend() {
    const text = input.trim()
    if (!text || !activeConv || !currentUserId) return
    const opt: Msg = {
      id: `opt-${Date.now()}`, sender_id: currentUserId, content: text,
      created_at: new Date().toISOString(),
      senderInitials: profileMap[currentUserId]?.avatar_initials ?? '?',
      senderName: profileMap[currentUserId]?.full_name ?? 'Tú',
    }
    setMessages(prev => [...prev, opt])
    setInput('')
    startTransition(async () => { await sendMessage(activeConv.id, text) })
  }

  function goBack() {
    setView('list')
    setActiveConv(null)
    setMessages([])
    loadConversations()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 61, right: 0, bottom: 0, width: 380,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 200, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
        animation: 'slideIn 180ms ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        {view === 'list' ? (
          <>
            {/* List header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Chat</div>
              <button
                onClick={() => { onClose(); router.push('/chat') }}
                style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Ver todo →
              </button>
            </div>

            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Cargando...</div>
              )}
              {!loading && conversations.length === 0 && (
                <div style={{ padding: 32, color: 'var(--muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.7 }}>
                  Sin conversaciones.<br />
                  <button
                    onClick={() => { onClose(); router.push('/chat') }}
                    style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 8 }}
                  >
                    Ir a Chat →
                  </button>
                </div>
              )}
              {conversations.map((conv, i) => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                    textAlign: 'left', color: 'inherit',
                    transition: 'background 80ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: conv.type === 'group' ? 10 : '50%',
                    background: conv.type === 'group' ? 'linear-gradient(135deg,#7B5FFF,#00D4AA)' : 'var(--gradient)',
                    display: 'grid', placeItems: 'center',
                    color: '#0a0a0b', fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>
                    {conv.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 13.5, fontWeight: conv.unread > 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                        {conv.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted-2)', flexShrink: 0, marginLeft: 8 }}>{conv.lastTime}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: conv.unread > 0 ? 'var(--fg)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {conv.lastMsg}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{
                          minWidth: 18, height: 18, borderRadius: 9, background: 'var(--teal)',
                          color: '#0a0a0b', fontSize: 10, fontWeight: 700,
                          display: 'grid', placeItems: 'center', padding: '0 4px',
                          marginLeft: 8, flexShrink: 0,
                        }}>
                          {conv.unread > 99 ? '99+' : conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <button
                onClick={goBack}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, display: 'flex', padding: '2px 6px', borderRadius: 6 }}
              >
                ←
              </button>
              <div style={{
                width: 32, height: 32, borderRadius: activeConv?.type === 'group' ? 8 : '50%',
                background: activeConv?.type === 'group' ? 'linear-gradient(135deg,#7B5FFF,#00D4AA)' : 'var(--gradient)',
                display: 'grid', placeItems: 'center',
                color: '#0a0a0b', fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}>
                {activeConv?.initials}
              </div>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeConv?.label}
              </div>
              <button
                onClick={() => { onClose(); router.push(`/chat/${activeConv?.id}`) }}
                style={{ fontSize: 11, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
              >
                Abrir →
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 32 }}>
                  Sin mensajes aún 👋
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId
                const prev = messages[i - 1]
                const sameAsPrev = prev?.sender_id === msg.sender_id
                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
                    gap: 7, alignItems: 'flex-end', marginTop: sameAsPrev ? 2 : 10,
                  }}>
                    {!isMe && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: 'var(--gradient)',
                        display: 'grid', placeItems: 'center', color: '#0a0a0b', fontWeight: 700, fontSize: 9,
                        flexShrink: 0, visibility: sameAsPrev ? 'hidden' : 'visible',
                      }}>
                        {msg.senderInitials}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '75%', padding: '8px 12px',
                      borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
                      color: isMe ? '#0a0a0b' : 'var(--fg)',
                      fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                      border: isMe ? 'none' : '1px solid var(--border-soft)',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '9px 12px',
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
                  placeholder="Escribe un mensaje..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--fg)', fontSize: 13, fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || pending}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: 'none',
                    background: input.trim() ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
                    color: input.trim() ? '#0a0a0b' : 'var(--muted)',
                    cursor: input.trim() ? 'pointer' : 'default',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                    transition: 'background 150ms',
                  }}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
