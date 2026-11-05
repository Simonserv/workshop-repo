# Requirements Document

## Introduction

This document specifies the requirements for a fictional IT consulting and software development company website ("the Platform"), built as a three-tier web application and used as the teaching artifact for a three-part Computer Science workshop. The Platform lets visitors browse service and product listings, submit per-service inquiries (demo/quote/inquire) without an account, optionally become members, and make donations. Behind the public site, an application layer authenticates users, enforces role-based access control (RBAC), manages inquiries, and performs manual verification of membership and donation receipts. A data layer persists users, listings, inquiries, receipts, and donations, and stores uploaded receipt files in private storage.

These requirements are derived from the approved design document and are written to support the correctness properties already defined in that design.

## Glossary

- **Platform**: The complete three-tier IT consulting website, comprising the presentation, application, and data layers.
- **Listings_Service**: The application-layer component that manages and serves service/product listings.
- **Inquiry_Service**: The application-layer component that accepts and manages service inquiries.
- **Membership_Service**: The application-layer component that handles registration, membership-receipt upload, and membership verification.
- **Donation_Service**: The application-layer component that accepts donations and manages donation verification.
- **Auth_Service**: The application-layer component (backed by Supabase Auth) that authenticates requests and enforces RBAC.
- **File_Storage**: The private object storage that holds receipt files, accessible only through backend-issued signed URLs.
- **Visitor**: Any unauthenticated person using the public site.
- **User**: An authenticated account holder with the role USER. A User is either a Member or a Non-Member.
- **Member**: A User whose `membership_status` is MEMBER.
- **Non-Member**: A User whose `membership_status` is NON_MEMBER.
- **Staff**: An authenticated account holder with the role STAFF, able to manage inquiries and verify receipts and donations.
- **Admin**: An authenticated account holder with the role ADMIN, able to perform all Staff actions plus manage listings and users.
- **Listing**: A service or product offering, with a category and an inquiry type (DEMO, QUOTE, or INQUIRE).
- **Inquiry**: A request submitted by a Visitor against a specific Listing.
- **Membership_Receipt**: An uploaded proof-of-payment file submitted by a User to request Member status.
- **Donation**: A record of a monetary gift, with an attached receipt file, optionally anonymous.
- **Signed_URL**: A short-lived, backend-issued URL granting temporary read access to a privately stored receipt file.
- **RBAC**: Role-Based Access Control, enforced by the application layer using the role stored in the database.
- **Privileged_Endpoint**: Any API endpoint restricted to Staff and/or Admin roles.

## Requirements

### Requirement 1: Public Service Listings and Inquiries

**User Story:** As a Visitor, I want to browse service and product listings and submit an inquiry for a specific service without creating an account, so that I can request a demo, quote, or general information quickly.

#### Acceptance Criteria

1. WHEN a Visitor requests the public listings, THE Listings_Service SHALL return only Listings whose `is_active` value is true.
2. WHEN a Visitor submits an Inquiry, THE Inquiry_Service SHALL persist the Inquiry only if its `listing_id` references a Listing that is active at submission time.
3. WHEN a Visitor submits an Inquiry that references an inactive or non-existent Listing, THE Inquiry_Service SHALL reject the Inquiry with a 400 Bad Request response.
4. WHEN a Visitor submits an Inquiry with a non-empty customer name, a well-formed customer email, and non-empty project details, THE Inquiry_Service SHALL create the Inquiry with status NEW and return a 201 response containing the inquiry identifier.
5. IF a submitted Inquiry is missing a customer name, project details, or a well-formed customer email, THEN THE Inquiry_Service SHALL reject the Inquiry with a 400 Bad Request response and field-level error messages.
6. WHEN a Visitor submits an Inquiry, THE Inquiry_Service SHALL sanitize the customer name and project details before persisting them.
7. THE Inquiry_Service SHALL accept Inquiry submissions without requiring authentication.
8. WHERE a Listing specifies an inquiry type of DEMO, QUOTE, or INQUIRE, THE Platform SHALL present the inquiry form that corresponds to that inquiry type.

### Requirement 2: Membership Registration and Verification

**User Story:** As a User, I want to register, upload a GCash payment receipt, and be verified as a Member, so that I can gain Member status through manual review.

#### Acceptance Criteria

1. WHEN a Visitor registers with a well-formed, not-already-registered email and a password meeting the minimum strength, THE Membership_Service SHALL create a User with role USER and `membership_status` NON_MEMBER.
2. IF a Visitor attempts to register with an email that is already registered or not well-formed, THEN THE Membership_Service SHALL reject the registration with an error response.
3. WHEN a User requests membership payment information, THE Membership_Service SHALL return the GCash QR payment information.
4. WHEN an authenticated User submits a Membership_Receipt file, THE Membership_Service SHALL store the file in File_Storage privately and persist a Membership_Receipt with status PENDING.
5. WHEN a Staff or Admin approves a PENDING Membership_Receipt, THE Membership_Service SHALL set the receipt status to APPROVED and set the owning User's `membership_status` to MEMBER within a single atomic transaction.
6. IF a Staff or Admin attempts to approve or reject a Membership_Receipt whose status is not PENDING, THEN THE Membership_Service SHALL reject the action with a 409 Conflict response.
7. THE Membership_Service SHALL set `membership_status` to MEMBER only as a result of approving a Membership_Receipt.
8. WHEN a Staff or Admin rejects a PENDING Membership_Receipt, THE Membership_Service SHALL set the receipt status to REJECTED and record the reviewing user and the rejection reason.
9. WHEN a User requests their own membership status, THE Membership_Service SHALL return that User's current `membership_status`.
10. THE Membership_Service SHALL store User passwords only in hashed form and SHALL NOT store passwords in plaintext.

