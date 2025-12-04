import { FastifyInstance } from 'fastify';
import { bufferEvent, AnalyticsEvent } from '../services/eventBuffer';

export default async function eventRoutes(fastify: FastifyInstance) {
    fastify.post('/batch', async (req, reply) => {
        const events = req.body as AnalyticsEvent[];

        if (!Array.isArray(events)) {
            return reply.status(400).send({ error: 'Body must be an array of events' });
        }

        // Validate and buffer
        for (const event of events) {
            if (event.userId && event.type && event.timestamp) {
                await bufferEvent(event);
            }
        }

        return { status: 'ok', buffered: events.length };
    });
}
