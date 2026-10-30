# Every target runs on the Node version in .nvmrc (via nvm when available).
SHELL := /bin/bash
NODE := source $$HOME/.nvm/nvm.sh >/dev/null 2>&1 && nvm use >/dev/null 2>&1; 

.PHONY: install dev check check-all test e2e build preview icons android screenshots

install:
	$(NODE) npm ci

dev:
	$(NODE) npm run dev

## Fast gate: lint, format, typecheck, style and contrast checks, markdown, knip, unit tests, build.
check:
	$(NODE) npm run check

## Full gate before declaring work done: check + end-to-end (offline, PWA) + npm audit.
check-all:
	$(NODE) npm run check:all

test:
	$(NODE) npm run test

e2e:
	$(NODE) npm run test:e2e

build:
	$(NODE) npm run build

preview: build
	$(NODE) npx vite preview

## Regenerate PWA icons from public/favicon.svg.
icons:
	$(NODE) npm run icons

## Build the Android bundle and sync it into android/ (then open android/ in Android Studio).
android:
	$(NODE) npm run build:android

## Retake the Today screenshots for the project site (writes to ../tidebook.github.io).
screenshots:
	$(NODE) npm run screenshots:site
