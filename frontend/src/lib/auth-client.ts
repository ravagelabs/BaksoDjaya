import { createAuthClient } from "better-auth/vue"
export const authClient = createAuthClient({
    baseURL: "https://pos.ravagelabs.id" // The base URL of your auth server
})