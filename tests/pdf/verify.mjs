// Reads only synthetic records from the fixed disposable database.
import { createServer } from 'vite';
import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import { execFileSync } from 'node:child_process';
const database = 'postgresql://postgres@127.0.0.1:56432/tqa_test';
const query = sql => JSON.parse(execFileSync('psql', [database, '-At', '-c', sql], { encoding: 'utf8' }));
const horse = query("select row_to_json(h) from horses h where name='Sale Pilot Horse'");
const sessions = query(`select coalesce(json_agg(s), '[]') from (select sessions.*, (select coalesce(json_agg(ratings), '[]') from ratings where session_id=sessions.id) ratings from sessions where horse_id='${horse.id}') s`);
const phases = query("select json_agg(phases) from phases");
const questions = query("select json_agg(questions) from questions");
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
 const { HorseReport } = await server.ssrLoadModule('/src/features/pdf/Report.tsx');
 await renderToFile(React.createElement(HorseReport, {horse, sessions, phases, questions, trifecta:null, generatedAt:'2026-10-02T12:00:00Z'}), 'docs/pilot/synthetic-sale-report.pdf');
 console.log('Rendered PDF from', sessions.length, 'persisted synthetic Sale ride(s)');
} finally { await server.close(); }
