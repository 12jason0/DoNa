import { isDemoMode } from "@/lib/demo";

const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

async function call(method: string, body: object) {
    if (isDemoMode()) return; // 체험 데모: 텔레그램 안 보냄
    await fetch(api(method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).catch((e) => console.error(`텔레그램 ${method} 실패:`, e));
}

/** buttons: 줄 단위 버튼 배열 [[{text, data}]] → inline keyboard */
export function sendTelegram(chatId: number, text: string, buttons?: { text: string; data: string }[][]) {
    return call("sendMessage", {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
    });
}

/** 버튼 누른 뒤: 로딩 표시 끄고, 같은 버튼 두 번 못 누르게 버튼 제거 */
export async function closeTelegramButtons(callbackQueryId: string, chatId: number, messageId: number) {
    await Promise.all([
        call("answerCallbackQuery", { callback_query_id: callbackQueryId }),
        call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    ]);
}
