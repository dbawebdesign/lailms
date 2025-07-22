import React, { ForwardedRef } from 'react';
import { NotionEditor, NotionEditorProps } from "@/components/tiptap-templates/notion-like/notion-like-editor"

export const NotionEditorWrapper = React.forwardRef<any, NotionEditorProps>((props, ref) => {
  return <NotionEditor {...props} editorRef={ref as ForwardedRef<any>} />;
});
NotionEditorWrapper.displayName = "NotionEditorWrapper"; 