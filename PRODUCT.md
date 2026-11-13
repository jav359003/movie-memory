# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, React, Tailwind CSS, Postgres, Prisma, Auth.js with Google OAuth, and the OpenAI Responses API. The stack is fixed by the take-home assignment.

## Users

The primary user is an individual movie fan who wants a quick, personal fact about a favorite film. The submission is also evaluated by technical reviewers who need to understand the implementation and its tradeoffs quickly.

## Product Purpose

Movie Memory lets a user sign in with Google, save a favorite movie, and generate a stored AI-written fact about it. Success means the complete first-time and returning-user journeys are obvious, secure, resilient, and easy for the candidate to explain.

## Positioning

The experience turns one durable preference - a favorite movie - into a lightweight, personal fact ritual while preserving a visible memory of generated facts.

## Operating Context

Users arrive signed out, authenticate with Google, complete onboarding once, and then return to a dashboard. On the dashboard they review their profile and favorite movie, edit that movie inline, and request or reuse a recent fact.

## Capabilities and Constraints

- Google authentication with first-time onboarding and protected dashboard routing.
- Server-validated favorite-movie storage associated with the authenticated user.
- Typed `GET /api/me`, `PUT /api/me/movie`, and `GET /api/fact` contracts.
- Optimistic inline movie editing with rollback on failure.
- A 30-second client-side fact cache, explicit refresh, and invalidation when the movie changes.
- Generated facts are persisted in Postgres.
- Users cannot access or modify another user's data; secrets remain server-only.
- Missing Google name or photo must have graceful fallbacks.
- The implementation favors correctness, clarity, and explainable tradeoffs over feature volume.

## Brand Commitments

The product name is Movie Memory. It should feel like a polished consumer movie product while remaining credible and legible to technical reviewers. The chosen direction is the familiar dark entertainment-dashboard convention, executed without irony or decorative novelty. Letterboxd is the quality reference for dense but readable movie metadata, dark neutral surfaces, restrained green action color, and keeping the film itself visually primary; Movie Memory must remain an original product rather than copying Letterboxd's branding or social features.

## Evidence on Hand

The take-home PDF is the sole product specification. There are no supplied brand assets, testimonials, customer claims, or production data; the interface must not invent them.

## Product Principles

- Make the authenticated journey immediately understandable.
- Let correctness and security remain visible in the product behavior.
- Keep every interaction reversible and every failure state humane.
- Use the movie and its generated fact as the focus, not decorative feature volume.
- Prefer a small architecture the candidate can confidently explain.

## Accessibility & Inclusion

Use semantic controls, visible focus states, keyboard-complete editing, sufficient contrast, reduced-motion support, and textual fallbacks for missing profile imagery.
