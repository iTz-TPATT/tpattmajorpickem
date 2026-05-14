-- Run this in Supabase SQL Editor to set up chat

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament text NOT NULL DEFAULT 'pga',
  user_id text,
  username text,
  avatar_slug text,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'user', -- 'user' | 'birdie' | 'bogey' | 'eagle' | 'system'
  metadata jsonb DEFAULT '{}',       -- { golfer, hole, picker_names, score }
  created_at timestamptz DEFAULT now()
);

-- Reactions table
CREATE TABLE IF NOT EXISTS chat_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  username text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament ON chat_messages(tournament, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions(message_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;

-- RLS policies (open read, auth write)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read reactions" ON chat_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reactions" ON chat_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own reactions" ON chat_reactions FOR DELETE USING (true);
