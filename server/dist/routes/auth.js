"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const authRoutes = async (server) => {
    const signupSchema = zod_1.z.object({
        username: zod_1.z.string().min(3),
        password: zod_1.z.string().min(6),
    });
    const loginSchema = zod_1.z.object({
        username: zod_1.z.string(),
        password: zod_1.z.string(),
    });
    server.post('/signup', async (request, reply) => {
        const { username, password } = signupSchema.parse(request.body);
        const existingUser = await server.prisma.user.findUnique({
            where: { username },
        });
        if (existingUser) {
            return reply.status(400).send({ error: 'Username already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await server.prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });
        return { token, user: { id: user.id, username: user.username } };
    });
    server.post('/login', async (request, reply) => {
        const { username, password } = loginSchema.parse(request.body);
        const user = await server.prisma.user.findUnique({
            where: { username },
        });
        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });
        return { token, user: { id: user.id, username: user.username } };
    });
};
exports.default = authRoutes;
