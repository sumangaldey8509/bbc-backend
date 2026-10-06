# BBC - Bengal Business Council - Backend API

A clean, modular, and simple Node.js + Express backend with MongoDB (Mongoose), Nodemailer, and Socket.io for Bengal Business Council by Credovation Solutions Pvt Ltd.

## Project Structure

```
bbc-backend/
├── .env                  # Environment configuration
├── .env.example          # Environment template
├── .gitignore            # Git ignored files
├── package.json          # Project dependencies & scripts
└── src/
    ├── config/           # Database and application configuration
    │   ├── db.js
    │   └── index.js
    ├── controllers/      # Request and response handlers
    │   └── user.controller.js
    ├── helpers/          # Response & utility helpers
    │   └── response.helper.js
    ├── lib/              # Third-party library initializations (Socket.io, etc.)
    │   └── socket.js
    ├── models/           # Mongoose schemas and models
    │   └── user.model.js
    ├── routes/           # Express route definitions
    │   ├── index.js
    │   └── user.routes.js
    ├── services/         # Business logic, DB queries, and email services
    │   ├── email.service.js
    │   └── user.service.js
    ├── utils/            # Logging and general utility functions
    │   └── logger.js
    ├── app.js            # Express app configuration & middlewares
    └── server.js         # HTTP server startup & Socket.io initialization
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Check your `.env` file and make sure `MONGO_URI` and other variables are set.

### 3. Seed Database (Roles & Initial Users)
```bash
npm run seed
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Production Server
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /api/health`

### Authentication & OTP (`/api/auth`)
_Authentication only — user creation lives under `/api/users`._
- `POST /api/auth/login` - Login with email or phone number + password (returns JWT & full user profile). If the credentials are correct but the account is unverified, responds `403 { code: "EMAIL_NOT_VERIFIED", email }` and sends a fresh `email_verification` OTP so the client can route the member into verification.
- `POST /api/auth/verify-otp` - **Checks** a 6-digit OTP without consuming it, so the client can gate a following step. Body: `{ email, otp, type? }` (`email_verification` default | `forgot_password`). The code is spent later by `/complete-verification` or `/reset-password` respectively.
- `POST /api/auth/complete-verification` - Finish first-time email verification. Body: `{ email, otp, newPassword? }`. Consumes the `email_verification` OTP, sets `isEmailVerified: true`, and — if `newPassword` is provided (min 6) — updates the password and emails a confirmation. Omit `newPassword` to keep the administrator-assigned one.
- `POST /api/auth/resend-otp` - Resend a 6-digit OTP. Body: `{ email, type? }` (`email_verification` | `forgot_password`).
- `POST /api/auth/forgot-password` - Send a password-reset OTP. Body: `{ email }`
- `POST /api/auth/reset-password` - Reset password. Body: `{ email, otp, newPassword }`. Consumes the reset OTP and emails a "password changed" confirmation (`src/utils/emailTemplates.js`).
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get logged-in user profile (Requires `Authorization: Bearer <token>`)

### Users (`/api/users`)
- `POST /api/users` - Create (register) a user. Body: `{ firstName, lastName, email, password, countryCode?, phoneNumber?, roles?: [roleId] }`. Hashes the password and sends a 6-digit email verification OTP.
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Roles (`/api/roles`)
- `POST /api/roles` - Create role. Body: `{ name, description?, permissions?: string[], isActive? }`
- `GET /api/roles` - Get all roles, each with a live `memberCount`
- `GET /api/roles/:id` - Get role by ID
- `PUT /api/roles/:id` - Update role (partial: `name`, `description`, `permissions`, `isActive`)
- `DELETE /api/roles/:id` - Delete role (blocked with 409 while any member still holds it)

### Profile Details (`/api/profile`) — all routes require `Authorization: Bearer <token>`
Members must complete and get their `profile_details` **approved** before they can use the app.
- `GET /api/profile/me` - Caller's profile + `{ completion: { percent, filled, total, missing, missingRequired, canSubmit }, status, gate }`. `percent`/`missing` include the optional photo & cover; `missingRequired`/`canSubmit` cover only the fields that block submission. `gate` is `"ok"` only when `status === "approved"`. `yearJoined` in the profile is **derived** from the year the member's User account was created — it is not stored and any client-sent value is ignored.
- `PUT /api/profile/me` - Create / update the caller's profile (draft save). Editing a `rejected` profile moves it back to `draft`. Setting `avatar` / `coverImage` stamps `avatarUpdatedAt` / `coverImageUpdatedAt`. `turnover` is a **number** in `turnoverUnit` (`"k"` thousand · `"l"` lakh · `"cr"` crore, default `"cr"`).
- `DELETE /api/profile/me/photo` - Body `{ kind: "avatar" | "cover" }`. Clears the field in Mongo **and** deletes the asset from Cloudinary.
- `POST /api/profile/me/submit` - Submit for review (all **required** fields must be filled — profile photo & cover image are optional). Sets `status: "submitted"` and emails all admins.
- `GET /api/profile/reviews` *(admin)* - Review queue. Query `?status=submitted,under_review,approved,rejected`.
- `GET /api/profile/:userId` *(admin)* - One member's full profile + completion.
- `PATCH /api/profile/:userId/review` *(admin)* - Body `{ status: "approved" | "rejected" | "under_review", note? }` (note required to reject). Emails the member.

Profile status values: `draft` → `submitted` → `under_review` → `approved` | `rejected`.

### Industries (`/api/industries`) — requires `Authorization: Bearer <token>`
A searchable catalogue backing the profile "Industry" autocomplete.
- `GET /api/industries?q=<term>&limit=20` - Autocomplete search. Ranked by usage, then curated, then name. Empty `q` returns the most-used entries. Returns `[{ id, name }]`.
- `POST /api/industries` - Body `{ name }`. Find-or-create (case-insensitive) — used when a member types an industry that isn't listed. Returns `{ id, name, created }`.
- Saving a profile also reconciles `usageCount` and auto-adds any unseen industry names.

### States & Cities (`/api/states`) — requires `Authorization: Bearer <token>`
All Indian states/UTs, each with its own city catalogue. The profile "Location" is a **State** field then a **City** field (city filtered by the chosen state).
- `GET /api/states?q=<term>` - Searchable state/UT list. Returns `[{ id, name, code }]`.
- `GET /api/states/:stateId/cities?q=<term>` - Cities in that state. Ranked by usage, then curated, then name. Returns `[{ id, name }]`.
- `POST /api/states/:stateId/cities` - Body `{ name }`. Find-or-create a city within the state (title-cased). Returns `{ id, name, stateName, created }`.
- Profiles store `state` and `city` as strings; saving reconciles the city catalogue's `usageCount`.

### Uploads (`/api/uploads`) — requires `Authorization: Bearer <token>`
- `POST /api/uploads` - `multipart/form-data`, field `file`, optional `kind` (`avatar` | `cover` | `document`). Streams to Cloudinary and returns `{ url, publicId, resourceType, bytes, width, height, format }`. Returns `503` until `CLOUDINARY_*` env vars are set. Max 10 MB.
  - All of a member's files go into one folder: `<CLOUDINARY_FOLDER>/users/<firstname_lastname>` (e.g. `bbc/users/sumangal_dey`).
  - `avatar` / `cover` use fixed public ids (`avatar`, `cover`) so re-uploading replaces the old one; `document` keeps every version.
  - Images are compressed, dimension-capped, and **normalised to JPG** (`.../avatar.jpg`) so `<Image>` loads them on every platform; the member crops client-side before upload.

## Using Socket.io
When you're ready to use Socket.io in any controller or service:
```javascript
const { getIO } = require('../lib/socket');

// Inside any handler or function:
const io = getIO();
io.emit('event_name', { message: 'Hello clients!' });
```
