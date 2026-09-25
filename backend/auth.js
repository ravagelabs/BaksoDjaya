import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { Resend } from 'resend';

const dbUrl = process.env.DEV_MODE? process.env.DB_URL_DEV : process.env.DB_URL_PROD; 
const url = process.env.DEV_MODE? process.env.DEV_URL : process.env.PROD_URL;

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
    trustedOrigins: [
        url
    ],
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
        requireEmailVerification: true,
        sendResetPassword: ({user, url}) => {
            void resend.emails.send({
                from: 'RavageLabs <noreply@ravagelabs.com>',
                to: user.email,
                subject: 'Reset your password',
                html: `Click <a href="${url}">here</a> to reset your password.`
            })
        }
    },
    emailVerification: {
        sendOnSignUp: true, 
        sendVerificationEmail: ({user, url}) => {
            void resend.emails.send({
                from: 'RavageLabs <noreply@ravagelabs.com>',
                to: user.email,
                subject: 'Verify your Email Address',
                html: `Click <a href="${url}">here</a> to verify your email.`
            })
        }
    }
});

