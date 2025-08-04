export interface AdminMessage {
  id: string
  from_admin_id: string
  to_user_id: string
  subject: string
  message: string
  created_at: string
  updated_at: string
}

export interface AdminMessageResponse {
  id: string
  message_id: string
  response: string
  responded_at: string
}

export interface AdminMessageWithResponse extends AdminMessage {
  admin_message_responses: AdminMessageResponse[]
}

export interface Profile {
  user_id: string
  first_name: string | null
  last_name: string | null
  username: string | null
  role: string
}