# MIS Hub

An office inventory application for team members, IPv4 addresses, computers and laptops, printers, toner, access points, and email-account assignments. Built with Next.js 16, React 19, TypeScript, Prisma 6, and MySQL 8.4. phpMyAdmin is a separate database administration interface.

## Demo and live data

The demo view contains read-only sample data for exploring the interface. It is not your office inventory and does not persist changes. Configure a real database, bootstrap an administrator, and sign in to use persistent records. A successful frontend build alone does not verify database connectivity.

## Local database

Install Node.js 22 LTS and Docker Desktop with Docker Compose. Copy `.env.example` to `.env` and replace every placeholder with your own values. Never commit `.env`.

Set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` to different random passwords. `DATABASE_URL` must contain the same application password as `MYSQL_PASSWORD`, with URL encoding where needed. Set `APP_URL` to the application's exact origin. Generate `VAULT_ENCRYPTION_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Configure the initial administrator through `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, and optional `BOOTSTRAP_ADMIN_NAME`; no shared default login is provided.

```powershell
Copy-Item .env.example .env
npm.cmd install
docker compose up -d
npm.cmd run db:generate
npm.cmd run db:push
npm.cmd run db:bootstrap
npm.cmd run dev
```

Open the application at http://127.0.0.1:3000 (the exact origin configured in `APP_URL`). Open phpMyAdmin at http://localhost:8080 and sign in with `mis_app` and your configured `MYSQL_PASSWORD`. The MySQL database is `mis_hub`. Keep root credentials for database administration rather than application access.

The database ports bind to localhost only. Docker stores database files in the `mysql_data` volume; stopping containers preserves data. Removing that volume destroys the database. Changing initialization passwords in `.env` does not change passwords in an already initialized MySQL volume: rotate existing database users through MySQL instead.

Use `db:push` for initial local development. Before production, establish reviewed Prisma migrations, HTTPS, monitored backups, a tested restore procedure, and restricted database-administration access. Do not expose phpMyAdmin directly to the internet.

### Existing XAMPP database

If XAMPP already provides MySQL or MariaDB on port 3306, use that instance instead of starting the Docker database on the same port. In its phpMyAdmin, create a dedicated `mis_hub` database and an application user with privileges scoped to that database. Use the dedicated user's credentials in `DATABASE_URL`; do not connect the application with the XAMPP root account. Skip `docker compose up -d`, then run the Prisma and administrator bootstrap commands above. phpMyAdmin is then available through the existing XAMPP installation, rather than Docker port 8080. Validate schema compatibility and backups for the installed database version before deployment.

## This workspace's local installation

The initial local installation uses the existing XAMPP MariaDB server and a dedicated database named `mis_hub_dev_20260905`. It does not use Docker. The application's dedicated database account and random encryption key are in the git-ignored `.env`. The administrator email is `admin@mis.local`; its generated initial password is the `BOOTSTRAP_ADMIN_PASSWORD` value in `.env`. After signing in, use **My profile** to change that password. The bootstrap script does not overwrite existing accounts.

Under **Team members**, add a profile, then use **MIS login accounts** to create a linked login and select its role. Individual members can edit their name and phone, change their MIS password, view their assigned equipment and email accounts, and manage their own encrypted credentials. Only administrators can create or disable logins and change roles; IT staff maintain inventory. Viewers can read inventory and history.

To restart the validated production build locally, run `npm.cmd start`. For source changes use `npm.cmd run dev`. Stop the running application before regenerating Prisma on Windows, because the process may hold its database engine DLL open.

`prisma/initial-schema.sql` is an alternative initial schema import for an empty database through phpMyAdmin. Do not import it over an existing populated schema. Routine schema changes should go through Prisma rather than manual table edits.

Inventory uses category records with JSON detail fields, validated and linked by application transactions. Login, sessions, credentials, Microsoft 365 batches and assignments, and audit logs use separate tables. This version includes inventory CRUD, toner replacements, linked email records, Microsoft 365 installation tracking, self-service profiles, and account permissions. Automated discovery, Microsoft 365 provisioning, provider mailbox integration, uploads, CSV import/export, and advanced maintenance scheduling are not included. Before wider deployment, review access and recovery procedures and configure shared rate limiting if running multiple application instances.

## Microsoft 365 batches

Open **Microsoft 365** to track shared installation accounts as Batch 1, Batch 2, and onward. Each batch has five active installation slots. An administrator or IT staff member can add a batch, assign a slot to a team member and device, release an installation while preserving its history, and update the shared account details. A slot can reference a registered computer/laptop or an external device description. The same registered device cannot hold two active Microsoft 365 assignments.

Managers can view batch capacity and assignments without access to the shared password. Team members see only the assignments linked to their own profile. Administrators and IT staff must enter their own MIS login password before revealing or replacing a batch password. Microsoft 365 passwords are encrypted with `VAULT_ENCRYPTION_KEY` and excluded from list responses and audit details.

The `/api/microsoft-365` endpoint lists and creates batches, while `/api/microsoft-365/[id]` reads and updates one batch. Nested assignment endpoints allocate and release slots; `/reveal` reveals a shared password after reauthentication and `/password` replaces it. These APIs manage MIS inventory only: they do not create Microsoft accounts, activate Office, or communicate with Microsoft 365.

## Network scope

The main IP grid uses `172.16.11.0/24`: assignable host addresses end in `.1` through `.254`. `.0` and `.255` are reserved network/broadcast addresses; `.256` is invalid. IT staff can manually add valid IPv4 addresses outside this subnet, such as `172.16.10.50`, through **Add IP assignment**. A device's IP, including an access point's management IP, appears automatically in the manual address list when outside the main subnet; do not create a second IP assignment for the same address. The main grid's counts cover only its 254 host addresses. Confirm each VLAN's subnet, gateway, and DHCP reservations before assigning equipment. Inventory records do not configure devices or perform network discovery.

## Password recovery and remembered sign-in

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env` to enable emailed password reset codes. Use an SMTP service with a verified sender. Codes go to the MIS login email, expire after 10 minutes, and are never stored in plaintext. SMTP delivery must work before users can recover passwords themselves.

