import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { Resend } from 'resend';

const dbUrl = process.env.DEV_MODE? process.env.DB_URL_DEV : process.env.DB_URL_PROD; 

const resend = new Resend(process.env.RESEND_API_KEY);

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
        sendResetPassword: ({user, url}) => {
            void resend.emails.send({
                from: 'RavageLabs <noreply@ravagelabs.com>',
                to: user.email,
                subject: 'Verify your Email Address',
                html: `Click <a href="${url}">here</a> to verify your email.`
            })
        }
    },
    emailVerification: {
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

