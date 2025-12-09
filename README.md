# Local AI Code Review

A simple code review workflow for GitHub PRs using OPENAI using a single LLM Call. 

Works only on pull requests, where the authenticated user has not created a review yet.

Requires Github Token for authentication and OPENAI API Key.

Vibe coded with antigravity and gemini 3 pro.

## Prerequisites

*   Node.js v20+
*   NPM

## 1. Installation

Install dependencies for the monorepo:

```bash
npm install
```

Set `GITHUB_TOKEN` and `OPENAI_API_KEY` in .env (copy .env.example) 

## 2. Running Locally

```bash
npm start
```
