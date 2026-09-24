import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

const dbUrl = process.env.DEV_MODE? process.env.DB_URL_DEV : process.env.DB_URL_PROD; 

export const auth = betterAuth({
    database: new Pool({
        connectionString: dbUrl
    }),
    user: {
        additionalFields: {
            role: {
                type: ["user", "customer", "employee", "owner"],
                required: false,
                defaultValue: "user",
                input: false
            }
        }
    },
    emailAndPassword: {
        enabled: true, 
    }
});