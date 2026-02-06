import { MiddleContent } from "../../converter";
import { DEEPSEEK_MODELS } from "./const";

export function DeepSeekHandler(body: MiddleContent) {

}


export function RegisterDeepSeekAccounts() {
  console.log('🔍 Registering DeepSeek accounts to selector...')
  const accounts = getAccounts('deepseek') as string[]
  registerAccount(accounts, DEEPSEEK_MODELS, 'deepseek')
  console.log(`✅ Registered ${accounts.length} DeepSeek accounts to selector.`)
}
