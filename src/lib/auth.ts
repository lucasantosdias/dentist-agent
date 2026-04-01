import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/server/db/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e senha sao obrigatorios");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          throw new Error("Email ou senha incorretos");
        }

        if (!user.active) {
          throw new Error("Conta desativada");
        }

        if (!user.emailVerifiedAt) {
          throw new Error("Verifique seu email primeiro");
        }

        if (!user.passwordHash) {
          throw new Error("Finalize seu cadastro pelo link de convite");
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValid) {
          throw new Error("Email ou senha incorretos");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          professionalId: user.professionalId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.professionalId = user.professionalId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.userId,
        email: token.email,
        name: token.name,
        role: token.role,
        professionalId: token.professionalId,
      };
      return session;
    },
  },
};