On an existing database, stop the app, apply `prisma/password-recovery-additive.sql` to the configured database, run `npm run db:generate`, then restart. For a new database, `prisma/initial-schema.sql` includes the new tables and fields. Do not import the full initial schema over existing data. Sign-in lasts 8 hours normally or 30 days when **Remember me** is selected. Administrators can set a temporary password under **Team members → MIS login accounts**; this signs out the person and requires them to change it at next sign-in. Share temporary passwords through a separate approved channel.

## Saved credentials

MIS login passwords are hashed. Recoverable account passwords use authenticated server-side encryption; the encryption key must be stored outside the database and source control. Keep a separate secure backup of that key alongside your database recovery procedure. Losing the key makes encrypted credentials unrecoverable; changing it requires a planned re-encryption migration.

Server-side encryption does not prevent a person with application-server and key access from decrypting credentials. Passwords must never be included in logs, routine inventory exports, or support screenshots. Email account passwords are stored separately from shared directory records. Only IT and administrators can save, remove, or reveal them, and revealing requires their MIS login password. The password is hidden after 60 seconds or when the tab is left. Email management does not send mail, provision provider accounts, or reset external email passwords.

For an existing database, apply `prisma/email-password-additive.sql` with `npx prisma db execute --file prisma/email-password-additive.sql --schema prisma/schema.prisma`, run `npm.cmd run db:generate`, then restart the app. New databases receive the table from `prisma/initial-schema.sql`.

## Validation

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Automated utility tests do not replace testing real database persistence and permissions with distinct administrator and team-member accounts.

With the development server running and bootstrap credentials configured in `.env`, run the opt-in integration test:

