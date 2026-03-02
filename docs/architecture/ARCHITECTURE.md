# Architecture Documentation

## System Overview

The Colorbar Engraving Platform consists of two independent but interconnected systems:

### 1. Shopify Storefront (Customer-Facing)

The engraving experience is built directly into the Shopify theme using:

- **Liquid Templates** — Server-rendered product pages, cart drawer, and full cart page
- **Vanilla JavaScript** — Client-side engraving modal, live preview, form handling
- **Custom Font** — `emoticons.ttf` for consistent motif/symbol rendering
- **Shopify Line Item Properties** — Engraving data stored as order metadata

**Data Flow:**
```
Customer → Product Page → Engraving Modal → Add to Cart → Checkout → Shopify Order
                                                                          │
                                                                          ▼
                                                              Order with engraving
                                                              properties stored
```

### 2. Admin Dashboard (Operations-Facing)

A full-stack application for managing engraving orders:

**Frontend (React 19 + Tailwind CSS):**
- Single Page Application with client-side routing
- Auth state managed via React Context (memory-only, no localStorage)
- 30-second polling for real-time order updates
- 11 reusable components

**Backend (Node.js + Express):**
- RESTful API with 20+ endpoints
- Shopify REST API 2025-01 integration
- Token-based authentication with TOTP 2FA
- JSON file-based persistence with in-memory cache
- Email notifications via Office 365 SMTP

**Data Flow:**
```
Admin Dashboard ──► Express API ──► Shopify REST API
     │                  │
     │                  ├──► JSON File DB (users, sessions, 2FA)
     │                  │
     │                  └──► SMTP (email notifications)
     │
     └── React SPA (Auth Context, Order Polling, Status Updates)
```

## Authentication Architecture

```
Step 1: Login
  Client ──POST /auth/login──► Server
                                  │
                                  ├── Validate credentials (bcrypt)
                                  ├── Check rate limit (10/15min)
                                  └── Return pendingToken (5-min TTL)

Step 2: 2FA Verification
  Client ──POST /auth/verify-2fa──► Server
                                       │
                                       ├── Validate TOTP or backup code
                                       ├── Revoke pendingToken
                                       └── Return sessionToken (8-hour TTL)

Step 3: Authenticated Requests
  Client ──GET /api/orders──► Server
  (Authorization: Bearer <token>)
                                 │
                                 ├── Validate token exists & not expired
                                 ├── Extract user role
                                 └── Return data (role-filtered)
```

## Product Handler System

The `productHandlers.js` maps 135+ Shopify product handles to precise CSS configurations:

```javascript
{
  "sinful-matte-lipcolor-luxe-collection": {
    text_top: "58%",
    text_left: "50%",
    font_size: "11px"
  },
  // Dual-image product example:
  "browful-shaping-and-defining-kit": {
    text_top: "45%",
    text_left: "55%",
    font_size: "9px",
    image_2: true,              // Has second engraving surface
    text_top_2: "50%",
    text_left_2: "50%"
  }
}
```

This enables pixel-perfect engraving preview rendering across all product types.

## Deployment

- **Shopify Storefront:** Theme files deployed via Shopify Admin → Online Store → Edit Code
- **Admin Dashboard:** Deployed at `engraving.colorbarapps.com`
  - Frontend: Static build served via web server
  - Backend: Node.js process running on server
  - Both frontend and backend run concurrently
