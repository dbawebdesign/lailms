"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"

// --- Icons ---
import { CodeBlockIcon } from "@/components/tiptap-icons/code-block-icon"
import { HeadingOneIcon } from "@/components/tiptap-icons/heading-one-icon"
import { HeadingTwoIcon } from "@/components/tiptap-icons/heading-two-icon"
import { HeadingThreeIcon } from "@/components/tiptap-icons/heading-three-icon"
import { ImageIcon } from "@/components/tiptap-icons/image-icon"
import { ListIcon } from "@/components/tiptap-icons/list-icon"
import { ListOrderedIcon } from "@/components/tiptap-icons/list-ordered-icon"
import { BlockquoteIcon } from "@/components/tiptap-icons/blockquote-icon"
import { ListTodoIcon } from "@/components/tiptap-icons/list-todo-icon"
import { AiSparklesIcon } from "@/components/tiptap-icons/ai-sparkles-icon"
import { MinusIcon } from "@/components/tiptap-icons/minus-icon"
import { TypeIcon } from "@/components/tiptap-icons/type-icon"
import { AtSignIcon } from "@/components/tiptap-icons/at-sign-icon"
import { SmilePlusIcon } from "@/components/tiptap-icons/smile-plus-icon"
// Import Lucide icons for media types
import { Video, Music, FileText, Folder } from "lucide-react"

// --- Lib ---
import {
  isExtensionAvailable,
  isNodeInSchema,
} from "@/lib/tiptap-utils"
import { findSelectionPosition } from "@/lib/tiptap-advanced-utils"

// --- Tiptap UI ---
import type { SuggestionItem } from "@/components/tiptap-ui-utils/suggestion-menu"
import { addEmojiTrigger } from "@/components/tiptap-ui/emoji-trigger-button"
import { addMentionTrigger } from "@/components/tiptap-ui/mention-trigger-button"


// Helper to safely call AI commands (disabled without TipTap Pro)
const callAiCommand = (editor: any, commandName: string, ...args: any[]) => {
  const chain = editor.chain() as any
  if (typeof chain[commandName] === 'function') {
    chain[commandName](...args)
  } else {
    console.warn(`AI command "${commandName}" requires TipTap Pro subscription`)
  }
}

export interface SlashMenuConfig {
  enabledItems?: SlashMenuItemType[]
  customItems?: SuggestionItem[]
  itemGroups?: {
    [key in SlashMenuItemType]?: string
  }
  showGroups?: boolean
}

const texts = {
  // AI
  continue_writing: {
    title: "Continue Writing",
    subtext: "Continue writing from the current position",
    aliases: ["continue", "write", "continue writing", "ai"],
    badge: AiSparklesIcon,
    group: "AI",
  },
  ai_ask_button: {
    title: "Ask AI",
    subtext: "Ask AI to generate content",
    aliases: ["ai", "ask", "generate"],
    badge: AiSparklesIcon,
    group: "AI",
  },

  // Style
  text: {
    title: "Text",
    subtext: "Regular text paragraph",
    aliases: ["p", "paragraph", "text"],
    badge: TypeIcon,
    group: "Style",
  },
  heading_1: {
    title: "Heading 1",
    subtext: "Top-level heading",
    aliases: ["h", "heading1", "h1"],
    badge: HeadingOneIcon,
    group: "Style",
  },
  heading_2: {
    title: "Heading 2",
    subtext: "Key section heading",
    aliases: ["h2", "heading2", "subheading"],
    badge: HeadingTwoIcon,
    group: "Style",
  },
  heading_3: {
    title: "Heading 3",
    subtext: "Subsection and group heading",
    aliases: ["h3", "heading3", "subheading"],
    badge: HeadingThreeIcon,
    group: "Style",
  },
  bullet_list: {
    title: "Bullet List",
    subtext: "List with unordered items",
    aliases: ["ul", "li", "list", "bulletlist", "bullet list"],
    badge: ListIcon,
    group: "Style",
  },
  ordered_list: {
    title: "Numbered List",
    subtext: "List with ordered items",
    aliases: ["ol", "li", "list", "numberedlist", "numbered list"],
    badge: ListOrderedIcon,
    group: "Style",
  },
  task_list: {
    title: "To-do list",
    subtext: "List with tasks",
    aliases: ["tasklist", "task list", "todo", "checklist"],
    badge: ListTodoIcon,
    group: "Style",
  },
  quote: {
    title: "Blockquote",
    subtext: "Blockquote block",
    aliases: ["quote", "blockquote"],
    badge: BlockquoteIcon,
    group: "Style",
  },
  code_block: {
    title: "Code Block",
    subtext: "Code block with syntax highlighting",
    aliases: ["code", "pre"],
    badge: CodeBlockIcon,
    group: "Style",
  },

  // Insert
  mention: {
    title: "Mention",
    subtext: "Mention a user or item",
    aliases: ["mention", "user", "item", "tag"],
    badge: AtSignIcon,
    group: "Insert",
  },
  emoji: {
    title: "Emoji",
    subtext: "Insert an emoji",
    aliases: ["emoji", "emoticon", "smiley"],
    badge: SmilePlusIcon,
    group: "Insert",
  },
  divider: {
    title: "Separator",
    subtext: "Horizontal line to separate content",
    aliases: ["hr", "horizontalRule", "line", "separator"],
    badge: MinusIcon,
    group: "Insert",
  },

  // Upload
  image: {
    title: "Image",
    subtext: "Resizable image with caption",
    aliases: [
      "image",
      "imageUpload",
      "upload",
      "img",
      "picture",
      "media",
      "url",
    ],
    badge: ImageIcon,
    group: "Upload",
  },
  video: {
    title: "Video",
    subtext: "Embed video with controls",
    aliases: [
      "video",
      "vid",
      "movie",
      "mp4",
      "webm",
      "mov",
      "media",
    ],
    badge: Video,
    group: "Upload",
  },
  audio: {
    title: "Audio",
    subtext: "Embed audio with controls",
    aliases: [
      "audio",
      "sound",
      "music",
      "mp3",
      "wav",
      "ogg",
      "media",
    ],
    badge: Music,
    group: "Upload",
  },
  file: {
    title: "File",
    subtext: "Upload document or file",
    aliases: [
      "file",
      "document",
      "doc",
      "pdf",
      "txt",
      "upload",
      "attachment",
    ],
    badge: FileText,
    group: "Upload",
  },
}

