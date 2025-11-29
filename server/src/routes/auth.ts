import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const authRoutes: FastifyPluginAsync = async (server) => {
    const signupSchema = z.object({
        email: z.string().email(),
        username: z.string().min(3),
        password: z.string().min(8).regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[0-9]/, "Password must contain at least one number"),
    });

    const loginSchema = z.object({
        email: z.string().email(),
        password: z.string(),
    });

    server.post('/signup', async (request, reply) => {
        const { email, username, password } = signupSchema.parse(request.body);

        const existingUser = await server.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            },
        });

        if (existingUser) {
            return reply.status(400).send({ error: 'Email or Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await server.prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
            },
        });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        });

        return { token, user: { id: user.id, username: user.username, email: user.email } };
    });

    server.post('/login', async (request, reply) => {
        const { email, password } = loginSchema.parse(request.body);

        const user = await server.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        });

        return { token, user: { id: user.id, username: user.username, email: user.email } };
    });
};

export default authRoutes;
