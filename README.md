# VoltSpot – EV Parking & Charging Reservation System

A full-stack web application designed to streamline electric vehicle (EV) charging discovery, slot reservations, session tracking, and station-side management.

---

## Overview

**VoltSpot** bridges the gap between EV drivers and charging bay operators. The platform provides real-time bay availability, turnkey navigation via Google Maps, automated payment workflows with downloadable PDF receipts, and a dedicated portal for station operators to manage infrastructure and track charging sessions.

---

## Features

### For Drivers
* **Station Finder & Routing:** Search charging locations and launch direct navigation via Google Maps integration (`find.html`, `navigate.html`).
* **Slot Reservation & Booking:** Reserve bay slots in advance with time-window validation (`reserve.html`).
* **Automated Billing & Receipts:** Complete payments and generate downloadable invoice receipts formatted with `PDFKit` (`pay.html`, `receipts.js`).
* **Bilingual UI (i18n):** Client-side dynamic switching between English and Bangla (`i18n.js`).
* **Session History:** Track previous reservations, charges, and payment records (`history.html`).

### For Station Operators
* **Operator Portal:** Dedicated authentication and onboarding workflow (`station-register.html`, `station-login.html`).
* **Live Dashboard:** Monitor bay utilization, active charging sessions, and revenue metrics (`station-dashboard.html`).

---

## Tech Stack

* **Backend:** Node.js, Express.js
* **Database & Scripts:** SQL Database (`db.js`), mock station seeding script (`seed-stations.js`)
* **Utilities & Security:** Custom password hashing (`password.js`), automated PDF receipt generator (`pdf.js`)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Modular ES6+)
* **APIs & Services:** Google Maps JavaScript API, custom RESTful endpoints (`/api/auth`, `/api/stations`, `/api/sessions`, `/api/receipts`, `/api/history`)

---

## Project Architecture

```text
voltspot/
├── server/
│   ├── routes/
│   │   ├── auth.js            # User & station owner authentication
│   │   ├── history.js         # User booking & transaction history
│   │   ├── receipts.js        # Receipt lookup & PDF downloads
│   │   ├── sessions.js        # Live charging session state machine
│   │   └── stations.js        # Station catalog and availability queries
│   ├── scripts/
│   │   └── seed-stations.js   # Database station seeding utility
│   ├── utils/
│   │   ├── password.js        # Password hashing & verification
│   │   └── pdf.js             # Server-side PDF invoice generation
│   ├── db.js                  # Database connection & query handlers
│   └── server.js              # Express app initialization & middleware
├── public/
│   ├── js/
│   │   ├── api.js             # Client API wrapper
│   │   ├── gmaps-config.js    # Google Maps API initialization
│   │   └── i18n.js            # Bilingual localization dictionary
│   ├── find.html              # Station discovery & search interface
│   ├── reserve.html           # Slot reservation & bay booking
│   ├── navigate.html          # Turn-by-turn map navigation
│   ├── pay.html               # Payment confirmation
│   ├── history.html           # Charging history log
│   ├── station-dashboard.html # Station manager analytics & controls
│   ├── station-login.html     # Operator login
│   ├── station-register.html  # Operator registration
│   ├── login.html             # Driver login
│   └── settings.html          # User account settings
└── package.json
