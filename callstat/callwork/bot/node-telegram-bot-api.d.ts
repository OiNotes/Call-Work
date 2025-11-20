declare module 'node-telegram-bot-api' {
  export = TelegramBot

  class TelegramBot {
    constructor(token: string, options?: TelegramBot.ConstructorOptions)
    
    on(event: 'message', listener: (msg: TelegramBot.Message) => void): void
    on(event: 'callback_query', listener: (query: TelegramBot.CallbackQuery) => void): void
    on(event: 'polling_error', listener: (error: Error) => void): void
    
    onText(regexp: RegExp, listener: (msg: TelegramBot.Message, match: RegExpExecArray | null) => void): void
    
    sendMessage(chatId: number | string, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message>
    answerCallbackQuery(callbackQueryId: string, options?: TelegramBot.AnswerCallbackQueryOptions): Promise<boolean>
    deleteMessage(chatId: number | string, messageId: number | string): Promise<boolean>
    
    stopPolling(): Promise<void>
  }

  namespace TelegramBot {
    interface ConstructorOptions {
      polling?: boolean | PollingOptions
      webHook?: boolean | WebHookOptions
    }

    interface PollingOptions {
      interval?: number
      autoStart?: boolean
      params?: GetUpdatesOptions
    }

    interface WebHookOptions {
      host?: string
      port?: number
      key?: string
      cert?: string
    }

    interface GetUpdatesOptions {
      offset?: number
      limit?: number
      timeout?: number
      allowed_updates?: string[]
    }

    interface SendMessageOptions {
      parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML'
      disable_web_page_preview?: boolean
      disable_notification?: boolean
      reply_to_message_id?: number
      reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
    }

    interface AnswerCallbackQueryOptions {
      text?: string
      show_alert?: boolean
      url?: string
      cache_time?: number
    }

    interface InlineKeyboardMarkup {
      inline_keyboard: InlineKeyboardButton[][]
    }

    interface InlineKeyboardButton {
      text: string
      callback_data?: string
      url?: string
    }

    interface ReplyKeyboardMarkup {
      keyboard: KeyboardButton[][]
      resize_keyboard?: boolean
      one_time_keyboard?: boolean
      selective?: boolean
    }

    interface KeyboardButton {
      text: string
      request_contact?: boolean
      request_location?: boolean
    }

    interface ReplyKeyboardRemove {
      remove_keyboard: true
      selective?: boolean
    }

    interface ForceReply {
      force_reply: true
      selective?: boolean
    }

    interface Message {
      message_id: number
      from?: User
      date: number
      chat: Chat
      text?: string
    }

    interface CallbackQuery {
      id: string
      from: User
      message?: Message
      data?: string
    }

    interface User {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
    }

    interface Chat {
      id: number
      type: 'private' | 'group' | 'supergroup' | 'channel'
      title?: string
      username?: string
      first_name?: string
      last_name?: string
    }
  }
}
