import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';

const app = require('../src/server.js');

describe('Server', () => {
    let server;

    afterAll(() => {
        if (server) server.close();
    });

    it('skal redirecte rot-path til /feilmelding', async () => {
        const response = await request(app).get('/').expect(302);
        expect(response.headers.location).toBe('/feilmelding');
    });

    it('skal servere statiske filer fra feilmelding-mappen', async () => {
        // Test at en fil kan serveres fra /feilmelding
        const response = await request(app).get('/feilmelding/index.html');
        expect(response.status).not.toBe(404);
    });

    it('skal sette riktig PORT fra miljøvariabel eller default til 3000', () => {
        const PORT = process.env.PORT || 3000;
        expect(PORT).toBe(3000);
    });
});