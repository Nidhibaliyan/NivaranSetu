#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const baseUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '');
const ingestToken = (process.env.LEGAL_RAG_INGEST_TOKEN || '').trim();
const corpusDir = path.resolve(process.argv[2] || 'legal-rag/corpus');

if (!baseUrl || !ingestToken) {
  console.error('Set APP_URL and LEGAL_RAG_INGEST_TOKEN in the environment.');
  process.exit(1);
}

let names;
try {
  names = (await readdir(corpusDir)).filter((name) => name.toLowerCase().endsWith('.json')).sort();
} catch (error) {
  console.error(`Cannot read corpus directory: ${corpusDir}`);
  process.exit(1);
}

if (names.length === 0) {
  console.error(`No .json source documents found in ${corpusDir}`);
  process.exit(1);
}

let succeeded = 0;
let failed = 0;

for (const name of names) {
  const filePath = path.join(corpusDir, name);
  try {
    const raw = await readFile(filePath, 'utf8');
    const document = JSON.parse(raw);
    const response = await fetch(`${baseUrl}/api/legal-rag/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-legal-rag-token': ingestToken,
      },
      body: JSON.stringify(document),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      failed += 1;
      console.error(`FAILED ${name}: ${result.message || result.error || response.statusText}`);
      continue;
    }
    succeeded += 1;
    console.log(`INGESTED ${name}: ${result.chunksCreated} chunks; SHA-256 ${result.sourceSha256}`);
  } catch (error) {
    failed += 1;
    console.error(`FAILED ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Legal RAG ingestion complete: ${succeeded} succeeded, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