export type SlashMenuItemType = keyof typeof texts

const getItemImplementations = () => {
  return {
    // AI
    continue_writing: {
      check: (editor: Editor) =>
        isExtensionAvailable(editor, ["ai", "aiAdvanced"]),
      action: ({ editor }: { editor: Editor }) => {
        const editorChain = editor.chain().focus()

        const nodeSelectionPosition = findSelectionPosition({ editor })

        if (nodeSelectionPosition !== null) {
          editorChain.setNodeSelection(nodeSelectionPosition)
        }

        editorChain.run()

        callAiCommand(editor, 'aiGenerationShow', )

        requestAnimationFrame(() => {
          const { from } = editor.state.selection
          const textBeforeCursor = editor.state.doc.textBetween(0, from, "\n\n")
          const hasContent = Boolean(textBeforeCursor.trim())

          const prompt = hasContent
            ? `Context: ${
                textBeforeCursor.length > 500
                  ? `...${textBeforeCursor.slice(-500)}`
                  : textBeforeCursor
              }\n\nContinue writing from where the text above ends. Write ONLY ONE SENTENCE. DONT REPEAT THE TEXT.`
            : "Start writing a new paragraph. Write ONLY ONE SENTENCE."

          callAiCommand(editor, 'aiTextPrompt', {
              stream: true,
              format: "rich-text",
              text: prompt,
            })
        })
      },
    },
    ai_ask_button: {
      check: (editor: Editor) =>
        isExtensionAvailable(editor, ["ai", "aiAdvanced"]),
      action: ({ editor }: { editor: Editor }) => {
        const editorChain = editor.chain().focus()

        const nodeSelectionPosition = findSelectionPosition({ editor })

        if (nodeSelectionPosition !== null) {
          editorChain.setNodeSelection(nodeSelectionPosition)
        }

        editorChain.run()

        callAiCommand(editor, 'aiGenerationShow', )
      },
    },

    // Style
    text: {
      check: (editor: Editor) => isNodeInSchema("paragraph", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().setParagraph()
      },
    },
    heading_1: {
      check: (editor: Editor) => isNodeInSchema("heading", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleHeading({ level: 1 })
      },
    },
    heading_2: {
      check: (editor: Editor) => isNodeInSchema("heading", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleHeading({ level: 2 })
      },
    },
    heading_3: {
      check: (editor: Editor) => isNodeInSchema("heading", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleHeading({ level: 3 })
      },
    },
    bullet_list: {
      check: (editor: Editor) => isNodeInSchema("bulletList", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleBulletList()
      },
    },
    ordered_list: {
      check: (editor: Editor) => isNodeInSchema("orderedList", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleOrderedList()
      },
    },
    task_list: {
      check: (editor: Editor) => isNodeInSchema("taskList", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleTaskList()
      },
    },
    quote: {
      check: (editor: Editor) => isNodeInSchema("blockquote", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleBlockquote()
      },
    },
    code_block: {
      check: (editor: Editor) => isNodeInSchema("codeBlock", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().toggleNode("codeBlock", "paragraph")
      },
    },

    // Insert
    mention: {
      check: (editor: Editor) =>
        isExtensionAvailable(editor, ["mention", "mentionAdvanced"]),
      action: ({ editor }: { editor: Editor }) => addMentionTrigger(editor),
    },
    emoji: {
      check: (editor: Editor) =>
        isExtensionAvailable(editor, ["emoji", "emojiPicker"]),
      action: ({ editor }: { editor: Editor }) => addEmojiTrigger(editor),
    },
    divider: {
      check: (editor: Editor) => isNodeInSchema("horizontalRule", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor.chain().focus().setHorizontalRule()
      },
    },

    // Upload
    image: {
      check: (editor: Editor) => isNodeInSchema("image", editor),
      action: ({ editor }: { editor: Editor }) => {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "imageUpload",
          })
      },
    },
    video: {
      check: (editor: Editor) => isNodeInSchema("video", editor),
      action: ({ editor }: { editor: Editor }) => {
        // Trigger file input for video upload
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'video/*'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            try {
              const { mediaUploadService } = await import('@/lib/media-upload-service')
              const result = await mediaUploadService.uploadMedia(file)
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "video",
                  attrs: {
                    src: result.url,
                    controls: true,
                  },
                })
            } catch (error) {
              console.error('Video upload failed:', error)
            }
          }
        }
        input.click()
      },
    },
    audio: {
      check: () => true, // Audio can always be inserted as HTML
      action: ({ editor }: { editor: Editor }) => {
        // Trigger file input for audio upload
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'audio/*'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            try {
              const { mediaUploadService } = await import('@/lib/media-upload-service')
              const result = await mediaUploadService.uploadMedia(file)
              editor
                .chain()
                .focus()
                .insertContent(`<audio controls src="${result.url}"></audio>`)
            } catch (error) {
              console.error('Audio upload failed:', error)
            }
          }
        }
        input.click()
      },
    },
    file: {
      check: () => true, // Files can always be inserted as links
      action: ({ editor }: { editor: Editor }) => {
        // Trigger file input for document upload
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.pdf,.doc,.docx,.txt,.rtf,.odt'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            try {
              const { mediaUploadService } = await import('@/lib/media-upload-service')
              const result = await mediaUploadService.uploadMedia(file)
              editor
                .chain()
                .focus()
                .insertContent(`<a href="${result.url}" download="${file.name}">${file.name}</a>`)
            } catch (error) {
              console.error('File upload failed:', error)
            }
          }
        }
        input.click()
      },
    },
  }
}

