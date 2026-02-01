import { getConfig } from "../utils/config"
import { verifyPassword } from "../utils/auth"

export default defineEventHandler(async (event) => {
    const config = getConfig()
    
    if (!config || !config.dashboard.enable) {
        return {
            success: false,
            message: 'Dashboard is not enabled'
        }
    }

    try {
        const body = await readBody(event)
        const { password } = body

        if (!password) {
            return {
                success: false,
                message: 'Password is required'
            }
        }

        // 验证密码
        const isValid = verifyPassword(password, config.dashboard.password)

        if (isValid) {
            return {
                success: true,
                message: 'Login successful'
            }
        } else {
            return {
                success: false,
                message: 'Invalid password'
            }
        }
    } catch (error) {
        console.error('Login error:', error)
        return {
            success: false,
            message: 'Login failed'
        }
    }
})