### Requirement 3: Donations

**User Story:** As a Donor, I want to make a donation with a GCash payment receipt, optionally anonymously and without an account, so that I can support the organization and have the gift verified.

#### Acceptance Criteria

1. THE Donation_Service SHALL accept Donation submissions without requiring authentication.
2. WHEN a Donor submits a Donation, THE Donation_Service SHALL persist the Donation only if the `amount` value is greater than zero.
3. IF a Donor submits a Donation with an `amount` value less than or equal to zero, THEN THE Donation_Service SHALL reject the Donation with a 400 Bad Request response.
4. WHEN a Donor submits a Donation with a valid amount and a receipt file, THE Donation_Service SHALL store the receipt file in File_Storage privately and persist the Donation with status PENDING.
5. WHERE a Donation omits both donor name and donor email, THE Donation_Service SHALL persist the Donation with null donor fields as an anonymous Donation.
10. WHERE a Donation provides exactly one of donor name or donor email, THE Donation_Service SHALL persist the provided field and set the omitted field to null, treating the Donation as non-anonymous.
6. WHEN a Staff or Admin verifies a PENDING Donation, THE Donation_Service SHALL set the Donation status to VERIFIED and record the reviewing user.
7. WHEN a Staff or Admin rejects a PENDING Donation, THE Donation_Service SHALL set the Donation status to REJECTED and record the reviewing user and the rejection reason.
8. IF a Staff or Admin attempts to verify or reject a Donation whose status is not PENDING, THEN THE Donation_Service SHALL reject the action with a 409 Conflict response.
9. WHEN a Donor submits a receipt file, THE Donation_Service SHALL accept the file only if its content type is an allowed image type or application/pdf and its size is within the configured limit.

### Requirement 4: Authentication and Role-Based Access Control

**User Story:** As the business operator, I want every privileged action to be authenticated and authorized on the backend using roles, so that the system remains secure even if the frontend is bypassed.

#### Acceptance Criteria

1. IF a request to a Privileged_Endpoint carries no authentication token or an invalid token, THEN THE Auth_Service SHALL respond with 401 Unauthorized.
2. IF a request to a Privileged_Endpoint carries a valid token for a User whose role is not permitted for that endpoint, THEN THE Auth_Service SHALL respond with 403 Forbidden.
3. WHEN the Auth_Service authorizes a request, THE Auth_Service SHALL determine the acting user's role from the persisted User record rather than from any client-supplied value.
4. WHEN the Auth_Service authorizes a request to a Privileged_Endpoint, THE Auth_Service SHALL permit the request only if the acting user's role is in the set of roles allowed for that endpoint.
5. THE Platform SHALL classify listings retrieval, inquiry submission, donation payment information, and donation submission requests as public endpoint requests and SHALL accept them without requiring authentication.
6. WHERE a listing create, update, or deactivate action is requested, THE Listings_Service SHALL permit the action only for an Admin.
7. WHERE an inquiry management, receipt review, or donation review action is requested, THE Platform SHALL permit the action only for a Staff or an Admin.

### Requirement 5: Secure Receipt Storage

**User Story:** As a Staff or Admin reviewer, I want receipt files stored privately and accessed only through short-lived signed URLs, so that receipts are never publicly reachable.

#### Acceptance Criteria

1. WHEN a Membership_Receipt or Donation receipt file is stored, THE File_Storage SHALL store the file in a private location and THE Platform SHALL persist only the private file key, not a public URL.
2. WHEN a Staff or Admin requests to view a stored receipt, THE Platform SHALL return a Signed_URL that grants temporary read access and expires within approximately 300 seconds.
3. THE Platform SHALL make a stored receipt file readable only through a Signed_URL minted for a Staff or Admin context, and SHALL NOT expose any permanent public URL to a receipt file.
4. IF a request to view a receipt comes from a context that is not Staff or Admin, THEN THE Platform SHALL deny the request without issuing a Signed_URL.

### Requirement 6: Inquiry and Receipt Management Dashboards

**User Story:** As a Staff or Admin, I want to view and manage inquiries, pending receipts, and donations, so that I can operate the business and process verifications.

#### Acceptance Criteria

1. WHEN a Staff or Admin requests the list of pending Membership_Receipts, THE Membership_Service SHALL return only receipts whose status is PENDING, each paired with a Signed_URL, ordered by creation time.
2. WHEN a Staff or Admin requests Inquiries with a status filter, THE Inquiry_Service SHALL return only Inquiries matching the requested status.
3. WHEN a Staff or Admin updates the status of an Inquiry to IN_PROGRESS or CLOSED, THE Inquiry_Service SHALL persist the new status for that Inquiry.
4. WHEN an Admin requests the list of Donations with a status filter, THE Donation_Service SHALL return only Donations matching the requested status.

### Requirement 7: Error Handling and Input Safety

**User Story:** As a system operator, I want errors handled safely and inputs validated, so that the Platform stays robust and does not leak internal details.

#### Acceptance Criteria

1. IF an upstream storage or database operation fails, THEN THE Platform SHALL respond with a 500 status and a generic message that excludes stack traces, secrets, and internal diagnostics.
2. THE Platform SHALL execute all database queries using parameterized statements rather than string-concatenated SQL.
3. WHEN user-supplied text is rendered in a dashboard, THE Platform SHALL escape or sanitize that text to prevent cross-site scripting.
4. IF an uploaded file exceeds the configured size limit or has a disallowed content type, THEN THE Platform SHALL reject the upload with a 400 Bad Request response.
