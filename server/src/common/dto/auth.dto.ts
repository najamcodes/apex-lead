import { z } from 'zod'

export const SignupSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }).transform(v => v.toLowerCase().trim()),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  name: z.string().min(1).optional(),
})

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }).transform(v => v.toLowerCase().trim()),
  password: z.string().min(1, { message: 'Password is required' }),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
})

export type SignupInput = z.infer<typeof SignupSchema>
export type LoginInput = z.infer<typeof LoginSchema>
