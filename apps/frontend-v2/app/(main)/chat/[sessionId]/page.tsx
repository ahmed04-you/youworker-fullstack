import { ChatView } from '@/src/components/chat/ChatView'

export default function SessionPage({
  params,
}: {
  params: { sessionId: string }
}) {
  return <ChatView sessionId={params.sessionId} />
}