function organizeItemsByGroups(
  items: SuggestionItem[],
  showGroups: boolean
): SuggestionItem[] {
  if (!showGroups) {
    return items.map((item) => ({ ...item, group: "" }))
  }

  const groups: { [groupLabel: string]: SuggestionItem[] } = {}

  // Group items
  items.forEach((item) => {
    const groupLabel = item.group || ""
    if (!groups[groupLabel]) {
      groups[groupLabel] = []
    }
    groups[groupLabel].push(item)
  })

  // Flatten groups in order (this maintains the visual order for keyboard navigation)
  const organizedItems: SuggestionItem[] = []
  Object.entries(groups).forEach(([, groupItems]) => {
    organizedItems.push(...groupItems)
  })

  return organizedItems
}

/**
 * Custom hook for slash dropdown menu functionality
 */
export function useSlashDropdownMenu(config?: SlashMenuConfig) {
  const getSlashMenuItems = React.useCallback(
    (editor: Editor) => {
      const items: SuggestionItem[] = []

      const enabledItems =
        config?.enabledItems || (Object.keys(texts) as SlashMenuItemType[])
      const showGroups = config?.showGroups !== false

      const itemImplementations = getItemImplementations()

      enabledItems.forEach((itemType) => {
        const itemImpl = itemImplementations[itemType]
        const itemText = texts[itemType]

        if (itemImpl && itemText && itemImpl.check(editor)) {
          const item: SuggestionItem = {
            onSelect: ({ editor }) => itemImpl.action({ editor }),
            ...itemText,
          }

          if (config?.itemGroups?.[itemType]) {
            item.group = config.itemGroups[itemType]
          } else if (!showGroups) {
            item.group = ""
          }

          items.push(item)
        }
      })

      if (config?.customItems) {
        items.push(...config.customItems)
      }

      // Reorganize items by groups to ensure keyboard navigation works correctly
      return organizeItemsByGroups(items, showGroups)
    },
    [config]
  )

  return {
    getSlashMenuItems,
    config,
  }
}
