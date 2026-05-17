'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ChatUnreadBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function fetchCount() {
      const { data } = await supabase.rpc('get_unread_count')
      setCount((data as number) ?? 0)
    }

    fetchCount()

    const channel = supabase
      .channel('unread-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchCount()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <span style={{
      marginLeft: 'auto',
      minWidth: 18, height: 18,
      borderRadius: 9,
      background: 'var(--teal)',
      color: '#0a0a0b',
      fontSize: 10,
      fontWeight: 700,
      display: 'grid',
      placeItems: 'center',
      padding: '0 4px',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