```powershell
$env:MIS_INTEGRATION_URL='http://127.0.0.1:3000'
npm.cmd test
Remove-Item Env:MIS_INTEGRATION_URL
```

This creates temporary accounts and records to verify member isolation, credential ownership and reauthentication, encrypted storage, duplicate IP rejection, toner transaction rollback, Microsoft 365 batch capacity, device assignment rules, password permissions, and release history. It removes only its created database IDs afterward; corresponding audit events remain. Run against a development database. Without `MIS_INTEGRATION_URL`, integration tests are skipped.

## Dealership access

MIS Hub shares its modules across dealerships while keeping inventory, Microsoft 365 batches, personal credentials, and dealership history separate. The header shows the selected dealership; accounts assigned to both can switch. Selection is saved per browser tab. Roles still determine editing permissions, and personal credentials remain visible only to their owner.

Under **Team members → MIS login accounts**, assign dealerships when creating a login or edit the dealership checkboxes for an existing login. Set User 1 to IT with TNE, User 2 to IT with TNESC, and the administrator to both. These labels are examples: no new accounts or passwords are created automatically. Administrators can rename dealerships in this screen.

For an existing installation, stop the application before running **npm run db:dealerships**, then run **npm run db:generate**, build, and restart. The migration saves a local database snapshot in **.backups/** before any schema changes; it includes table definitions and row data and must be kept private. Existing records and related history move to TNE; existing non-admin logins receive TNE and administrators receive both. TNESC starts empty. Re-running the migration preserves names and membership edits. MySQL DDL is not transactional, so a failed migration can be resumed by running it again. For rollback, stop the application and have the database operator restore the snapshot's original table definitions and rows in dependency order, using the previous application version and the same vault encryption key. Do not apply the initial-schema file to an existing installation.

For a new database, import **prisma/initial-schema.sql**, run **npm run db:dealerships**, then bootstrap the administrator. The migration creates the dealerships even when there are no users; bootstrap assigns a new administrator to all configured dealerships.

Dealership APIs require the **X-Dealership-Id** header. Inventory, vault, Microsoft 365, audit, and dealership profile edits validate current membership on every request. Authentication and administrator account management remain global. User create/update requests accept **dealershipIds**, a nonempty array of valid dealership IDs. Authentication responses include **user.dealerships** with IDs and names; the administrator user-list response also includes all dealerships and each account's memberships. **PATCH /api/dealerships/[id]** accepts a name and requires administrator access.

Run **npm test** for utility checks. Set **MIS_INTEGRATION_URL** to a running local development/test instance to also test real database boundaries, credentials, linked records, existing-session revocation, and existing role restrictions. Integration tests create temporary records and clean up their own IDs.

Team members and Email accounts are shared directories: every signed-in user can browse both dealerships, with a dealership tag on each record. GET /api/directory returns only these two record categories and their dealership names; it requires authentication and has no write methods. Equipment, Microsoft 365, credentials, history and inventory writes remain subject to dealership membership and existing role restrictions. To manage a directory record from another assigned dealership, open its dealership workspace from the record details. New directory records are saved in the currently selected dealership.

### SAP Users

SAP Users is a combined directory for both dealerships. Every signed-in user can view it; IT and administrators can add, edit, and delete SAP accounts for either dealer. Each account has a globally unique SAP ID and may link to one team member from either dealership. A team member can have only one SAP account, and the link must be removed before deleting that team member. Validity dates are optional. SAP passwords are not stored in this module.

For an existing database, apply only the additive SAP table script with `npx prisma db execute --file prisma/sap-users-additive.sql --schema prisma/schema.prisma`, then run `npm run db:generate` and restart the app. The script does not modify existing records and can be re-run. Avoid applying the full initial schema to a populated database. For a fresh database, `prisma/initial-schema.sql` already includes the SAP table.

## MCP integration

See [MCP setup and tools](mcp/README.md) for connecting an MCP-compatible client to MIS-Hub. Read access is enabled by default; inventory mutations require explicit configuration and existing IT/admin permissions.
