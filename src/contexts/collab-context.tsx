"use client"

import * as React from "react"
// TipTap Cloud collaboration disabled - requires TipTap Pro subscription
// import { TiptapCollabProvider } from "@tiptap-cloud/provider"
import { Doc as YDoc } from "yjs"
import {
  fetchCollabToken,
  getUrlParam,
  TIPTAP_COLLAB_DOC_PREFIX,
  TIPTAP_COLLAB_APP_ID,
} from "@/lib/tiptap-collab-utils"

// Using 'any' for provider type since TipTap Cloud is disabled
export type CollabContextValue = {
  provider: any | null
  ydoc: YDoc
  hasCollab: boolean
}

export const CollabContext = React.createContext<CollabContextValue>({
  hasCollab: false,
  provider: null,
  ydoc: new YDoc(),
})

export const CollabConsumer = CollabContext.Consumer
export const useCollab = (): CollabContextValue => {
  const context = React.useContext(CollabContext)
  if (!context) {
    throw new Error("useCollab must be used within an CollabProvider")
  }
  return context
}

export const useCollaboration = (room: string) => {
  const [provider, setProvider] = React.useState<any | null>(
    null
  )
  const [collabToken, setCollabToken] = React.useState<string | null>(null)
  const [hasCollab, setHasCollab] = React.useState<boolean>(false) // Disable collaboration by default
  const ydoc = React.useMemo(() => new YDoc(), [])

  React.useEffect(() => {
    // This effect is now disabled
    // const noCollabParam = getUrlParam("noCollab")
    // setHasCollab(parseInt(noCollabParam || "0") !== 1)
  }, [])

  React.useEffect(() => {
    if (!hasCollab) return

    const getToken = async () => {
      const token = await fetchCollabToken()
      setCollabToken(token)
    }

    getToken()
  }, [hasCollab])

  React.useEffect(() => {
    if (!hasCollab || !collabToken) return

    const docPrefix = TIPTAP_COLLAB_DOC_PREFIX
    // TipTap Cloud collaboration is disabled (requires TipTap Pro)
    console.warn('TipTap Cloud collaboration requires TipTap Pro subscription')
    
    // Collaboration is disabled, so we don't create a provider
    // const documentName = room ? `${docPrefix}${room}` : docPrefix
    // const appId = TIPTAP_COLLAB_APP_ID
    // const newProvider = new TiptapCollabProvider({
    //   name: documentName,
    //   appId,
    //   token: collabToken,
    //   document: ydoc,
    // })
    // setProvider(newProvider)
    // return () => {
    //   newProvider.destroy()
    // }
  }, [collabToken, ydoc, room, hasCollab])

  return { provider, ydoc, hasCollab }
}

export function CollabProvider({
  children,
  room,
}: Readonly<{
  children: React.ReactNode
  room: string
}>) {
  const { hasCollab, provider, ydoc } = useCollaboration(room)

  const value = React.useMemo<CollabContextValue>(
    () => ({
      hasCollab,
      provider,
      ydoc,
    }),
    [hasCollab, provider, ydoc]
  )

  return (
    <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
  )
}
