import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectDB();
        const user = await User.findOne({ email: credentials.email }).lean() as any;
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user._id.toString(), email: user.email, name: user.name, plan: user.plan };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) { token.id = user.id; token.plan = user.plan; }
      return token;
    },
    async session({ session, token }: any) {
      if (token) { session.user.id = token.id; session.user.plan = token.plan; }
      return session;
    },
  },
  pages: { signIn: '/auth/login' },
  secret: process.env.NEXTAUTH_SECRET,
};